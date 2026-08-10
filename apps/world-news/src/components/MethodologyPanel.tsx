"use client";
import { METHODOLOGY_NOTE } from "@/lib/credibility";

export default function MethodologyPanel({
  provenanceNote,
}: {
  provenanceNote?: string | null;
}) {
  return (
    <section className="rounded-xl border border-rule bg-panel p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
        How this page was built
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {provenanceNote ??
          "Claims are grounded via Google Search with live source links; timelines show observed sequences, not causes, unless an official source states causation."}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted/80">{METHODOLOGY_NOTE}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-accent hover:underline">
          Source credibility signals
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>
            <span className="font-medium text-foreground">Wire</span> — editorial standards,
            syndication breadth (+14)
          </li>
          <li>
            <span className="font-medium text-foreground">Official / document</span> — government,
            IO, transcript, report (+12)
          </li>
          <li>
            <span className="font-medium text-foreground">Newsroom</span> — established outlet (+6)
          </li>
          <li>
            <span className="font-medium text-foreground">Primary attribution</span> — cites primary
            sources (+10), <span className="font-medium">byline</span> (+4)
          </li>
          <li>
            <span className="font-medium text-foreground">Correction noted</span> — transparency
            signal (−6)
          </li>
          <li>Scores 72+ high, 48–71 medium, below low. Not a truth judgment — follow the links.</li>
        </ul>
      </details>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-accent hover:underline">
          Fact vs interpretation &amp; anti-causality
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          <span className="font-medium text-foreground">Reported facts</span> appear under
          &ldquo;Widely agreed&rdquo; with supporting sources.{" "}
          <span className="font-medium text-foreground">Interpretation</span> is phrased as
          &ldquo;analysts interpret…&rdquo; or &ldquo;coverage frames this as…&rdquo; and stays
          separate. Timelines use temporal sequencing (&ldquo;then&rdquo;, &ldquo;after&rdquo;), never
          causal (&ldquo;because&rdquo;, &ldquo;triggered&rdquo;) unless an official/investigation
          states the cause.
        </p>
      </details>
    </section>
  );
}
