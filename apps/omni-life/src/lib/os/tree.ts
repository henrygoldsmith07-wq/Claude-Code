/**
 * The Life OS tree.
 *
 * Every node is an "operating system" at some level: the root is the Life OS,
 * its children are sub-OSes (Study, Builder, Health, Money — one module each
 * under areas/), and their children are deeper OSes, links out to existing
 * apps, or planned gaps. The /os route renders any node as a tile dashboard,
 * so growing the system is just editing the area modules — no new pages.
 */

import { studyOs } from '@/lib/os/areas/study';
import { builderOs } from '@/lib/os/areas/builder';
import { healthOs } from '@/lib/os/areas/health';
import { moneyOs } from '@/lib/os/areas/money';

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
    'rearrange systems by editing the area modules in src/lib/os/areas/.',
  status: 'live',
  children: [studyOs, builderOs, healthOs, moneyOs],
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
