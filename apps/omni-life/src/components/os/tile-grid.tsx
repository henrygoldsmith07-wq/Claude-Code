'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { OsNode, OsStatus, nodeHref } from '@/lib/os/tree';
import { Signal, collectSignals, toneCls, DATA_EVENT } from '@/lib/os/signals';

const statusStyles: Record<OsStatus, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  built: { label: 'Built · not deployed', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  planned: { label: 'Planned', className: 'bg-gray-500/10 text-gray-400 border-gray-600/30' },
};

export function StatusBadge({ status }: { status: OsStatus }) {
  const { label, className } = statusStyles[status];
  return (
    <span className={`inline-block text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${className}`}>
      {label}
    </span>
  );
}

/**
 * Recompute a signal map for the node's children after mount (localStorage
 * is client-only) and again whenever a workflow mutates OS data.
 */
function useChildSignals(node: OsNode, basePath: string) {
  const [signals, setSignals] = useState<Record<string, Signal[]>>({});

  useEffect(() => {
    const compute = () => {
      const map: Record<string, Signal[]> = {};
      for (const child of node.children ?? []) {
        const path = basePath ? `${basePath}/${child.slug}` : child.slug;
        map[child.slug] = collectSignals(child, path, 2);
      }
      setSignals(map);
    };
    compute();
    window.addEventListener(DATA_EVENT, compute);
    return () => window.removeEventListener(DATA_EVENT, compute);
  }, [node, basePath]);

  return signals;
}

function Tile({ node, trail, signals }: { node: OsNode; trail: OsNode[]; signals: Signal[] }) {
  const inner = (
    <div className="h-full bg-gray-950 border border-gray-800 rounded-2xl p-5 transition-all duration-200 hover:border-blue-500/40 hover:bg-gray-900/60">
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{node.icon}</span>
        <StatusBadge status={node.status} />
      </div>
      <h3 className="text-lg font-semibold text-white">
        {node.name}
        {node.href && <span className="text-gray-500 text-sm ml-1">↗</span>}
      </h3>
      <p className="text-sm text-gray-500 mt-1">{node.tagline}</p>
      {signals.length > 0 && (
        <ul className="mt-3 space-y-1">
          {signals.map((s, i) => (
            <li key={i} className={`text-xs font-medium ${toneCls[s.tone]}`}>▮ {s.text}</li>
          ))}
        </ul>
      )}
      {node.children && (
        <p className="text-xs text-gray-600 mt-3 uppercase tracking-widest">
          {node.children.length} system{node.children.length === 1 ? '' : 's'} inside
        </p>
      )}
    </div>
  );

  if (node.href) {
    return (
      <a href={node.href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {inner}
      </a>
    );
  }
  return (
    <Link href={nodeHref([...trail, node])} className="block h-full">
      {inner}
    </Link>
  );
}

/** Tile dashboard for a node's children, each tile carrying the signals rolled up from its subtree. */
export default function TileGrid({ node, trail }: { node: OsNode; trail: OsNode[] }) {
  const basePath = trail.slice(1).map((n) => n.slug).join('/');
  const signals = useChildSignals(node, basePath);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {(node.children ?? []).map((child) => (
        <Tile key={child.slug} node={child} trail={trail} signals={signals[child.slug] ?? []} />
      ))}
    </div>
  );
}
