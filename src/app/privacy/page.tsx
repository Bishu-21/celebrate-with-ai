import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy | Marigold",
};

export default function PrivacyPage() {
  return (
    <main id="planner-main" className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="font-serif text-5xl">Privacy</h1>
      <div className="glass mt-8 space-y-3 rounded-[28px] p-6 text-sm leading-6 text-muted-foreground">
        <p>Marigold stores the current plan in this browser. There is no account.</p>
        <p>
          When you generate, revise, ask for trade-offs, reschedule, or compare vendors, the relevant plan text is sent from the server to Google Gemini using a server-side API key. The key is not included in the browser bundle.
        </p>
        <p>Cost figures from the model are estimates until you mark a category with a quote you received yourself.</p>
      </div>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-semibold">
        Back home
      </Link>
    </main>
  );
}
