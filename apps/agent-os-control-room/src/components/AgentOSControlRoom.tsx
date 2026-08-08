"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpCircle,
  BookOpen,
  Bot,
  Cable,
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Copy,
  Download,
  FileBarChart,
  FileText,
  Headphones,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Library,
  Link2,
  ListChecks,
  Loader2,
  Network,
  PlayCircle,
  Plus,
  Presentation,
  Send,
  Settings2,
  Sparkles,
  StickyNote,
  Terminal,
  X,
  Zap,
} from "lucide-react";

// ---------- Types ----------

type ViewId = "overview" | "notebooks" | "studio" | "memory" | "distribution";
type SourceType = "pdf" | "url" | "note";
type NotebookStatus = "active" | "syncing" | "idle";
type AssetType =
  | "podcast"
  | "video"
  | "slides"
  | "infographic"
  | "flashcards"
  | "quiz"
  | "report";
type AssetStatus = "idle" | "generating" | "ready";
type LogLevel = "info" | "success" | "sync";

interface NotebookSource {
  type: SourceType;
  label: string;
}

interface Notebook {
  id: string;
  name: string;
  description: string;
  sources: NotebookSource[];
  status: NotebookStatus;
}

interface GeneratedAsset {
  id: string;
  notebookId: string;
  type: AssetType;
  title: string;
  createdAt: string;
  previewText: string;
}

interface TerminalLogEntry {
  id: string;
  timestamp: string;
  text: string;
  level: LogLevel;
}

interface AssetGenerationState {
  status: AssetStatus;
  progress: number;
}

interface ConnectForm {
  name: string;
  sourceUrl: string;
  sourceType: SourceType;
}

// ---------- Mock data & config ----------

const NAV_ITEMS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "notebooks", label: "Notebook Library", icon: Library },
  { id: "studio", label: "Content Studio", icon: Sparkles },
  { id: "memory", label: "Memory Vault", icon: Network },
  { id: "distribution", label: "Post & Distribution", icon: Send },
];

const ASSET_TYPES: {
  id: AssetType;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  durationMs: number;
}[] = [
  { id: "podcast", label: "Audio Overview", sublabel: "Podcast", icon: Headphones, durationMs: 2600 },
  { id: "video", label: "Video Agent", sublabel: "Hermes", icon: Clapperboard, durationMs: 3200 },
  { id: "slides", label: "Slide Deck", sublabel: "Presentation", icon: Presentation, durationMs: 2400 },
  { id: "infographic", label: "Infographic", sublabel: "Visual Summary", icon: ImageIcon, durationMs: 2000 },
  { id: "flashcards", label: "Flashcards", sublabel: "Study Set", icon: Layers, durationMs: 1800 },
  { id: "quiz", label: "Quiz", sublabel: "Knowledge Check", icon: ListChecks, durationMs: 1800 },
  { id: "report", label: "Report", sublabel: "Written Summary", icon: FileBarChart, durationMs: 2200 },
];

const MOCK_PREVIEW_TEXT: Record<AssetType, (notebookName: string) => string> = {
  podcast: (n) =>
    `[INTRO MUSIC FADES] Welcome back to the Boardroom Briefing — today we're pulling insights straight from "${n}", breaking down what's actually working right now...`,
  video: (n) =>
    `SCENE 1 — Hook (0:00-0:05): bold on-screen text summarizing the core insight from "${n}". Hermes Agent: render B-roll overlay, sync captions, export MP4.`,
  slides: (n) =>
    `Slide 1: Title — Key Takeaways from "${n}". Slide 2: The Problem. Slide 3: The Framework. Slide 4: Case Study. Slide 5: Action Plan.`,
  infographic: (n) =>
    `Visual summary layout for "${n}": header stat callout, 4-step process diagram, comparison table, footer CTA.`,
  flashcards: (n) =>
    `Card 1 — Q: What is the core thesis of "${n}"? A: ... Card 2 — Q: Key risk factor? A: ... (18 cards generated)`,
  quiz: (n) =>
    `Q1. Which strategy from "${n}" had the highest reported ROI? (A/B/C/D) — 10 questions generated, difficulty: intermediate.`,
  report: (n) =>
    `Executive Summary — "${n}": key findings, supporting data points, and recommended next actions compiled from all connected sources.`,
};

