import NewsGlobe from "@/components/NewsGlobe";
import Sidebar from "@/components/Sidebar";
import { TOPIC_LINKS } from "@/lib/topics";

export default function HomePage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <Sidebar topics={TOPIC_LINKS} />

      <div className="absolute inset-0">
        <NewsGlobe worldPoints searchable />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 px-4 text-center text-xs text-muted">
        Hover to highlight · click a country for news · Ctrl/⌘+B toggles sidebar
      </div>
    </main>
  );
}
