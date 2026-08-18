/**
 * Versioned wire format used by first-party apps when they publish a compact
 * history for Pulse. The envelope is intentionally smaller than an app's
 * private store and never contains transcripts or free text.
 */

export const SOURCE_HISTORY_FORMAT = "le-studio.source-history" as const;
export const CURRENT_SOURCE_HISTORY_VERSION = 2;

export interface SourceHistoryEnvelope<TRecord> {
  format: typeof SOURCE_HISTORY_FORMAT;
  schemaVersion: number;
  source: string;
  connectorVersion: string;
  generatedAt: string;
  records: TRecord[];
  cursor: string | null;
}

export class SourceHistoryMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceHistoryMigrationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Build the current envelope for an app's shared-origin history key. */
export function createSourceHistory<TRecord>(
  source: string,
  connectorVersion: string,
  records: readonly TRecord[],
  generatedAt = nowIso(),
): SourceHistoryEnvelope<TRecord> {
  return {
    format: SOURCE_HISTORY_FORMAT,
    schemaVersion: CURRENT_SOURCE_HISTORY_VERSION,
    source,
    connectorVersion,
    generatedAt,
    records: [...records],
    cursor: null,
  };
}

/**
 * Migrate a stored source history to the current contract.
 *
 * Arrays are the pre-envelope format and are deliberately accepted so an app
 * can roll forward without losing a user's existing local history. Future
 * versions are rejected rather than guessed at.
 */
export function migrateSourceHistory(value: unknown, expectedSource?: string): SourceHistoryEnvelope<unknown> {
  let current: Record<string, unknown>;
  if (Array.isArray(value)) {
    current = {
      format: SOURCE_HISTORY_FORMAT,
      schemaVersion: 1,
      source: expectedSource ?? "unknown",
      connectorVersion: "0.0.0",
      generatedAt: nowIso(),
      records: value,
      cursor: null,
    };
  } else if (isObject(value)) {
    current = { ...value };
  } else {
    throw new SourceHistoryMigrationError("Source history must be an object or an array");
  }

  const version = typeof current.schemaVersion === "number"
    ? current.schemaVersion
    : typeof current.version === "number"
      ? current.version
      : 1;
  if (!Number.isInteger(version) || version < 1) {
    throw new SourceHistoryMigrationError("Source history has an invalid schema version");
  }
  if (version > CURRENT_SOURCE_HISTORY_VERSION) {
    throw new SourceHistoryMigrationError(
      `Cannot migrate source history from v${version}: this build only understands up to v${CURRENT_SOURCE_HISTORY_VERSION}`,
    );
  }

  const source = typeof current.source === "string" ? current.source : expectedSource;
  if (!source || (expectedSource && source !== expectedSource)) {
    throw new SourceHistoryMigrationError("Source history belongs to an unexpected source");
  }
  if (!Array.isArray(current.records)) {
    throw new SourceHistoryMigrationError("Source history records must be an array");
  }

  if (version === 1) {
    current = {
      ...current,
      format: SOURCE_HISTORY_FORMAT,
      schemaVersion: 2,
      source,
      connectorVersion: typeof current.connectorVersion === "string" ? current.connectorVersion : "0.0.0",
      generatedAt: typeof current.generatedAt === "string" ? current.generatedAt : nowIso(),
      cursor: typeof current.cursor === "string" ? current.cursor : null,
    };
  }

  if (current.format !== SOURCE_HISTORY_FORMAT) {
    throw new SourceHistoryMigrationError("Source history has an unknown format");
  }

  return {
    format: SOURCE_HISTORY_FORMAT,
    schemaVersion: CURRENT_SOURCE_HISTORY_VERSION,
    source,
    connectorVersion: String(current.connectorVersion ?? "0.0.0"),
    generatedAt: String(current.generatedAt ?? nowIso()),
    records: current.records as unknown[],
    cursor: typeof current.cursor === "string" ? current.cursor : null,
  };
}

/** Safe reader helper for connector boundaries: malformed history means no data. */
export function readSourceHistoryRecords<TRecord>(value: unknown, expectedSource: string): TRecord[] {
  try {
    return migrateSourceHistory(value, expectedSource).records as TRecord[];
  } catch {
    return [];
  }
}
