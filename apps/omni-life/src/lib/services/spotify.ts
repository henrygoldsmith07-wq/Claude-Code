export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  playedAt?: string; // Optional for currently playing
}

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

/**
 * Refreshes the Spotify access token using a refresh token.
 * @param refreshToken The refresh token obtained during the OAuth flow.
 * @returns A promise that resolves to the new access token and optionally a new refresh token.
 */
export const refreshSpotifyToken = async (refreshToken: string): Promise<{ accessToken: string; refreshToken?: string } | null> => {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return null;
  }
};

/**
 * Fetches recently played tracks for the user.
 * @param accessToken The user's Spotify access token.
 * @returns A promise that resolves to an array of SpotifyTrack objects.
 */
export const getRecentlyPlayed = async (accessToken: string): Promise<SpotifyTrack[]> => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=10', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch recently played: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.items.map((item: any) => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists.map((a: any) => a.name).join(', '),
      album: item.track.album.name,
      playedAt: item.played_at,
    }));
  } catch (error) {
    console.error('Error fetching recently played tracks:', error);
    return [];
  }
};

/**
 * Fetches the currently playing track for the user.
 * @param accessToken The user's Spotify access token.
 * @returns A promise that resolves to a SpotifyTrack object or null if nothing is playing.
 */
export const getCurrentlyPlaying = async (accessToken: string): Promise<SpotifyTrack | null> => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.status === 204) {
      return null; // No content, meaning nothing is currently playing
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch currently playing: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    if (!data || !data.item) return null;

    return {
      id: data.item.id,
      name: data.item.name,
      artist: data.item.artists.map((a: any) => a.name).join(', '),
      album: data.item.album.name,
    };
  } catch (error) {
    console.error('Error fetching currently playing track:', error);
    return null;
  }
};

/**
 * Fetches the user's top tracks.
 * @param accessToken The user's Spotify access token.
 * @returns A promise that resolves to an array of SpotifyTrack objects.
 */
export const getTopTracks = async (accessToken: string): Promise<SpotifyTrack[]> => {
  try {
    const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to fetch top tracks: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.items.map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      album: track.album.name,
    }));
  } catch (error) {
    console.error('Error fetching top tracks:', error);
    return [];
  }
};

/**
 * Creates a new playlist for the user and adds specified tracks.
 * @param accessToken The user's Spotify access token.
 * @param name The name of the new playlist.
 * @param trackUris An array of Spotify track URIs to add to the playlist.
 * @returns A promise that resolves to the created playlist data or null on error.
 */
export const createPlaylist = async (accessToken: string, name: string, trackUris: string[]): Promise<any | null> => {
  try {
    // Get user ID
    const userResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      throw new Error(`Failed to get user ID: ${userResponse.status} ${userResponse.statusText} - ${JSON.stringify(errorData)}`);
    }
    const userData = await userResponse.json();
    const userId = userData.id;

    // Create playlist
    const playlistResponse = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, public: true }),
    });

    if (!playlistResponse.ok) {
      const errorData = await playlistResponse.json();
      throw new Error(`Failed to create playlist: ${playlistResponse.status} ${playlistResponse.statusText} - ${JSON.stringify(errorData)}`);
    }
    const playlistData = await playlistResponse.json();
    const playlistId = playlistData.id;

    // Add tracks to playlist
    if (trackUris.length > 0) {
      const addTracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: trackUris }),
      });

      if (!addTracksResponse.ok) {
        const errorData = await addTracksResponse.json();
        throw new Error(`Failed to add tracks to playlist: ${addTracksResponse.status} ${addTracksResponse.statusText} - ${JSON.stringify(errorData)}`);
      }
    }

    return playlistData;
  } catch (error) {
    console.error('Error creating Spotify playlist:', error);
    return null;
  }
};
