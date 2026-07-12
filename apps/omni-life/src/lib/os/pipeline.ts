/**
 * Shared Ship Pipeline data model — used by the pipeline board and by
 * Idea Vault, which promotes scored ideas into the pipeline's idea column.
 */

export type Stage = 'idea' | 'building' | 'shipped' | 'double-down' | 'killed';

export interface Bet {
  id: string;
  name: string;
  stage: Stage;
}

export const stages: { id: Stage; label: string; hint: string }[] = [
  { id: 'idea', label: '💡 Ideas', hint: 'Cheap bets waiting to be placed' },
  { id: 'building', label: '🔨 Building', hint: 'In progress right now' },
  { id: 'shipped', label: '🚀 Shipped', hint: 'Live — watch the signal' },
  { id: 'double-down', label: '📈 Double down', hint: 'Earning its keep — invest' },
  { id: 'killed', label: '🪦 Killed', hint: 'Fast no. Archive and move on' },
];

export const PIPELINE_KEY = 'os.builder.pipeline';

export const pipelineSeed: Bet[] = [
  { id: 'omni-life', name: 'Omni-Life', stage: 'building' },
  { id: 'wjec-study-app', name: 'WJEC Study Hub', stage: 'shipped' },
  { id: 'emotion-tracker', name: 'Emotion Tracker', stage: 'shipped' },
  { id: 'subscription-tracker', name: 'Subscription Tracker', stage: 'shipped' },
  { id: 'daily-debate', name: 'Daily Debate', stage: 'shipped' },
  { id: 'world-news', name: 'World News', stage: 'shipped' },
  { id: 'podcast-repurposer', name: 'Podcast Repurposer', stage: 'shipped' },
  { id: 'rtk', name: 'RTK', stage: 'shipped' },
];
