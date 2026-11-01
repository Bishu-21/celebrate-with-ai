import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChecklistBoard } from "@/components/planner/ChecklistBoard";

function Harness() {
  const [items, setItems] = useState([{ id: "check-1", title: "Lock the venue", done: false, taskId: "lock-date-venue" }]);
  return (
    <ChecklistBoard
      items={items}
      onToggle={(id) => setItems((current) => current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)))}
    />
  );
}

describe("checklist", () => {
  it("toggles from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Lock the venue" });
    box.focus();
    await user.keyboard("[Space]");
    expect(box).toBeChecked();
    expect(screen.getByText(/1 of 1 complete/i)).toBeInTheDocument();
  });
});
