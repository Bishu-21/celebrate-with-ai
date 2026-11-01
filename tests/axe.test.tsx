import { render } from "@testing-library/react";
import axe from "axe-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Faq } from "@/components/landing/Faq";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { IntakeWizard } from "@/components/planner/IntakeWizard";
import { BudgetBoard } from "@/components/planner/BudgetBoard";
import { TimelineBoard } from "@/components/planner/TimelineBoard";
import { VendorBoard } from "@/components/planner/VendorBoard";
import { GuestBoard } from "@/components/planner/GuestBoard";
import { ChecklistBoard } from "@/components/planner/ChecklistBoard";
import { IdeasBoard } from "@/components/planner/IdeasBoard";
import { buildLocalPlan } from "@/domain/local-plan";
import { FIXTURE_BRIEF } from "./brief";

const plan = buildLocalPlan(FIXTURE_BRIEF);
const noop = () => undefined;

async function violations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
    },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

describe("axe", () => {
  // jsdom has no canvas renderer. Returning null lets axe use its text-only fallback.
  beforeAll(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null));
  afterAll(() => vi.restoreAllMocks());
  it.each([
    ["budget", <BudgetBoard key="budget" plan={plan} busy={false} onConfirm={noop} onApplyScenario={noop} onAskGemini={noop} />],
    ["timeline", <TimelineBoard key="timeline" plan={plan} busy={false} onStatus={noop} onDateChange={noop} onReschedule={noop} />],
    ["vendors", <VendorBoard key="vendors" category="venue" capInr={100000} questions={plan.vendorBriefs[0].questions} rows={[]} busy={false} onCategory={noop} onAskQuestions={noop} onCompare={noop} />],
    ["guests", <GuestBoard key="guests" guests={[]} onAdd={noop} onStatus={noop} onApplyHeadcount={noop} />],
    ["checklist", <ChecklistBoard key="checklist" items={plan.checklist} onToggle={noop} />],
    ["ideas", <IdeasBoard key="ideas" ideas={plan.ideas ?? []} busy={false} warning={null} onSuggest={noop} onStatus={noop} onAdd={noop} />],
  ])("finds no structural accessibility violations on the %s board", async (_, board) => {
    const { container } = render(<main>{board}</main>);
    expect(await violations(container)).toEqual([]);
  });
  it("finds no violations on the landing page", async () => {
    const { container } = render(
      <>
        <SiteHeader />
        <main id="planner-main">
          <Hero />
          <FeatureGrid />
          <HowItWorks />
          <Faq />
        </main>
        <SiteFooter />
      </>,
    );
    expect(await violations(container)).toEqual([]);
  });

  it("finds no violations on the intake form", async () => {
    const { container } = render(
      <main id="planner-main">
        <IntakeWizard busy={false} onCreate={() => undefined} />
      </main>,
    );
    expect(await violations(container)).toEqual([]);
  });
});
