/**
 * User-authored groups of insights.
 *
 * Collections store the relationship signature, not a finding id. Finding
 * ids change as the sample grows; the signature is the stable identity that
 * the history and replication ledgers already use.
 */

import { hash128 } from "../events/hash.js";

export interface InsightCollection {
  id: string;
  title: string;
  insightSignatures: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InsightCollectionsSnapshot {
  version: 1;
  collections: InsightCollection[];
}

export interface InsightCollectionsAdapter {
  load(): Promise<InsightCollectionsSnapshot | null>;
  save(snapshot: InsightCollectionsSnapshot): Promise<void>;
}

const COLLECTIONS_VERSION = 1 as const;

export class InsightCollectionStore {
  private collections = new Map<string, InsightCollection>();
  private sequence = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly adapter: InsightCollectionsAdapter | null = null,
  ) {}

  async load(): Promise<void> {
    if (!this.adapter) return;
    const snapshot = await this.adapter.load();
    if (!snapshot || snapshot.version !== COLLECTIONS_VERSION || !Array.isArray(snapshot.collections)) return;
    this.collections = new Map(
      snapshot.collections
        .filter((collection) => isCollection(collection))
        .map((collection) => [collection.id, copyCollection(collection)]),
    );
  }

  async persist(): Promise<void> {
    if (!this.adapter) return;
    await this.adapter.save(this.snapshot());
  }

  create(title: string): InsightCollection {
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("Collection title cannot be empty");
    const at = new Date(this.now()).toISOString();
    const id = `collection-${hash128(`${cleanTitle}:${at}:${this.sequence++}`).slice(0, 12)}`;
    const collection: InsightCollection = {
      id,
      title: cleanTitle,
      insightSignatures: [],
      createdAt: at,
      updatedAt: at,
    };
    this.collections.set(id, collection);
    return copyCollection(collection);
  }

  rename(id: string, title: string): InsightCollection {
    const collection = this.require(id);
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("Collection title cannot be empty");
    collection.title = cleanTitle;
    collection.updatedAt = new Date(this.now()).toISOString();
    return copyCollection(collection);
  }

  addInsight(id: string, signature: string): InsightCollection {
    const collection = this.require(id);
    if (!signature.trim()) throw new Error("Insight signature cannot be empty");
    if (!collection.insightSignatures.includes(signature)) {
      collection.insightSignatures.push(signature);
      collection.updatedAt = new Date(this.now()).toISOString();
    }
    return copyCollection(collection);
  }

  removeInsight(id: string, signature: string): InsightCollection {
    const collection = this.require(id);
    collection.insightSignatures = collection.insightSignatures.filter((entry) => entry !== signature);
    collection.updatedAt = new Date(this.now()).toISOString();
    return copyCollection(collection);
  }

  delete(id: string): boolean {
    return this.collections.delete(id);
  }

  get(id: string): InsightCollection | undefined {
    const collection = this.collections.get(id);
    return collection ? copyCollection(collection) : undefined;
  }

  list(): InsightCollection[] {
    return [...this.collections.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title))
      .map(copyCollection);
  }

  /** Removes references to insights made unverifiable by source deletion. */
  prune(keepSignatures: ReadonlySet<string>): number {
    let removed = 0;
    for (const collection of this.collections.values()) {
      const before = collection.insightSignatures.length;
      collection.insightSignatures = collection.insightSignatures.filter((signature) => keepSignatures.has(signature));
      removed += before - collection.insightSignatures.length;
      if (before !== collection.insightSignatures.length) collection.updatedAt = new Date(this.now()).toISOString();
    }
    return removed;
  }

  snapshot(): InsightCollectionsSnapshot {
    return { version: COLLECTIONS_VERSION, collections: this.list() };
  }

  size(): number {
    return this.collections.size;
  }

  private require(id: string): InsightCollection {
    const collection = this.collections.get(id);
    if (!collection) throw new Error(`Unknown insight collection: ${id}`);
    return collection;
  }
}

function isCollection(value: InsightCollection): boolean {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      typeof value.title === "string" &&
      Array.isArray(value.insightSignatures) &&
      typeof value.createdAt === "string" &&
      typeof value.updatedAt === "string",
  );
}

function copyCollection(collection: InsightCollection): InsightCollection {
  return { ...collection, insightSignatures: [...collection.insightSignatures] };
}

export function createMemoryInsightCollectionsAdapter(): InsightCollectionsAdapter {
  let snapshot: InsightCollectionsSnapshot | null = null;
  return {
    async load() {
      return snapshot;
    },
    async save(next) {
      snapshot = next;
    },
  };
}
