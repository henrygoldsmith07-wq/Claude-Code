"use client";

import katex from "katex";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Content rendering for STEM revision: inline `$…$` and display `$$…$$` maths
// via KaTeX, plus the small subset of markdown the AI prompts and the authored
// content actually use. Deliberately not a full markdown engine — the input is
// ours, the output is inserted into the DOM, and a small hand-checked grammar
// is far easier to keep safe than a general one.
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMath(expression: string, displayMode: boolean): string {
  try {
    return katex.renderToString(expression, { displayMode, throwOnError: false, output: "html" });
  } catch {
    return escapeHtml(expression);
  }
}

/** Inline emphasis, code and maths. Input is escaped before any markup runs. */
function inline(text: string): string {
  let out = escapeHtml(text);
  // Maths first: its contents must not be treated as markdown.
  out = out.replace(/\$\$([^$]+)\$\$/g, (_, expr: string) => renderMath(decode(expr), true));
  out = out.replace(/\$([^$\n]+)\$/g, (_, expr: string) => renderMath(decode(expr), false));
  out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-surface2 text-[0.9em]">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink">$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return out;
}

function decode(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

export function toHtml(markdown: string): string {
  const blocks = markdown.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("");
        return `<ul class="list-disc pl-5 space-y-1">${items}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("");
        return `<ol class="list-decimal pl-5 space-y-1">${items}</ol>`;
      }
      const heading = block.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length + 2;
        return `<h${level} class="font-semibold text-ink mt-1">${inline(heading[2])}</h${level}>`;
      }
      return `<p>${lines.map(inline).join("<br />")}</p>`;
    })
    .join("");
}

export function RichText({ children, className }: { children: string; className?: string }) {
  const html = useMemo(() => toHtml(children ?? ""), [children]);
  return (
    <div
      className={`text-sm leading-relaxed text-ink2 space-y-3 [&_h3]:text-sm [&_h4]:text-sm ${className ?? ""}`}
      // Safe by construction: every path through toHtml escapes its input
      // before adding markup, and KaTeX output is generated, not user text.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
