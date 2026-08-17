export * from "./types.js";
export * from "./sdk.js";
export * from "./sync.js";
export { createReviseCloudConnector, createReviseConnector, mapReviseRecord } from "./revise.js";
export { DEFAULT_REVISE_HISTORY_ENDPOINT } from "./revise.js";
export type { ReviseRecord, ReviseReviewRecord, ReviseAttemptRecord, ReviseSessionRecord, ReviseGrade } from "./revise.js";
export {
  ARISE_STORAGE_KEY,
  ariseConsentGranted,
  createAriseConnector,
  createAriseSameOriginConnector,
  mapAriseRecord,
  selectAriseRecords,
} from "./arise.js";
export type { AriseRecord, AriseSessionRecord, AriseReadinessRecord, AriseBlock, AriseSet } from "./arise.js";

// --- Reading sibling apps that share this origin ---------------------------
export { createSameOriginReader, subscribeToSameOriginSource } from "./same-origin.js";
export type { SameOriginReaderOptions, StorageLike, Unsubscribe } from "./same-origin.js";
export {
  FORQ_STORAGE_KEY,
  createForqConnector,
  createForqSameOriginConnector,
  mapForqRecord,
  selectForqRecords,
} from "./forq.js";
export type { ForqRecord, ForqMealRecord, ForqPlanRecord } from "./forq.js";
export { createChronoConnector, mapChronoRecord } from "./chrono.js";
export type { ChronoRecord, ChronoEventRecord, ChronoDayRecord } from "./chrono.js";
export {
  FRENCH_STORAGE_KEY,
  createFrenchConnector,
  createFrenchSameOriginConnector,
  mapFrenchRecord,
  selectFrenchRecords,
} from "./french.js";
export type { FrenchRecord, FrenchSpeakingRecord, FrenchReviewRecord } from "./french.js";
export {
  REFLECT_CONSENT_KEY,
  REFLECT_STORAGE_KEY,
  createReflectConnector,
  createReflectSameOriginConnector,
  mapReflectRecord,
  reflectConsentGranted,
  selectReflectRecords,
} from "./reflect.js";
export type { ReflectRecord, ReflectEntryRecord } from "./reflect.js";
export {
  RAPPORT_STORAGE_KEY,
  createRapportConnector,
  createRapportSameOriginConnector,
  mapRapportRecord,
  selectRapportRecords,
} from "./rapport.js";
export type { RapportRecord, RapportDrillRecord, RapportChallengeRecord } from "./rapport.js";
export { createSourceHistory, migrateSourceHistory, readSourceHistoryRecords } from "../events/source-history.js";
export type { SourceHistoryEnvelope } from "../events/source-history.js";
// --- The shared health vocabulary and the sources that speak it ------------
export * from "./health-events.js";
export {
  createAppleHealthConnector,
  createHealthConnectConnector,
  createHealthPlatformConnector,
  healthRecordTimestamp,
  mapHealthRecord,
} from "./health.js";
export type {
  HealthActivityRecord,
  HealthBodyRecord,
  HealthMapOptions,
  HealthPlatform,
  HealthRecord,
  HealthSleepRecord,
  HealthVitalsRecord,
  HealthWorkoutRecord,
} from "./health.js";

export {
  WEARABLE_VENDORS,
  createFitbitConnector,
  createGarminConnector,
  createOuraConnector,
  createWearableConnector,
  createWhoopConnector,
  mapWearableRecord,
  wearableRecordTimestamp,
} from "./wearables.js";
export type {
  WearableBodyRecord,
  WearableDailyRecord,
  WearableMapOptions,
  WearableRecord,
  WearableScoreRecord,
  WearableSleepRecord,
  WearableVendor,
  WearableWorkoutRecord,
} from "./wearables.js";

export {
  calendarRecordTimestamp,
  createCalendarConnector,
  createGoogleCalendarConnector,
  createOutlookCalendarConnector,
  isCommitment,
  mapCalendarRecord,
  summariseCalendarDay,
} from "./calendar.js";
export type {
  CalendarAvailability,
  CalendarDayRecord,
  CalendarDaySlot,
  CalendarEventRecord,
  CalendarProvider,
  CalendarRecord,
  CalendarResponse,
  DayShapeOptions,
} from "./calendar.js";

// --- Bring your own file ---------------------------------------------------
export {
  assertValidMapping,
  createFileImportConnector,
  parseCsv,
  parseJsonRecords,
  parseNumericCell,
  parseTimestampCell,
  previewImport,
} from "./tabular.js";
export type {
  AttributeMapping,
  ImportMapping,
  ImportPreview,
  MetricMapping,
  RowProblem,
  TabularRow,
  TimestampFormat,
} from "./tabular.js";

// --- Making sense of several sources at once -------------------------------
export { reconcileEvents } from "./reconcile.js";
export type {
  DuplicateGroup,
  ReconcileOptions,
  ReconciliationReport,
  ReconciliationResult,
  SourceReconciliation,
  SupersededEvent,
} from "./reconcile.js";

export { buildConnectorDashboard, freshnessSummary } from "./dashboard.js";
export type {
  AttentionItem,
  ConnectorCard,
  ConnectorDashboard,
  CoverageGap,
  DashboardOptions,
  Freshness,
} from "./dashboard.js";
