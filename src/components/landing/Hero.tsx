import Link from "next/link";

const FACTS = [
  { value: "01", label: "Intake before ideas" },
  { value: "02", label: "Gemini writes JSON" },
  { value: "03", label: "The same plan revises" },
];

export function Hero() {
  return (
    <section className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-10 pt-36">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-gold">Celebration and event planner</p>
      <h1 className="mt-5 max-w-4xl text-5xl leading-[0.95] text-foreground sm:text-7xl">
        Plan the celebration.
        <br />
        <span className="italic text-gold">Keep the constraints honest.</span>
      </h1>
      <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
        Weddings, birthdays, and community events become one glass-clear plan: budget trade-offs, a timeline with dependencies, vendor questions, and RSVPs.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/planner" className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground">
          Start a plan
        </Link>
        <a href="#how-it-works" className="glass inline-flex min-h-12 items-center justify-center rounded-full px-7 text-sm font-semibold">
          See how a revision works
        </a>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Powered by Google Gemini 3.5 Flash-Lite
        <span aria-hidden="true"> · </span>
        Structured JSON schema
      </p>
      <dl className="mt-16 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
        {FACTS.map((fact) => (
          <div key={fact.value}>
            <dt className="font-serif text-3xl text-gold">{fact.value}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">{fact.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
