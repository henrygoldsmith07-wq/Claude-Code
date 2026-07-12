import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findNode, nodeHref, OsNode, OsStatus } from '@/lib/os/tree';

const statusStyles: Record<OsStatus, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  built: { label: 'Built · not deployed', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  planned: { label: 'Planned', className: 'bg-gray-500/10 text-gray-400 border-gray-600/30' },
};

function StatusBadge({ status }: { status: OsStatus }) {
  const { label, className } = statusStyles[status];
  return (
    <span className={`inline-block text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${className}`}>
      {label}
    </span>
  );
}

function Tile({ node, trail }: { node: OsNode; trail: OsNode[] }) {
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

export default function OsPage({ params }: { params: { slug?: string[] } }) {
  const resolved = findNode(params.slug ?? []);
  if (!resolved) notFound();
  const { node, trail } = resolved;

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <nav className="flex items-center flex-wrap gap-1 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300">Omni-Life</Link>
          {trail.map((crumb, i) => (
            <React.Fragment key={crumb.slug}>
              <span className="text-gray-700">/</span>
              {i < trail.length - 1 ? (
                <Link href={nodeHref(trail.slice(0, i + 1))} className="hover:text-gray-300">
                  {crumb.name}
                </Link>
              ) : (
                <span className="text-gray-300">{crumb.name}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        <header className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{node.icon}</span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{node.name}</h1>
              <p className="text-gray-500 mt-1">{node.tagline}</p>
            </div>
          </div>
          {node.description && (
            <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">{node.description}</p>
          )}
          {node.repoPath && (
            <p className="text-xs text-gray-600 font-mono">code: {node.repoPath}</p>
          )}
        </header>

        {node.children ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {node.children.map((child) => (
              <Tile key={child.slug} node={child} trail={trail} />
            ))}
          </div>
        ) : (
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 max-w-2xl">
            <StatusBadge status={node.status} />
            <p className="text-sm text-gray-400 mt-3">
              {node.status === 'planned'
                ? 'Not built yet — this tile marks the gap so the OS shows the whole map, not just what exists.'
                : 'This system lives outside the hub. Add its URL as href in src/lib/os/tree.ts to link the tile straight to it.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
