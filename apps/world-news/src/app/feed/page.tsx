import Link from "next/link";
import MyFeed from "@/components/MyFeed";

export const metadata = {
  title: "My Feed — World News Globe",
};

export default function FeedPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-accent underline-offset-2 hover:underline">
        ← Back to the globe
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">My Feed</h1>
      <p className="mt-1 text-sm text-muted">
        A catch-up on the countries and topics you follow.
      </p>
      <div className="mt-6">
        <MyFeed />
      </div>
    </main>
  );
}
