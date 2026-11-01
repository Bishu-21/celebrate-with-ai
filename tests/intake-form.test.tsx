import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntakeWizard } from "@/components/planner/IntakeWizard";

describe("intake form", () => {
  it("explains when the event name is missing", async () => {
    const user = userEvent.setup();
    render(<IntakeWizard busy={false} onCreate={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/event name and city/i);
  });
});
