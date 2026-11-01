import Link from "next/link";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <div className="glass mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full px-3 sm:px-5">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Marigold
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <Link href="/planner" className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground sm:px-5">
          <span className="sm:hidden">Plan</span>
          <span className="hidden sm:inline">Open planner</span>
        </Link>
      </div>
    </header>
  );
}
