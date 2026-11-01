const FEATURES = [
  { index: "01", title: "Clarifying intake", body: "Occasion, budget, guests, date, vibe, and the priorities you refuse to cut first." },
  { index: "02", title: "Budget trade-offs", body: "Estimates stay labelled as estimates. Overages propose cuts that protect your top priority." },
  { index: "03", title: "Dependency timeline", body: "Venue and date lock before secondary vendors. A new date pulls the sequence with it." },
  { index: "04", title: "Vendor comparison", body: "Questions to ask, then a side-by-side of quotes you collected. No fake availability." },
  { index: "05", title: "Guest RSVP", body: "Yes and maybe party sizes become the catering headcount." },
  { index: "06", title: "In-place revision", body: "Fifty more guests, a smaller budget, and an earlier date update this plan instead of starting over." },
];

export function FeatureGrid() {
  return (
    <section id="product" className="relative mx-auto max-w-6xl px-4 py-20">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">The work</p>
      <h2 className="mt-3 max-w-xl text-4xl leading-tight sm:text-5xl">What the planner actually tracks</h2>
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="glass rounded-[28px] p-6 transition-transform duration-300 hover:-translate-y-1">
            <p className="font-serif text-2xl text-gold">{feature.index}</p>
            <h3 className="mt-6 font-serif text-3xl">{feature.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{feature.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
