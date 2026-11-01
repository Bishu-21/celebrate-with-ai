import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GuestBoard } from "@/components/planner/GuestBoard";
import { PlannerShell } from "@/components/planner/PlannerShell";
import { TimelineBoard } from "@/components/planner/TimelineBoard";
import { Field, TextInput } from "@/components/ui/Field";
import { buildLocalPlan } from "@/domain/local-plan";
import { FIXTURE_BRIEF } from "./brief";

describe("accessibility", () => {
  it("keeps the label as the name and the hint as the description", () => {
    render(
      <Field label="Total budget (INR)" hint="Estimates will be labelled as assumptions, not vendor prices.">
        <TextInput />
      </Field>,
    );
    const input = screen.getByLabelText("Total budget (INR)");
    expect(input).toHaveAccessibleDescription(/assumptions, not vendor prices/i);
  });

  it("marks a field invalid and announces the error once", () => {
    render(
      <Field label="City" error="Add a city.">
        <TextInput />
      </Field>,
    );
    expect(screen.getByLabelText("City")).toBeInvalid();
    expect(screen.getByRole("alert")).toHaveTextContent("Add a city.");
  });

  it("traps the plan menu and closes it from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <PlannerShell title="Priya & Arjun" source="local" section="overview" onSection={vi.fn()}>
        <p>Overview copy</p>
      </PlannerShell>,
    );
    await user.click(screen.getByRole("button", { name: "Menu" }));
    const dialog = await screen.findByRole("dialog", { name: "Plan sections" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus());
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names a timeline action with the task title", () => {
    const plan = buildLocalPlan(FIXTURE_BRIEF, { id: "plan-a11y", today: "2026-11-02" });
    render(
      <TimelineBoard plan={plan} busy={false} onStatus={vi.fn()} onReschedule={vi.fn()} onDateChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Set Lock the date and venue to done" })).toBeInTheDocument();
  });

  it("names an RSVP control from its label", () => {
    render(
      <GuestBoard
        guests={[{ id: "g1", name: "Asha", email: "", partySize: 2, status: "invited", mealNote: "" }]}
        onAdd={vi.fn()}
        onStatus={vi.fn()}
        onApplyHeadcount={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "RSVP for Asha" })).toBeInTheDocument();
  });
});