const LOOP_TASKS = [
  'Hermes Video Agent rendering script for "AI Profit Boardroom"...',
  "Audio synthesis agent mixing podcast overview...",
  "Memory sync agent embedding new nodes into vault...",
  "Slide agent laying out deck typography...",
  "Distribution agent queuing posts for review...",
  'Research agent cross-referencing sources in "SEO Hacks"...',
];

const TERMINAL_TEMPLATES: { level: LogLevel; build: (notebookName: string) => string }[] = [
  { level: "sync", build: (n) => `[MEMORY] Embedding new nodes from "${n}" into vault graph...` },
  { level: "info", build: (n) => `[AGENT] Watching "${n}" for updated sources...` },
  { level: "success", build: (n) => `[LOOP] Long-term context link established for "${n}".` },
  { level: "info", build: (n) => `[SYNC] Cross-referencing "${n}" against existing memory nodes...` },
  { level: "sync", build: (n) => `[MEMORY] Auto-saved generated asset context for "${n}".` },
];

const INITIAL_NOTEBOOKS: Notebook[] = [
  {
    id: "nb-1",
    name: "AI Profit Boardroom",
    description: "Monetization playbooks and case studies for AI-driven businesses.",
    sources: [
      { type: "pdf", label: "6 PDFs" },
      { type: "url", label: "14 URLs" },
      { type: "note", label: "9 Notes" },
    ],
    status: "active",
  },
  {
    id: "nb-2",
    name: "SEO Hacks",
    description: "Technical SEO experiments and ranking signal research.",
    sources: [
      { type: "pdf", label: "2 PDFs" },
      { type: "url", label: "22 URLs" },
      { type: "note", label: "5 Notes" },
    ],
    status: "active",
  },
  {
    id: "nb-3",
    name: "Faceless Channel Lab",
    description: "Scripts, hooks, and retention data for automated video channels.",
    sources: [
      { type: "pdf", label: "1 PDF" },
      { type: "url", label: "8 URLs" },
      { type: "note", label: "17 Notes" },
    ],
    status: "idle",
  },
];

const INITIAL_TERMINAL_LOGS: TerminalLogEntry[] = [
  { id: "log-seed-1", timestamp: "00:00:01", text: "[SYSTEM] Agent OS Control Room initialized.", level: "info" },
  { id: "log-seed-2", timestamp: "00:00:02", text: "[MEMORY] Vault connection established — 128 nodes indexed.", level: "sync" },
  { id: "log-seed-3", timestamp: "00:00:03", text: "[LOOP] Watching 3 notebooks for new sources.", level: "success" },
];

const VAULT_NODES = [
  { id: "n1", label: "AI Profit Boardroom", x: 20, y: 25 },
  { id: "n2", label: "SEO Hacks", x: 72, y: 15 },
  { id: "n3", label: "Faceless Channel Lab", x: 50, y: 55 },
  { id: "n4", label: "Content Studio Output", x: 22, y: 78 },
  { id: "n5", label: "Distribution Queue", x: 78, y: 70 },
  { id: "n6", label: "Loop Memory", x: 50, y: 22 },
];

const VAULT_EDGES: [string, string][] = [
  ["n1", "n6"],
  ["n2", "n6"],
  ["n3", "n6"],
  ["n1", "n4"],
  ["n3", "n4"],
  ["n3", "n5"],
  ["n4", "n5"],
];

const SOURCE_ICON: Record<SourceType, LucideIcon> = {
  pdf: FileText,
  url: Link2,
  note: StickyNote,
};

const STATUS_DOT: Record<NotebookStatus, string> = {
  active: "bg-emerald-500",
  syncing: "bg-amber-400",
  idle: "bg-zinc-600",
};

const STATUS_LABEL: Record<NotebookStatus, string> = {
  active: "Active",
  syncing: "Syncing",
  idle: "Idle",
};

