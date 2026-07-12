/**
 * The Life OS tree.
 *
 * Every node is an "operating system" at some level: the root is the Life OS,
 * its children are sub-OSes (Study, Builder, Health, Money), and their
 * children are either deeper OSes (NotebookLM OS), links out to existing
 * apps, or planned gaps. The /os route renders any node as a tile dashboard,
 * so growing the system is just editing this file — no new pages needed.
 */

export type OsStatus = 'live' | 'built' | 'planned';

export interface OsNode {
  /** URL segment; the node's path is the slugs from root joined with "/" */
  slug: string;
  name: string;
  icon: string;
  tagline: string;
  /** Longer text shown on the node's own page */
  description?: string;
  /**
   * live    — usable right now (links somewhere real)
   * built   — code exists in the repo but isn't deployed yet
   * planned — a gap to fill later
   */
  status: OsStatus;
  /** External destination; a tile with href opens it instead of drilling down */
  href?: string;
  /** Where the code lives, for built-but-not-yet-deployed pieces */
  repoPath?: string;
  children?: OsNode[];
}

export const lifeOs: OsNode = {
  slug: 'os',
  name: 'Life OS',
  icon: '🧭',
  tagline: 'Everything you run, one level at a time.',
  description:
    'The single place to see your whole life. Each tile below is a sub-OS: ' +
    'click in to zoom from "my life" down to "this one notebook". Add or ' +
    'rearrange systems by editing src/lib/os/tree.ts.',
  status: 'live',
  children: [
    {
      slug: 'study',
      name: 'Study OS',
      icon: '📚',
      tagline: 'A-levels, NotebookLM, and everything revision.',
      description:
        'Home for WJEC A-level work. The NotebookLM OS organises notebooks ' +
        'per subject; the WJEC Study Hub carries flashcards and spaced ' +
        'repetition. This OS doubles as a product surface — pieces of it are ' +
        'meant to graduate into tools other students use.',
      status: 'live',
      children: [
        {
          slug: 'notebooklm',
          name: 'NotebookLM OS',
          icon: '📓',
          tagline: 'One card per notebook, organised by subject.',
          description:
            'NotebookLM has no public API, so this level is an organised ' +
            'launcher: each card is one notebook with its role noted here. ' +
            'Replace the generic links with each notebook’s share URL.',
          status: 'live',
          children: [
            {
              slug: 'chemistry',
              name: 'Chemistry Notebook',
              icon: '🧪',
              tagline: 'WJEC Chemistry sources, summaries, audio overviews.',
              status: 'live',
              href: 'https://notebooklm.google.com',
            },
            {
              slug: 'physics',
              name: 'Physics Notebook',
              icon: '🌌',
              tagline: 'WJEC Physics sources and topic breakdowns.',
              status: 'live',
              href: 'https://notebooklm.google.com',
            },
            {
              slug: 'biology',
              name: 'Biology Notebook',
              icon: '🧬',
              tagline: 'WJEC Biology sources and revision material.',
              status: 'live',
              href: 'https://notebooklm.google.com',
            },
            {
              slug: 'maths',
              name: 'Maths Notebook',
              icon: '📐',
              tagline: 'WJEC Maths worked examples and method notes.',
              status: 'live',
              href: 'https://notebooklm.google.com',
            },
          ],
        },
        {
          slug: 'wjec-study-hub',
          name: 'WJEC Study Hub',
          icon: '🗂️',
          tagline: 'FSRS flashcards, interleaved practice, quizzes.',
          description:
            'Already built: evidence-based revision app with spaced ' +
            'repetition (FSRS), interleaving, and Claude-generated content. ' +
            'Deploy it and point this tile at the live URL.',
          status: 'built',
          repoPath: 'apps/wjec-study-app',
        },
        {
          slug: 'exam-planner',
          name: 'Exam Planner',
          icon: '⏳',
          tagline: 'Exam dates, countdowns, revision timetable.',
          status: 'live',
        },
        {
          slug: 'notes-vault',
          name: 'Notes Vault',
          icon: '🗃️',
          tagline: 'Class notes, past papers, mark schemes.',
          status: 'live',
        },
      ],
    },
    {
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
            {
              slug: 'omni-life',
              name: 'Omni-Life',
              icon: '🧭',
              tagline: 'This app — the Life OS hub itself.',
              status: 'built',
              repoPath: 'apps/omni-life',
            },
            {
              slug: 'wjec-study-app',
              name: 'WJEC Study Hub',
              icon: '🗂️',
              tagline: 'Evidence-based A-level revision.',
              status: 'built',
              repoPath: 'apps/wjec-study-app',
            },
            {
              slug: 'emotion-tracker',
              name: 'Emotion Tracker',
              icon: '📈',
              tagline: 'Mood logging and patterns.',
              status: 'built',
              repoPath: 'apps/emotion-tracker',
            },
            {
              slug: 'subscription-tracker',
              name: 'Subscription Tracker',
              icon: '💳',
              tagline: 'Recurring spend, surfaced.',
              status: 'built',
              repoPath: 'apps/subscription-tracker',
            },
            {
              slug: 'daily-debate',
              name: 'Daily Debate',
              icon: '🗣️',
              tagline: 'A debate prompt every day.',
              status: 'built',
              repoPath: 'apps/daily-debate',
            },
            {
              slug: 'world-news',
              name: 'World News',
              icon: '🌍',
              tagline: 'News, condensed.',
              status: 'built',
              repoPath: 'apps/world-news',
            },
            {
              slug: 'podcast-repurposer',
              name: 'Podcast Repurposer',
              icon: '🎙️',
              tagline: 'Transcripts into content.',
              status: 'built',
              repoPath: 'apps/podcast-repurposer',
            },
            {
              slug: 'rtk',
              name: 'RTK',
              icon: '🔧',
              tagline: 'CLI tooling.',
              status: 'built',
              repoPath: 'apps/rtk',
            },
          ],
        },
        {
          slug: 'ship-pipeline',
          name: 'Ship Pipeline',
          icon: '🚀',
          tagline: 'Ideas → building → shipped → double-down or kill.',
          status: 'live',
        },
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
      ],
    },
    {
      slug: 'health',
      name: 'Health OS',
      icon: '❤️',
      tagline: 'Mood, sleep, movement, habits.',
      status: 'live',
      children: [
        {
          slug: 'emotion-tracker',
          name: 'Emotion Tracker',
          icon: '📈',
          tagline: 'Log moods, spot patterns.',
          status: 'built',
          repoPath: 'apps/emotion-tracker',
        },
        {
          slug: 'fitness',
          name: 'Fitness & Sleep',
          icon: '🏃',
          tagline: 'Daily sleep + workout log; Google Fit and Hevy hooks come later.',
          status: 'live',
        },
        {
          slug: 'habits',
          name: 'Habits',
          icon: '🔁',
          tagline: 'Streaks and daily non-negotiables.',
          status: 'live',
        },
      ],
    },
    {
      slug: 'money',
      name: 'Money OS',
      icon: '💷',
      tagline: 'What goes out, what comes in.',
      status: 'live',
      children: [
        {
          slug: 'subscriptions',
          name: 'Subscription Tracker',
          icon: '💳',
          tagline: 'Every recurring charge in one place.',
          status: 'built',
          repoPath: 'apps/subscription-tracker',
        },
        {
          slug: 'income',
          name: 'App Income',
          icon: '📊',
          tagline: 'Revenue per app — the Stripe service in Omni-Life feeds this.',
          status: 'live',
        },
        {
          slug: 'budget',
          name: 'Budget',
          icon: '🧾',
          tagline: 'Spending vs plan.',
          status: 'live',
        },
      ],
    },
  ],
};

/** Resolve a node from URL segments (excluding the leading "os"). */
export function findNode(
  segments: string[]
): { node: OsNode; trail: OsNode[] } | null {
  let node: OsNode = lifeOs;
  const trail: OsNode[] = [lifeOs];
  for (const segment of segments) {
    const next = node.children?.find((child) => child.slug === segment);
    if (!next) return null;
    node = next;
    trail.push(next);
  }
  return { node, trail };
}

/** Internal route for a node given its breadcrumb trail. */
export function nodeHref(trail: OsNode[]): string {
  return '/os' + trail.slice(1).map((n) => `/${n.slug}`).join('');
}
