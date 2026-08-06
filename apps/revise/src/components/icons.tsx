// ---------------------------------------------------------------------------
// The icon vocabulary, in one file.
//
// Lucide is the monorepo's icon pack: Forq imports `lucide-react` directly and
// Le Studio hand-rolls the same stroke style to avoid a dependency. This app
// takes Lucide as a package (it is TypeScript, so typed exports beat a ported
// JSX file) but keeps Le Studio's convention of naming icons by *role* rather
// than by shape. Screens import `Review`, not `Layers` — so changing what a
// review looks like is a one-line edit here rather than a search across a
// dozen files.
//
// Everything is stroke-only on `currentColor`, so icons inherit the Le Studio
// ink tokens and flip with the theme like any other text.
// ---------------------------------------------------------------------------

import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Camera,
  ChartLine,
  Check,
  ChevronRight,
  CircleHelp,
  Clock,
  FileText,
  Flame,
  LayoutGrid,
  Layers,
  Mic,
  MicOff,
  PenLine,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  Trophy,
  WifiOff,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type { LucideIcon };

// --- navigation -------------------------------------------------------------
/** The dashboard: what to do right now. */
export const TodayIcon = Target;
/** Spaced-repetition review — a stack of cards. */
export const ReviewIcon = Layers;
/** Answering exam questions. */
export const PracticeIcon = PenLine;
/** The revision timetable. */
export const PlanIcon = Calendar;
/** Analytics and predicted grades. */
export const ProgressIcon = ChartLine;
/** Uploaded past papers. */
export const PapersIcon = FileText;
/** The curriculum and card decks. */
export const LibraryIcon = BookOpen;
/** The card browser — a grid of everything, for maintenance. */
export const CardsIcon = LayoutGrid;
/** The Socratic tutor. */
export const TutorIcon = Sparkles;
export const SettingsIcon = Settings;
export const SearchIcon = Search;

// --- actions and status -----------------------------------------------------
export const DictateIcon = Mic;
export const DictateStopIcon = MicOff;
export const PhotoIcon = Camera;
/** A mark-scheme point the answer earned. */
export const CreditedIcon = Check;
/** A mark-scheme point the answer missed. */
export const MissedIcon = X;
export const BackIcon = ArrowLeft;
export const ForwardIcon = ChevronRight;
export const StreakIcon = Flame;
export const AchievementIcon = Trophy;
export const TimerIcon = Clock;
export const OfflineIcon = WifiOff;
export const SyncIcon = RefreshCw;
export const DeleteIcon = Trash2;
export const WarningIcon = TriangleAlert;
export const HelpIcon = CircleHelp;

/** Sizes used across the app. Anything outside these is a design mistake. */
export const ICON_SIZE = {
  /** Inline with body text and inside pills. */
  sm: 14,
  /** Nav rails, buttons, list rows. */
  md: 16,
  /** Mobile tab bar and empty states. */
  lg: 20,
} as const;
