import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntakeWizard } from "@/components/planner/IntakeWizard";

describe("intake form", () => {
  it("collects occasion, budget, guests, date, vibe, and priority before creating a plan", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<IntakeWizard busy={false} onCreate={onCreate} />);

    await user.selectOptions(screen.getByLabelText("Occasion"), "birthday");
    await user.type(screen.getByLabelText("Event name"), "Meera turns 30");
    await user.type(screen.getByLabelText("City"), "Pune");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByLabelText("Planning guest count")).toHaveValue(80);
    expect(screen.getByLabelText(/Total budget/i)).toHaveValue(800000);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.selectOptions(screen.getByLabelText("Vibe"), "grand");
    await user.click(screen.getByRole("button", { name: "Move Food up" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await user.type(screen.getByLabelText(/Constraints/i), "Vegetarian meals and step-free access.");
    await user.click(screen.getByRole("button", { name: "Generate plan" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const brief = onCreate.mock.calls[0]?.[0] as {
      occasion: string;
      city: string;
      guestCount: number;
      budgetInr: number;
      vibe: string;
      priorities: string[];
      notes: string;
      eventDate: string;
    };
    expect(brief).toMatchObject({
      occasion: "birthday",
      city: "Pune",
      guestCount: 80,
      budgetInr: 800000,
      vibe: "grand",
      notes: "Vegetarian meals and step-free access.",
    });
    expect(brief.priorities[0]).toBe("catering");
    expect(brief.eventDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("explains when the event name is missing", async () => {
    const user = userEvent.setup();
    render(<IntakeWizard busy={false} onCreate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/event name and city/i);
  });
});
