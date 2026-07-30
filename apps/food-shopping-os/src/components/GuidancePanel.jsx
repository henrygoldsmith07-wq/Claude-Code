import { lazy, Suspense, useMemo, useState } from 'react';
import {
  BarChart3, ChevronRight, Lightbulb, MessageCircle, Plus, Wrench,
} from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { guidanceFor } from '../lib/guidance.js';
import { CORE_LOOP } from '../data/optionalTools.js';
import { Card, Chip, Pill } from './ui.jsx';

const AnalyticsPanel = lazy(() => import('./AnalyticsPanel.jsx'));
const ReportsPanel = lazy(() => import('./ReportsPanel.jsx'));
const SmartFeaturesPanel = lazy(() => import('./SmartFeaturesPanel.jsx'));
const AdvancedPanel = lazy(() => import('./AdvancedPanel.jsx'));
const AiAssistant = lazy(() => import('./AiAssistant.jsx'));
const AddToolsPanel = lazy(() => import('./AddToolsPanel.jsx'));

const Loading = () => (
  <div role="status" className="px-5 py-12 text-center text-[0.8125rem] font-semibold" style={{ color: 'var(--muted)' }}>
    Opening your evidence…
  </div>
);

export default function GuidancePanel({ initialView = 'next', onNavigate, onOpenPantry, onOpenProfile }) {
  const app = useApp();
  const hasReports = app.hasTool('reports');
  const hasAssistant = app.hasTool('assistant');
  const hasAdvancedHealth = app.hasTool('carbon') || app.hasTool('bloods') || app.hasTool('fasting');

  const tabs = useMemo(() => {
    const list = [
      ['next', 'Next', Lightbulb],
      ['add', 'Add tools', Plus],
    ];
    if (hasReports) list.splice(1, 0, ['review', 'Review', BarChart3]);
    // Core shopping predictions stay under Tools when useful; advanced health only when opted in
    list.push(['tools', 'Tools', Wrench]);
    if (hasAssistant) list.push(['ask', 'Ask', MessageCircle]);
    return list;
  }, [hasReports, hasAssistant]);

  const allowedViews = new Set(tabs.map(([key]) => key));
  const [view, setView] = useState(() => (allowedViews.has(initialView) ? initialView : 'next'));
  const activeView = allowedViews.has(view) ? view : 'next';
  const [reviewMode, setReviewMode] = useState('dashboards');
  const [toolMode, setToolMode] = useState('smart');
  const items = useMemo(() => guidanceFor(app), [app]);
  const primary = items[0];

  const act = (item) => {
    const { action } = item;
    if (action.kind === 'view') {
      if (action.target === 'review' && !hasReports) return setView('add');
      if (action.target === 'tools') return setView('tools');
      if (action.target === 'ask' && !hasAssistant) return setView('add');
      return setView(action.target);
    }
    if (action.kind === 'pantry') return onOpenPantry();
    if (action.kind === 'profile') return onOpenProfile();
    if (action.kind === 'log') return onNavigate('log', 'add');
    return onNavigate(action.target);
  };

  return (
    <div className="pb-10">
      <div className="px-5 pb-4">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
          What matters now
        </p>
        <p className="text-[0.75rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>
          Ranked from your plan, pantry and shops. Secondary tools stay under Add tools until you enable them.
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar" aria-label="Guidance sections">
          {tabs.map(([key, label, Icon]) => (
            <Chip key={key} active={activeView === key} onClick={() => setView(key)}>
              <span className="inline-flex items-center gap-1.5"><Icon size={13} /> {label}</span>
            </Chip>
          ))}
        </div>
      </div>

      {activeView === 'next' && (
        <div className="px-5 space-y-3">
          <Card className="!p-4">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>
              Core loop
            </p>
            <p className="mt-1 text-[0.78125rem] font-semibold" style={{ color: 'var(--muted)' }}>
              {CORE_LOOP.map((s) => s.label).join(' · ')} · repeat
            </p>
          </Card>

          <Card className="!p-5" style={{ borderColor: primary.tone === 'warn' ? 'var(--warn)' : 'var(--line)' }}>
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>{primary.label}</p>
            <h3 className="mt-1 text-[1.25rem] font-extrabold tracking-tight">{primary.title}</h3>
            <p className="mt-1.5 text-[0.8125rem] font-semibold leading-relaxed" style={{ color: 'var(--muted)' }}>{primary.reason}</p>
            <div className="mt-4 grid gap-3">
              <div><Pill tone={primary.tone || 'muted'}>{primary.evidence}</Pill></div>
              <button type="button" onClick={() => act(primary)} className="press w-full rounded-xl px-4 py-2.5 text-[0.8125rem] font-extrabold" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                {primary.actionLabel}
              </button>
            </div>
            {primary.setupId && (
              <button type="button" onClick={() => app.dismissSetupStep(primary.setupId)} className="tap press mt-2 text-[0.75rem] font-bold" style={{ color: 'var(--muted)' }}>
                Not now
              </button>
            )}
          </Card>

          {items.length > 1 && (
            <section aria-labelledby="guidance-later">
              <div className="mb-2 flex items-center justify-between">
                <h3 id="guidance-later" className="text-[0.8125rem] font-extrabold">After that</h3>
                <span className="text-[0.6875rem] font-semibold" style={{ color: 'var(--faint)' }}>Ranked by urgency</span>
              </div>
              <div className="overflow-hidden rounded-2xl border divide-y" style={{ borderColor: 'var(--line)' }}>
                {items.slice(1, 4).map((item) => (
                  <button key={item.id} type="button" onClick={() => act(item)} className="press flex w-full items-center gap-3 p-3.5 text-left" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] font-extrabold">{item.title}</span>
                      <span className="mt-0.5 block text-[0.71875rem] font-semibold" style={{ color: 'var(--muted)' }}>{item.evidence}</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0" style={{ color: 'var(--faint)' }} />
                  </button>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={() => setView('add')}
            className="press w-full rounded-2xl border py-3 text-[0.8125rem] font-extrabold"
            style={{ borderColor: 'var(--line)' }}
          >
            <span className="inline-flex items-center gap-1.5"><Plus size={14} /> Add tools (exercise, reports, receipts…)</span>
          </button>
        </div>
      )}

      {activeView === 'add' && (
        <Suspense fallback={<Loading />}>
          <AddToolsPanel />
        </Suspense>
      )}

      {activeView === 'review' && hasReports && (
        <>
          <div className="px-5 pb-4 flex gap-2">
            <Chip active={reviewMode === 'dashboards'} onClick={() => setReviewMode('dashboards')}>Dashboards</Chip>
            <Chip active={reviewMode === 'reports'} onClick={() => setReviewMode('reports')}>Reports & export</Chip>
          </div>
          <Suspense fallback={<Loading />}>
            {reviewMode === 'dashboards' ? <AnalyticsPanel /> : <ReportsPanel />}
          </Suspense>
        </>
      )}

      {activeView === 'tools' && (
        <>
          <div className="px-5 pb-4 flex gap-2">
            <Chip active={toolMode === 'smart'} onClick={() => setToolMode('smart')}>Predictions</Chip>
            {hasAdvancedHealth && (
              <Chip active={toolMode === 'advanced'} onClick={() => setToolMode('advanced')}>Health & impact</Chip>
            )}
            <Chip active={toolMode === 'add'} onClick={() => setToolMode('add')}>Add tools</Chip>
          </div>
          <Suspense fallback={<Loading />}>
            {toolMode === 'add' && <AddToolsPanel />}
            {toolMode === 'smart' && (
              <SmartFeaturesPanel
                onOpenAssistant={hasAssistant ? () => setView('ask') : () => setView('add')}
                hideReceipt={!app.hasTool('receipt')}
                hideAssistant={!hasAssistant}
              />
            )}
            {toolMode === 'advanced' && hasAdvancedHealth && <AdvancedPanel />}
          </Suspense>
        </>
      )}

      {activeView === 'ask' && hasAssistant && (
        <Suspense fallback={<Loading />}>
          <AiAssistant />
        </Suspense>
      )}
    </div>
  );
}
