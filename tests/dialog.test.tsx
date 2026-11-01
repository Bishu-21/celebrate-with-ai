import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog } from "@/components/ui/Dialog";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} title="Trade-off" onClose={() => setOpen(false)}>
      <p>Protect food before decor.</p>
    </Dialog>
  );
}

describe("dialog", () => {
  it("names the dialog and closes from the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const dialog = screen.getByRole("dialog", { name: "Trade-off" });
    expect(dialog).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
