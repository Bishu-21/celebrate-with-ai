import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { Faq } from "@/components/landing/Faq";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { IntakeWizard } from "@/components/planner/IntakeWizard";

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
