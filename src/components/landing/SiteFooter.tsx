import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-serif text-4xl">Marigold</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Estimates are assumptions until you confirm a vendor quote.</p>
          <p className="mt-3 text-sm text-muted-foreground">Powered by Google Gemini 3.5 Flash-Lite · Structured JSON schema</p>
        </div>
        <Link href="/privacy" className="text-sm font-semibold text-foreground">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
