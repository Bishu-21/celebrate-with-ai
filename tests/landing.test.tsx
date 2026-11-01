import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Faq } from "@/components/landing/Faq";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SiteFooter } from "@/components/landing/SiteFooter";

describe("landing markup", () => {
  it("keeps one h1, uses details for questions, and links a real planner", () => {
    const { container } = render(
      <>
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <Faq />
        <SiteFooter />
      </>,
    );

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: /plan the celebration/i })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "What the planner actually tracks" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "How a plan stays intact" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Questions hosts ask first" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Clarifying intake" })).toBeTruthy();
    expect(container.querySelectorAll("details")).toHaveLength(4);
    expect(container.querySelector("summary")?.textContent).toContain("Which celebrations can Marigold plan?");
    expect(container.querySelectorAll("ol span")[0]?.textContent).toBe("01");
    expect(screen.getByRole("link", { name: "Start a plan" }).getAttribute("href")).toBe("/planner");
    expect(screen.queryByRole("link", { name: "Load sample wedding" })).toBeNull();
    expect(screen.getByRole("link", { name: "Privacy" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getAllByText(/Gemini 3\.5 Flash-Lite/i).length).toBeGreaterThan(0);
  });
});
