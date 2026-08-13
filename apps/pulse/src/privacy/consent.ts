/**
 * Consent registry.
 *
 * Nothing syncs without a grant here, and a grant is per-source and
 * per-scope. Two rules are enforced structurally rather than by convention:
 *
 *  1. A connector marked `requiresExplicitPermission` (Reflect) can never be
 *     enabled by a bulk "connect all" action — `grantAll` skips it.
 *  2. Revoking is not a flag flip. It returns the work still owed (delete the
 *     data) so the caller cannot forget the second half.
 */

import type { SourceId } from "../events/schema.js";
import type { Connector } from "../connectors/types.js";

export interface ConsentGrant {
  source: SourceId;
  granted: boolean;
  /** True only when the user granted this source individually. */
  explicit: boolean;
  /** Scope ids the user agreed to; a connector may request more later. */
  scopes: string[];
  grantedAt: string | null;
  revokedAt: string | null;
  /** When false, this source's events are never included in AI prompts. */
  allowAiProcessing: boolean;
  /** When false, the source's events are excluded from full exports. */
  includeInExport: boolean;
}

export interface RevocationOutcome {
  source: SourceId;
  revokedAt: string;
  /** The caller must now delete this source's stored events. */
  dataDeletionRequired: boolean;
}

export interface ConsentSnapshot {
  grants: ConsentGrant[];
  version: 1;
}

export class ConsentRegistry {
  private grants = new Map<SourceId, ConsentGrant>();

  constructor(private readonly now: () => number = Date.now) {}

  get(source: SourceId): ConsentGrant | null {
    return this.grants.get(source) ?? null;
  }

  list(): ConsentGrant[] {
    return [...this.grants.values()].sort((a, b) => String(a.source).localeCompare(String(b.source)));
  }

  isGranted(source: SourceId, scope?: string): boolean {
    const grant = this.grants.get(source);
    if (!grant || !grant.granted) return false;
    return scope ? grant.scopes.includes(scope) : true;
  }

  /**
   * Grants a single source. `scopes` defaults to everything the connector
   * declares — the caller is expected to have shown those descriptions.
   */
  grant(
    connector: Connector,
    options: { scopes?: string[]; allowAiProcessing?: boolean; includeInExport?: boolean } = {},
  ): ConsentGrant {
    const declared = connector.scopes.map((s) => s.id);
    const requested = options.scopes ?? declared;
    const unknown = requested.filter((s) => !declared.includes(s));
    if (unknown.length) {
      throw new Error(`${connector.id} does not declare scope(s): ${unknown.join(", ")}`);
    }

    const grant: ConsentGrant = {
      source: connector.id,
      granted: true,
      explicit: true,
      scopes: requested,
      grantedAt: new Date(this.now()).toISOString(),
      revokedAt: null,
      // Sensitive connectors default to *not* feeding the AI layer. The user
      // can turn it on, but never by omission.
      allowAiProcessing:
        options.allowAiProcessing ?? !(connector.requiresExplicitPermission || connector.defaultSensitivity === "sensitive"),
      includeInExport: options.includeInExport ?? true,
    };
    this.grants.set(connector.id, grant);
    return grant;
  }

  /**
   * Bulk connect. Deliberately refuses connectors that require their own
   * permission and reports them so the UI can prompt separately.
   */
  grantAll(connectors: readonly Connector[]): { granted: SourceId[]; skipped: SourceId[] } {
    const granted: SourceId[] = [];
    const skipped: SourceId[] = [];
    for (const connector of connectors) {
      if (connector.requiresExplicitPermission) {
        skipped.push(connector.id);
        continue;
      }
      this.grant(connector);
      const existing = this.grants.get(connector.id);
      if (existing) existing.explicit = false;
      granted.push(connector.id);
    }
    return { granted, skipped };
  }

  revoke(source: SourceId): RevocationOutcome {
    const grant = this.grants.get(source);
    const revokedAt = new Date(this.now()).toISOString();
    if (grant) {
      grant.granted = false;
      grant.explicit = false;
      grant.scopes = [];
      grant.revokedAt = revokedAt;
      grant.allowAiProcessing = false;
    } else {
      this.grants.set(source, {
        source,
        granted: false,
        explicit: false,
        scopes: [],
        grantedAt: null,
        revokedAt,
        allowAiProcessing: false,
        includeInExport: false,
      });
    }
    return { source, revokedAt, dataDeletionRequired: true };
  }

  /** Sources whose events may be sent to a language model. */
  aiEligibleSources(): SourceId[] {
    return this.list()
      .filter((g) => g.granted && g.allowAiProcessing)
      .map((g) => g.source);
  }

  exportableSources(): SourceId[] {
    return this.list()
      .filter((g) => g.granted && g.includeInExport)
      .map((g) => g.source);
  }

  toSnapshot(): ConsentSnapshot {
    return { grants: this.list(), version: 1 };
  }

  static fromSnapshot(snapshot: ConsentSnapshot, now: () => number = Date.now): ConsentRegistry {
    const registry = new ConsentRegistry(now);
    for (const grant of snapshot.grants) registry.grants.set(grant.source, { ...grant });
    return registry;
  }
}
