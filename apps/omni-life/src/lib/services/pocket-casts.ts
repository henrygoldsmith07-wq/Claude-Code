import axios from 'axios';
import { PodcastEpisode } from '@/types';

const POCKET_CASTS_EMAIL = process.env.POCKET_CASTS_EMAIL;
const POCKET_CASTS_PASSWORD = process.env.POCKET_CASTS_PASSWORD;

/**
 * Pocket Casts integration using private API
 */
export const authenticate = async () => {
  try {
    const response = await axios.post('https://api.pocketcasts.com/user/login', {
      email: POCKET_CASTS_EMAIL,
      password: POCKET_CASTS_PASSWORD,
      scope: 'web_player'
    });
    return response.data.token;
  } catch (error) {
    console.error('Error authenticating with Pocket Casts:', error);
    return null;
  }
};

export const getListeningHistory = async (token: string): Promise<PodcastEpisode[]> => {
  try {
    const response = await axios.get('https://api.pocketcasts.com/user/history', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.episodes.map((ep: any) => ({
      id: ep.uuid,
      title: ep.title,
      podcast: ep.podcastTitle,
      duration: ep.duration,
      playedAt: ep.playedAt,
    }));
  } catch (error) {
    console.error('Error fetching Pocket Casts history:', error);
    return [];
  }
};

export const getInProgressEpisodes = async (token: string): Promise<PodcastEpisode[]> => {
  try {
    const response = await axios.get('https://api.pocketcasts.com/user/in_progress', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data.episodes.map((ep: any) => ({
      id: ep.uuid,
      title: ep.title,
      podcast: ep.podcastTitle,
      position: ep.position,
      duration: ep.duration,
    }));
  } catch (error) {
    console.error('Error fetching Pocket Casts in-progress episodes:', error);
    return [];
  }
};
