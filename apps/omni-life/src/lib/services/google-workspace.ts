import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GoogleCalendarEvent, GmailMessage } from '@/types';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

export const getGoogleAuthClient = (accessToken?: string, refreshToken?: string): OAuth2Client => {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  if (accessToken || refreshToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return oauth2Client;
};

export const refreshGoogleToken = async (refreshToken: string) => {
  const oauth2Client = getGoogleAuthClient(undefined, refreshToken);
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
};

export const fetchPriorityEmails = async (accessToken: string): Promise<GmailMessage[]> => {
  const auth = getGoogleAuthClient(accessToken);
  const gmail = google.gmail({ version: 'v1', auth });
  
  // Fetch unread important emails
  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread label:important',
    maxResults: 10,
  });

  if (!response.data.messages) return [];

  const messages = await Promise.all(
    response.data.messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
      });
      return detail.data as GmailMessage;
    })
  );

  return messages;
};

export const getTodayEvents = async (accessToken: string): Promise<GoogleCalendarEvent[]> => {
  const auth = getGoogleAuthClient(accessToken);
  const calendar = google.calendar({ version: 'v3', auth });
  
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay,
    timeMax: endOfDay,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (response.data.items || []) as GoogleCalendarEvent[];
};

export const createEvent = async (accessToken: string, event: any) => {
  const auth = getGoogleAuthClient(accessToken);
  const calendar = google.calendar({ version: 'v3', auth });
  
  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data;
};

export const checkAvailability = async (accessToken: string, timeSlot: { start: string; end: string }) => {
  const auth = getGoogleAuthClient(accessToken);
  const calendar = google.calendar({ version: 'v3', auth });
  
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeSlot.start,
      timeMax: timeSlot.end,
      items: [{ id: 'primary' }],
    },
  });

  const busy = response.data.calendars?.primary?.busy || [];
  return busy.length === 0;
};

export const listTasks = async (accessToken: string) => {
  const auth = getGoogleAuthClient(accessToken);
  const tasks = google.tasks({ version: 'v1', auth });
  
  const response = await tasks.tasks.list({
    tasklist: '@default',
    showCompleted: false,
  });

  return response.data.items || [];
};

export const createTask = async (accessToken: string, task: { title: string; notes?: string; due?: string }) => {
  const auth = getGoogleAuthClient(accessToken);
  const tasks = google.tasks({ version: 'v1', auth });
  
  const response = await tasks.tasks.insert({
    tasklist: '@default',
    requestBody: task,
  });

  return response.data;
};

export const completeTask = async (accessToken: string, taskId: string) => {
  const auth = getGoogleAuthClient(accessToken);
  const tasks = google.tasks({ version: 'v1', auth });
  
  const response = await tasks.tasks.patch({
    tasklist: '@default',
    task: taskId,
    requestBody: {
      status: 'completed',
    },
  });

  return response.data;
};

export const fetchRecentNotes = async (_accessToken: string) => {
  // Google Keep API is not available in standard googleapis for service accounts/OAuth easily
  // It requires enterprise domain or specific setup. 
  // For this implementation, we'll provide a placeholder or use an alternative if possible.
  // Note: Standard Google API library doesn't include Keep.
  console.log('Google Keep API access is limited for standard OAuth apps.');
  return [];
};
