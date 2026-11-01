const STEPS = [
  { title: "Answer the practical questions", body: "Say what the event is, what it can cost, and what matters most. Wedding, birthday, and community plans do not share one task list." },
  { title: "Gemini drafts structured JSON", body: "The model returns budget lines, tasks with dependencies, trade-offs, vendor notes, and occasion ideas. The app recomputes totals and dates." },
  { title: "Revise the same plan", body: "Say the guest list grew, the budget changed, or the date moved. Gemini reads the sentence. Completed work stays put." },
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
