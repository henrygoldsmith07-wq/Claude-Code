import type { OsNode } from '@/lib/os/tree';

export const healthOs: OsNode = {
  slug: 'health',
  name: 'Health OS',
  icon: '❤️',
  tagline: 'Mood, sleep, movement, habits.',
  status: 'live',
  children: [
    { slug: 'emotion-tracker', name: 'Emotion Tracker', icon: '📈', tagline: 'Log moods, spot patterns.', status: 'built', repoPath: 'apps/emotion-tracker' },
    { slug: 'fitness', name: 'Fitness & Sleep', icon: '🏃', tagline: 'Daily sleep + workout log; Google Fit and Hevy hooks come later.', status: 'live' },
    { slug: 'habits', name: 'Habits', icon: '🔁', tagline: 'Streaks and daily non-negotiables.', status: 'live' },
    { slug: 'water', name: 'Water Tracker', icon: '💧', tagline: 'Tap a glass every time you drink one.', status: 'live' },
    { slug: 'meals', name: 'Meal Log', icon: '🍽️', tagline: 'One line per meal — awareness over calorie maths.', status: 'live' },
    { slug: 'screen-time', name: 'Screen Time', icon: '📵', tagline: 'Doomscroll hours vs a daily ceiling.', status: 'live' },
    { slug: 'steps', name: 'Steps', icon: '🚶', tagline: 'Daily step count vs target.', status: 'live' },
    { slug: 'mindfulness', name: 'Mindfulness', icon: '🧘', tagline: 'Breathing and meditation minutes.', status: 'live' },
    { slug: 'symptoms', name: 'Symptoms Journal', icon: '🤒', tagline: 'What hurt, when, how much — patterns emerge.', status: 'live' },
    { slug: 'gratitude', name: 'Gratitude', icon: '🌅', tagline: 'Three good things a day.', status: 'live' },
  ],
};
