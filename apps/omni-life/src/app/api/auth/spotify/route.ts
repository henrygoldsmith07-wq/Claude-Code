import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/spotify/callback`;
const SCOPES = [
  'user-read-recently-played',
  'user-read-playback-state',
  'playlist-modify-public',
  'user-top-read'
].join(' ');

export async function GET() {
  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  
  return NextResponse.redirect(spotifyAuthUrl);
}
