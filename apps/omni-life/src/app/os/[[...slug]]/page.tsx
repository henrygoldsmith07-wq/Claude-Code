import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findNode, nodeHref } from '@/lib/os/tree';
import TileGrid, { StatusBadge } from '@/components/os/tile-grid';
import WorkflowPanel from '@/components/os/workflow-panel';

export default function OsPage({ params }: { params: { slug?: string[] } }) {
  const resolved = findNode(params.slug ?? []);
  if (!resolved) notFound();
  const { node, trail } = resolved;

  // '' at the root (all areas), area slug at levels below it
  const workflowScope = trail.length === 1 ? '' : trail[1].slug;

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

        <WorkflowPanel scope={workflowScope} />

        {node.children ? (
          <TileGrid node={node} trail={trail} />
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
