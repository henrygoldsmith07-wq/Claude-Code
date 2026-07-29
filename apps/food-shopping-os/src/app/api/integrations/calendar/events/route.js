import { NextResponse } from 'next/server';
import {
  ApiError, assertSameOrigin, handleApiError, objectId, rateLimit, requireUser,
} from '../../../../../server/api.js';
import { getDatabase } from '../../../../../server/mongodb.js';
import { calendarEventSchema } from '../../../../../server/schemas.js';

const refreshGoogle = async (account) => {
  if (!account.refresh_token) throw new ApiError(409, 'Reconnect Google Calendar.');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID,
      client_secret: process.env.AUTH_GOOGLE_SECRET,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    }),
  });
  if (!response.ok) throw new ApiError(502, 'Google Calendar authorisation could not be refreshed.');
  return response.json();
};

const refreshMicrosoft = async (account) => {
  if (!account.refresh_token) throw new ApiError(409, 'Reconnect Microsoft Calendar.');
  const tenant = process.env.AUTH_MICROSOFT_TENANT_ID || 'common';
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_MICROSOFT_ID,
      client_secret: process.env.AUTH_MICROSOFT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
      scope: 'openid email profile offline_access Calendars.ReadWrite',
    }),
  });
  if (!response.ok) throw new ApiError(502, 'Microsoft Calendar authorisation could not be refreshed.');
  return response.json();
};

export async function POST(request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    await rateLimit(`calendar:${user.id}`, 60, 3600000);
    const input = calendarEventSchema.parse(await request.json());
    const db = await getDatabase();
    const account = await db.collection('accounts').findOne({
      userId: objectId(user.id, 'user'),
      provider: input.provider,
    });
    if (!account) throw new ApiError(409, 'Connect this calendar provider first.');
    let accessToken = account.access_token;
    if (!accessToken || Number(account.expires_at || 0) * 1000 < Date.now() + 60000) {
      const refreshed = input.provider === 'google'
        ? await refreshGoogle(account)
        : await refreshMicrosoft(account);
      accessToken = refreshed.access_token;
      await db.collection('accounts').updateOne(
        { _id: account._id },
        {
          $set: {
            access_token: accessToken,
            expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
            ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
          },
        },
      );
    }
    const isGoogle = input.provider === 'google';
    const endpoint = isGoogle
      ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      : 'https://graph.microsoft.com/v1.0/me/events';
    const payload = isGoogle
      ? {
          summary: input.title,
          description: input.notes,
          start: { dateTime: input.start },
          end: { dateTime: input.end },
        }
      : {
          subject: input.title,
          body: { contentType: 'text', content: input.notes || '' },
          start: { dateTime: input.start, timeZone: 'UTC' },
          end: { dateTime: input.end, timeZone: 'UTC' },
        };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new ApiError(502, 'The calendar provider rejected the event.');
    const event = await response.json();
    return NextResponse.json({ id: event.id, url: event.htmlLink || event.webLink || null }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
