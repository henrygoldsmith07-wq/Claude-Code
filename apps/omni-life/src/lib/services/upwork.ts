import axios from 'axios';
import * as cheerio from 'cheerio';
import { UpworkNotification } from '@/types';

const UPWORK_BASE_URL = 'https://www.upwork.com';

// Helper function to make authenticated requests
const fetchUpworkPage = async (url: string) => {
  const sessionCookie = process.env.UPWORK_SESSION_COOKIE;
  const authToken = process.env.UPWORK_AUTH_TOKEN;

  if (!sessionCookie && !authToken) {
    throw new Error('UPWORK_SESSION_COOKIE or UPWORK_AUTH_TOKEN is not set in environment variables.');
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };

  if (sessionCookie) {
    headers['Cookie'] = `_upwork_session=${sessionCookie}`;
  } else if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const { data } = await axios.get(url, { headers });
    return cheerio.load(data);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
};

export const fetchRecentMessages = async (): Promise<UpworkNotification[]> => {
  console.log('Fetching Upwork messages via web scraping...');
  const messages: UpworkNotification[] = [];
  try {
    // This URL is a placeholder. Actual URL for messages page needs to be identified.
    await fetchUpworkPage(`${UPWORK_BASE_URL}/messages`);
    
    // Example scraping logic (this will need to be adapted to actual Upwork HTML structure)
    // $('div.message-item').each((i, el) => {
    //   const title = $(el).find('.message-title').text().trim();
    //   const content = $(el).find('.message-content').text().trim();
    //   const timestamp = $(el).find('.message-timestamp').attr('datetime');
    //   messages.push({
    //     id: `msg-${i}`,
    //     type: 'message',
    //     title,
    //     content,
    //     timestamp: timestamp || new Date().toISOString(),
    //     isUrgent: false, // Determine urgency based on content or other indicators
    //   });
    // });

    // Placeholder for demonstration
    messages.push({
      id: 'upwork-msg-1',
      type: 'message',
      title: 'New Message from Client (Scraped)',
      content: 'Hello Henry, I have a question about the project...',
      timestamp: new Date().toISOString(),
      isUrgent: true
    });

  } catch (error) {
    console.error('Failed to scrape recent messages:', error);
  }
  return messages;
};

export const checkNewJobInvites = async (): Promise<UpworkNotification[]> => {
  console.log('Checking Upwork job invites via web scraping...');
  const invites: UpworkNotification[] = [];
  try {
    // This URL is a placeholder. Actual URL for job invites page needs to be identified.
    await fetchUpworkPage(`${UPWORK_BASE_URL}/jobs/invites`);

    // Example scraping logic (this will need to be adapted to actual Upwork HTML structure)
    // $('div.job-invite-item').each((i, el) => {
    //   const title = $(el).find('.job-title').text().trim();
    //   const content = $(el).find('.invite-details').text().trim();
    //   invites.push({
    //     id: `invite-${i}`,
    //     type: 'invite',
    //     title,
    //     content,
    //     timestamp: new Date().toISOString(),
    //     isUrgent: true,
    //   });
    // });

    // Placeholder for demonstration
    invites.push({
      id: 'upwork-invite-1',
      type: 'invite',
      title: 'New Job Invite: Frontend Developer',
      content: 'You have been invited to apply for a new job. Client is looking for a skilled frontend developer.',
      timestamp: new Date().toISOString(),
      isUrgent: true
    });

  } catch (error) {
    console.error('Failed to scrape new job invites:', error);
  }
  return invites;
};

export const checkContractUpdates = async (): Promise<UpworkNotification[]> => {
  console.log('Checking Upwork contract updates via web scraping...');
  const updates: UpworkNotification[] = [];
  try {
    // This URL is a placeholder. Actual URL for contract updates page needs to be identified.
    await fetchUpworkPage(`${UPWORK_BASE_URL}/contracts`);

    // Example scraping logic (this will need to be adapted to actual Upwork HTML structure)
    // $('div.contract-update-item').each((i, el) => {
    //   const title = $(el).find('.update-title').text().trim();
    //   const content = $(el).find('.update-details').text().trim();
    //   updates.push({
    //     id: `contract-${i}`,
    //     type: 'contract_update',
    //     title,
    //     content,
    //     timestamp: new Date().toISOString(),
    //     isUrgent: false,
    //   });
    // });

    // Placeholder for demonstration
    updates.push({
      id: 'upwork-contract-1',
      type: 'contract_update',
      title: 'Contract Milestone Approved',
      content: 'Your recent milestone for Project X has been approved and payment released.',
      timestamp: new Date().toISOString(),
      isUrgent: false
    });

  } catch (error) {
    console.error('Failed to scrape contract updates:', error);
  }
  return updates;
};

export const getUrgentItems = async (): Promise<UpworkNotification[]> => {
  const messages = await fetchRecentMessages();
  const invites = await checkNewJobInvites();
  const updates = await checkContractUpdates();

  const all = [...messages, ...invites, ...updates];
  return all.filter(item => item.isUrgent);
};
