import { NextResponse } from 'next/server';
import { getGoogleAuthClient } from '@/lib/services/google-workspace';

export async function GET() {
  const oauth2Client = getGoogleAuthClient();
  
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/tasks',
    'offline_access',
    'openid',
    'profile',
    'email'
  ];

  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  return NextResponse.redirect(authorizationUrl);
}