const INITIAL_ASSET_GENERATION: Record<AssetType, AssetGenerationState> = ASSET_TYPES.reduce(
  (acc, config) => {
    acc[config.id] = { status: "idle", progress: 0 };
    return acc;
  },
  {} as Record<AssetType, AssetGenerationState>
);

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-gen-${idCounter}`;
}

// ---------- Small shared pieces ----------

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "zinc",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "zinc" | "emerald" | "violet";
}) {
  const toneClasses =
    tone === "emerald"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : tone === "violet"
        ? "text-violet-400 bg-violet-500/10 border-violet-500/20"
        : "text-zinc-300 bg-zinc-800/60 border-zinc-700/50";

  return (
    <div className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-zinc-100">{value}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClasses}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function Sidebar({
  activeView,
  onNavigate,
}: {
  activeView: ViewId;
  onNavigate: (view: ViewId) => void;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
          <Zap className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">Agent OS</p>
          <p className="text-xs text-zinc-500">Control Room</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15">
            <Bot className="h-4 w-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-zinc-200">ARIA-7</p>
            <p className="truncate text-[11px] text-zinc-500">Digital AI Avatar</p>
          </div>
          <Settings2 className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-500" />
        </div>
      </div>
    </aside>
  );
}

// ---------- Overview ----------

function OverviewView({
  activeNotebookCount,
  contentAssetsGenerated,
  nodesSynced,
  pendingSocialPosts,
  loopTaskIndex,
}: {
  activeNotebookCount: number;
  contentAssetsGenerated: number;
  nodesSynced: number;
  pendingSocialPosts: number;
  loopTaskIndex: number;
}) {
  const avatarFields: [string, string][] = [
    ["Persona", "ARIA-7"],
    ["Voice Model", "Hermes-Neural-v3"],
    ["Autonomy Level", "Supervised"],
    ["Memory Backend", "Obsidian Vault Sync"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Command Center</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live status across your notebooks, content agents, and memory loops.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={BookOpen} label="Active Notebooks" value={activeNotebookCount} tone="emerald" />
        <MetricCard icon={Layers} label="Content Assets Generated" value={contentAssetsGenerated} tone="violet" />
        <MetricCard icon={Network} label="Nodes Synced to Memory" value={nodesSynced} tone="emerald" />
        <MetricCard icon={Send} label="Pending Social Posts" value={pendingSocialPosts} tone="zinc" />
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">Loop Active</p>
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-100">
          <Zap className="h-4 w-4 shrink-0 text-emerald-400" />
          {LOOP_TASKS[loopTaskIndex]}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-semibold text-zinc-200">Digital AI Avatar Configuration</p>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {avatarFields.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-zinc-800/50 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
              <dd className="mt-0.5 text-sm text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ---------- Notebook Library ----------

function NotebookLibraryView({
  notebooks,
  onOpenConnectModal,
}: {
  notebooks: Notebook[];
  onOpenConnectModal: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Notebook Library</h1>
          <p className="mt-1 text-sm text-zinc-500">Layer 1 · Capture sources into active notebooks.</p>
        </div>
        <button
          type="button"
          onClick={onOpenConnectModal}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          <Cable className="h-4 w-4" />
          Connect New Notebook via MCP Bridge
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {notebooks.map((notebook) => (
          <div
            key={notebook.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-zinc-700"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-100">{notebook.name}</h3>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-400">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[notebook.status]}`} />
                {STATUS_LABEL[notebook.status]}
              </span>
            </div>
            <p className="text-xs text-zinc-500">{notebook.description}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {notebook.sources.map((source) => {
                const Icon = SOURCE_ICON[source.type];
                return (
                  <span
                    key={source.type}
                    className="flex items-center gap-1.5 rounded-md bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-400"
                  >
                    <Icon className="h-3 w-3" />
                    {source.label}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectNotebookModal({
  isOpen,
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  form: ConnectForm;
  onChange: (form: ConnectForm) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cable className="h-4 w-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Connect via MCP Bridge</h2>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-400">Notebook Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="e.g. Client Onboarding Vault"
              className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-400">Source URL</span>
            <input
              required
              value={form.sourceUrl}
              onChange={(e) => onChange({ ...form, sourceUrl: e.target.value })}
              placeholder="https://..."
              className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-400">Source Type</span>
            <select
              value={form.sourceType}
              onChange={(e) => onChange({ ...form, sourceType: e.target.value as SourceType })}
              className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              <option value="pdf">PDF</option>
              <option value="url">URL</option>
              <option value="note">Note</option>
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Connect via Bridge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Content Studio ----------

function AssetGenerateCard({
  config,
  state,
  previewText,
  onGenerate,
  onReset,
}: {
  config: (typeof ASSET_TYPES)[number];
  state: AssetGenerationState;
  previewText: string | null;
  onGenerate: () => void;
  onReset: () => void;
}) {
  const Icon = config.icon;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-400">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-100">{config.label}</p>
          <p className="text-xs text-zinc-500">{config.sublabel}</p>
        </div>
      </div>

      {state.status === "idle" && (
        <button
          type="button"
          onClick={onGenerate}
          className="mt-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-500"
        >
          Generate
        </button>
      )}

      {state.status === "generating" && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-violet-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating...
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <div className="mt-1 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Asset Ready
          </div>
          <p className="line-clamp-3 rounded-lg bg-zinc-800/60 p-2.5 text-[11px] leading-relaxed text-zinc-400">
            {previewText}
          </p>
          <button
            type="button"
            onClick={onReset}
            className="self-start text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

function ContentStudioView({
  notebooks,
  selectedNotebookId,
  onSelectNotebook,
  assetGeneration,
  generatedAssets,
  onGenerate,
  onReset,
}: {
  notebooks: Notebook[];
  selectedNotebookId: string;
  onSelectNotebook: (id: string) => void;
  assetGeneration: Record<AssetType, AssetGenerationState>;
  generatedAssets: GeneratedAsset[];
  onGenerate: (type: AssetType) => void;
  onReset: (type: AssetType) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Content Studio</h1>
        <p className="mt-1 text-sm text-zinc-500">Layer 2 · Generate assets from an active notebook.</p>
      </div>

      <label className="flex max-w-sm flex-col gap-1.5">
        <span className="text-xs text-zinc-400">Active Notebook</span>
        <select
          value={selectedNotebookId}
          onChange={(e) => onSelectNotebook(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
        >
          {notebooks.map((notebook) => (
            <option key={notebook.id} value={notebook.id}>
              {notebook.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ASSET_TYPES.map((config) => {
          const latestAsset = [...generatedAssets].reverse().find((asset) => asset.type === config.id);
          return (
            <AssetGenerateCard
              key={config.id}
              config={config}
              state={assetGeneration[config.id]}
              previewText={latestAsset?.previewText ?? null}
              onGenerate={() => onGenerate(config.id)}
              onReset={() => onReset(config.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------- Memory Vault ----------

function MemoryVaultView({
  terminalLogs,
  terminalEndRef,
  newSourceInput,
  onNewSourceChange,
  onDropSource,
}: {
  terminalLogs: TerminalLogEntry[];
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  newSourceInput: string;
  onNewSourceChange: (value: string) => void;
  onDropSource: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Memory Vault</h1>
        <p className="mt-1 text-sm text-zinc-500">Layers 3 &amp; 4 · Obsidian graph sync and long-term loops.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Knowledge Graph</p>
          <svg viewBox="0 0 100 100" className="h-72 w-full">
            {VAULT_EDGES.map(([fromId, toId]) => {
              const from = VAULT_NODES.find((n) => n.id === fromId)!;
              const to = VAULT_NODES.find((n) => n.id === toId)!;
              return (
                <line
                  key={`${fromId}-${toId}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgb(16 185 129 / 0.35)"
                  strokeWidth="0.4"
                />
              );
            })}
            {VAULT_NODES.map((node) => (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r="2.6" fill="rgb(9 9 11)" stroke="rgb(52 211 153)" strokeWidth="0.6" />
                <text x={node.x} y={node.y + 6} textAnchor="middle" fontSize="3" fill="rgb(161 161 170)">
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="flex flex-col rounded-xl border border-zinc-800 bg-black p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Agent Activity Log</p>
          </div>
          <div className="h-72 flex-1 overflow-y-auto font-mono text-xs leading-relaxed">
            {terminalLogs.map((entry) => (
              <div
                key={entry.id}
                className={`flex gap-2 py-0.5 ${entry.level === "info" ? "text-zinc-400" : "text-emerald-400"}`}
              >
                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="shrink-0 text-zinc-600">{entry.timestamp}</span>
                <span>{entry.text}</span>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>

      <form
        className="flex max-w-lg items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onDropSource();
        }}
      >
        <input
          value={newSourceInput}
          onChange={(e) => onNewSourceChange(e.target.value)}
          placeholder="Drop a new source (URL, filename, note title)..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <ArrowUpCircle className="h-4 w-4" />
          Drop Source
        </button>
      </form>
    </div>
  );
}

// ---------- Post & Distribution ----------

function DistributionAssetCard({
  asset,
  notebookName,
  isCopied,
  isPosted,
  onCopy,
  onDownload,
  onPost,
}: {
  asset: GeneratedAsset;
  notebookName: string;
  isCopied: boolean;
  isPosted: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onPost: () => void;
}) {
  const config = ASSET_TYPES.find((a) => a.id === asset.type)!;
  const Icon = config.icon;
  const OverlayIcon = asset.type === "video" || asset.type === "podcast" ? PlayCircle : ImageIcon;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="relative flex h-28 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950">
        <Icon className="h-6 w-6 text-violet-400" />
        <OverlayIcon className="absolute bottom-2 right-2 h-4 w-4 text-zinc-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-100">{asset.title}</p>
        <p className="text-xs text-zinc-500">
          {notebookName} · {asset.createdAt}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-700"
        >
          {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {isCopied ? "Copied" : "Copy Script/Text"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-700"
        >
          <Download className="h-3.5 w-3.5" />
          Download Asset
        </button>
        <button
          type="button"
          onClick={onPost}
          disabled={isPosted}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
            isPosted ? "cursor-default bg-emerald-500/15 text-emerald-400" : "bg-violet-600 text-white hover:bg-violet-500"
          }`}
        >
          {isPosted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
          {isPosted ? "Posted" : "Post to Socials"}
        </button>
      </div>
    </div>
  );
}

function DistributionView({
  generatedAssets,
  notebooks,
  postedAssetIds,
  copiedAssetId,
  onCopy,
  onDownload,
  onPost,
}: {
  generatedAssets: GeneratedAsset[];
  notebooks: Notebook[];
  postedAssetIds: Set<string>;
  copiedAssetId: string | null;
  onCopy: (asset: GeneratedAsset) => void;
  onDownload: (asset: GeneratedAsset) => void;
  onPost: (assetId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Post &amp; Distribution</h1>
        <p className="mt-1 text-sm text-zinc-500">Layer 5 · Ship finished assets out to the world.</p>
      </div>

      {generatedAssets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
          <p className="text-sm text-zinc-500">
            No assets yet — head to Content Studio to generate your first one.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...generatedAssets].reverse().map((asset) => (
            <DistributionAssetCard
              key={asset.id}
              asset={asset}
              notebookName={notebooks.find((n) => n.id === asset.notebookId)?.name ?? "Unknown Notebook"}
              isCopied={copiedAssetId === asset.id}
              isPosted={postedAssetIds.has(asset.id)}
              onCopy={() => onCopy(asset)}
              onDownload={() => onDownload(asset)}
              onPost={() => onPost(asset.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Root component ----------

export default function AgentOSControlRoom() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [notebooks, setNotebooks] = useState<Notebook[]>(INITIAL_NOTEBOOKS);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectForm, setConnectForm] = useState<ConnectForm>({ name: "", sourceUrl: "", sourceType: "url" });
  const [selectedNotebookId, setSelectedNotebookId] = useState(INITIAL_NOTEBOOKS[0].id);
  const [assetGeneration, setAssetGeneration] = useState(INITIAL_ASSET_GENERATION);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [loopTaskIndex, setLoopTaskIndex] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>(INITIAL_TERMINAL_LOGS);
  const [newSourceInput, setNewSourceInput] = useState("");
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);
  const [postedAssetIds, setPostedAssetIds] = useState<Set<string>>(new Set());

  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<{ timeouts: number[]; intervals: number[] }>({ timeouts: [], intervals: [] });
  const notebooksRef = useRef(notebooks);

  useEffect(() => {
    notebooksRef.current = notebooks;
  }, [notebooks]);

  const appendLog = useCallback((text: string, level: LogLevel) => {
    setTerminalLogs((prev) =>
      [...prev, { id: nextId("log"), timestamp: new Date().toLocaleTimeString(), text, level }].slice(-40)
    );
  }, []);

  // Loop Indicator ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      setLoopTaskIndex((i) => (i + 1) % LOOP_TASKS.length);
    }, 3200);
    timersRef.current.intervals.push(interval);
    return () => clearInterval(interval);
  }, []);

  // Terminal auto-append (reads notebooksRef so it never goes stale without restarting the interval)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const template = TERMINAL_TEMPLATES[Math.floor(Math.random() * TERMINAL_TEMPLATES.length)];
      const pool = notebooksRef.current;
      const notebook = pool[Math.floor(Math.random() * pool.length)];
      appendLog(template.build(notebook.name), template.level);
    }, 2500);
    timersRef.current.intervals.push(interval);
    return () => clearInterval(interval);
  }, [appendLog]);

  // Terminal auto-scroll
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Sweep every timer on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.timeouts.forEach((id) => clearTimeout(id));
      timers.intervals.forEach((id) => clearInterval(id));
    };
  }, []);

  const handleConnectSubmit = useCallback(() => {
    const id = nextId("nb");
    const sourceTypeLabel =
      connectForm.sourceType === "pdf" ? "PDF" : connectForm.sourceType === "url" ? "URL" : "Note";
    const newNotebook: Notebook = {
      id,
      name: connectForm.name.trim() || "Untitled Notebook",
      description: `Connected via MCP Bridge from ${connectForm.sourceUrl || "a new source"}.`,
      sources: [{ type: connectForm.sourceType, label: `1 ${sourceTypeLabel}` }],
      status: "syncing",
    };
    setNotebooks((prev) => [...prev, newNotebook]);
    setIsConnectModalOpen(false);
    appendLog(`[BRIDGE] Connecting "${newNotebook.name}" via MCP...`, "info");
    setConnectForm({ name: "", sourceUrl: "", sourceType: "url" });

    const timeout = window.setTimeout(() => {
      setNotebooks((prev) => prev.map((n) => (n.id === id ? { ...n, status: "active" } : n)));
      appendLog(`[BRIDGE] "${newNotebook.name}" fully synced and active.`, "success");
    }, 1800);
    timersRef.current.timeouts.push(timeout);
  }, [connectForm, appendLog]);

  const handleGenerate = useCallback(
    (type: AssetType) => {
      if (assetGeneration[type].status !== "idle") return;

      const config = ASSET_TYPES.find((a) => a.id === type)!;
      const notebook = notebooks.find((n) => n.id === selectedNotebookId) ?? notebooks[0];

      setAssetGeneration((prev) => ({ ...prev, [type]: { status: "generating", progress: 8 } }));

      const progressInterval = window.setInterval(() => {
        setAssetGeneration((prev) => {
          const current = prev[type];
          if (current.status !== "generating") return prev;
          return { ...prev, [type]: { status: "generating", progress: Math.min(current.progress + 12, 92) } };
        });
      }, 260);
      timersRef.current.intervals.push(progressInterval);

      const timeout = window.setTimeout(() => {
        clearInterval(progressInterval);
        setAssetGeneration((prev) => ({ ...prev, [type]: { status: "ready", progress: 100 } }));
        setGeneratedAssets((prev) => [
          ...prev,
          {
            id: nextId("asset"),
            notebookId: notebook.id,
            type,
            title: `${config.label} — ${notebook.name}`,
            createdAt: new Date().toLocaleTimeString(),
            previewText: MOCK_PREVIEW_TEXT[type](notebook.name),
          },
        ]);
        appendLog(`[STUDIO] ${config.label} generated for "${notebook.name}".`, "success");
      }, config.durationMs);
      timersRef.current.timeouts.push(timeout);
    },
    [assetGeneration, notebooks, selectedNotebookId, appendLog]
  );

  const handleResetAsset = useCallback((type: AssetType) => {
    setAssetGeneration((prev) => ({ ...prev, [type]: { status: "idle", progress: 0 } }));
  }, []);

  const handleDropSource = useCallback(() => {
    const trimmed = newSourceInput.trim();
    if (!trimmed) return;
    appendLog(`[MEMORY] Ingested new source: "${trimmed}"`, "sync");
    setNewSourceInput("");
  }, [newSourceInput, appendLog]);

  const handleCopy = useCallback((asset: GeneratedAsset) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(asset.previewText).catch(() => {});
    }
    setCopiedAssetId(asset.id);
    const timeout = window.setTimeout(() => {
      setCopiedAssetId((current) => (current === asset.id ? null : current));
    }, 1500);
    timersRef.current.timeouts.push(timeout);
  }, []);

  const handleDownload = useCallback((asset: GeneratedAsset) => {
    const manifest = `Title: ${asset.title}\nType: ${asset.type}\nCreated: ${asset.createdAt}\n\n${asset.previewText}`;
    const blob = new Blob([manifest], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${asset.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handlePost = useCallback(
    (assetId: string) => {
      setPostedAssetIds((prev) => {
        const next = new Set(prev);
        next.add(assetId);
        return next;
      });
      const asset = generatedAssets.find((a) => a.id === assetId);
      if (asset) {
        appendLog(`[DISTRIBUTION] "${asset.title}" posted to socials.`, "success");
      }
    },
    [generatedAssets, appendLog]
  );

  const activeNotebookCount = notebooks.filter((n) => n.status === "active").length;
  const contentAssetsGenerated = generatedAssets.length;
  const nodesSynced = 128 + terminalLogs.filter((l) => l.level === "sync").length;
  const pendingSocialPosts = generatedAssets.filter((a) => !postedAssetIds.has(a.id)).length;

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />

      <main className="flex-1 overflow-x-hidden p-8">
        {activeView === "overview" && (
          <OverviewView
            activeNotebookCount={activeNotebookCount}
            contentAssetsGenerated={contentAssetsGenerated}
            nodesSynced={nodesSynced}
            pendingSocialPosts={pendingSocialPosts}
            loopTaskIndex={loopTaskIndex}
          />
        )}
        {activeView === "notebooks" && (
          <NotebookLibraryView notebooks={notebooks} onOpenConnectModal={() => setIsConnectModalOpen(true)} />
        )}
        {activeView === "studio" && (
          <ContentStudioView
            notebooks={notebooks}
            selectedNotebookId={selectedNotebookId}
            onSelectNotebook={setSelectedNotebookId}
            assetGeneration={assetGeneration}
            generatedAssets={generatedAssets}
            onGenerate={handleGenerate}
            onReset={handleResetAsset}
          />
        )}
        {activeView === "memory" && (
          <MemoryVaultView
            terminalLogs={terminalLogs}
            terminalEndRef={terminalEndRef}
            newSourceInput={newSourceInput}
            onNewSourceChange={setNewSourceInput}
            onDropSource={handleDropSource}
          />
        )}
        {activeView === "distribution" && (
          <DistributionView
            generatedAssets={generatedAssets}
            notebooks={notebooks}
            postedAssetIds={postedAssetIds}
            copiedAssetId={copiedAssetId}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onPost={handlePost}
          />
        )}
      </main>

      <ConnectNotebookModal
        isOpen={isConnectModalOpen}
        form={connectForm}
        onChange={setConnectForm}
        onClose={() => setIsConnectModalOpen(false)}
        onSubmit={handleConnectSubmit}
      />
    </div>
  );
}
