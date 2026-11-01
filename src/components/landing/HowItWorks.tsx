const STEPS = [
  { title: "Answer the practical questions", body: "Occasion, budget, guest count, date, intimate or grand, and which category you refuse to cut first. Wedding, birthday, and community plans do not share one task list." },
  { title: "Gemini drafts structured JSON", body: "The model returns budget lines, tasks that wait on the venue lock, trade-offs, vendor questions, and occasion ideas. The app recomputes totals, due dates, and headcount. Costs stay assumptions until you enter a quote." },
  { title: "Revise the same plan", body: "Fifty more guests, a budget drop of ₹2,00,000, and a date two weeks earlier update this plan. Finished tasks stay finished. A slipped venue lock blocks the tasks that depend on it. Cuts stay suggestions until you apply one." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">The sequence</p>
      <h2 className="mt-3 text-4xl leading-tight sm:text-5xl">How a plan stays intact</h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="glass flex min-h-64 flex-col justify-between rounded-[28px] p-6">
            <span aria-hidden="true" className="font-serif text-5xl italic text-gold">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="font-serif text-3xl">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
