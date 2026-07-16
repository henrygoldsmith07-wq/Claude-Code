import type { OsNode } from '@/lib/os/tree';

export const builderOs: OsNode = {
  slug: 'builder',
  name: 'Builder OS',
  icon: '🛠️',
  tagline: 'Ship fast, watch the winners, kill the rest.',
  description:
    'The portfolio view of everything in apps/. The mission: high volume ' +
    'of cheap bets, double down on whatever earns its keep.',
  status: 'live',
  children: [
    {
      slug: 'portfolio',
      name: 'App Portfolio',
      icon: '📦',
      tagline: 'Every bet currently on the table.',
      status: 'live',
      children: [
        { slug: 'omni-life', name: 'Omni-Life', icon: '🧭', tagline: 'This app — the Life OS hub itself.', status: 'built', repoPath: 'apps/omni-life' },
        { slug: 'wjec-study-app', name: 'WJEC Study Hub', icon: '🗂️', tagline: 'Evidence-based A-level revision.', status: 'built', repoPath: 'apps/wjec-study-app' },
        { slug: 'emotion-tracker', name: 'Emotion Tracker', icon: '📈', tagline: 'Mood logging and patterns.', status: 'built', repoPath: 'apps/emotion-tracker' },
        { slug: 'subscription-tracker', name: 'Subscription Tracker', icon: '💳', tagline: 'Recurring spend, surfaced.', status: 'built', repoPath: 'apps/subscription-tracker' },
        { slug: 'daily-debate', name: 'Daily Debate', icon: '🗣️', tagline: 'A debate prompt every day.', status: 'built', repoPath: 'apps/daily-debate' },
        { slug: 'world-news', name: 'World News', icon: '🌍', tagline: 'News, condensed.', status: 'built', repoPath: 'apps/world-news' },
        { slug: 'podcast-repurposer', name: 'Podcast Repurposer', icon: '🎙️', tagline: 'Transcripts into content.', status: 'built', repoPath: 'apps/podcast-repurposer' },
        { slug: 'rtk', name: 'RTK', icon: '🔧', tagline: 'CLI tooling.', status: 'built', repoPath: 'apps/rtk' },
      ],
    },
    { slug: 'ship-pipeline', name: 'Ship Pipeline', icon: '🚀', tagline: 'Ideas → building → shipped → double-down or kill.', status: 'live' },
    { slug: 'idea-vault', name: 'Idea Vault', icon: '💡', tagline: 'Score impact vs effort, promote winners to the pipeline.', status: 'live' },
    { slug: 'launch-checklist', name: 'Launch Checklist', icon: '🧾', tagline: 'The same eight shipping steps for every app.', status: 'live' },
    {
      slug: 'knowledge-base',
      name: 'Knowledge Base',
      icon: '🧠',
      tagline: 'The /raw + /wiki self-improving loop.',
      description:
        'The repo’s learning system: session digests, ecosystem data ' +
        'and curated content land in /raw, get indexed in /wiki, and the ' +
        'improvement loop turns them into workspace upgrades.',
      status: 'live',
      repoPath: 'wiki/index.md',
    },
    { slug: 'bug-tracker', name: 'Bug Tracker', icon: '🐛', tagline: 'Open bugs per app, worst first.', status: 'live' },
    { slug: 'marketing-log', name: 'Marketing Log', icon: '📣', tagline: 'Every post and launch, and what it did.', status: 'live' },
    { slug: 'experiments', name: 'Experiments', icon: '🧪', tagline: 'Hypothesis → running → won or lost.', status: 'live' },
    { slug: 'tech-debt', name: 'Tech Debt', icon: '🔩', tagline: 'Known shortcuts, ranked by pain.', status: 'live' },
    { slug: 'learning-log', name: 'Learning Log', icon: '📚', tagline: 'Dev skills queued, in progress, learned.', status: 'live' },
  ],
};
