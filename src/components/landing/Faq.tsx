import { FAQ_ITEMS } from "@/data/faq";

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-6xl px-4 py-20">
      <h2 className="text-4xl leading-tight sm:text-5xl">Questions hosts ask first</h2>
      <div className="glass mt-8 divide-y divide-white/10 rounded-[28px]">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group p-6" name="marigold-faq">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-serif text-2xl [&::-webkit-details-marker]:hidden">
              {item.question}
              <span aria-hidden="true" className="text-gold transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
