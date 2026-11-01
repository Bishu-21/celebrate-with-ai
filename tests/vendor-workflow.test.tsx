import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VendorBoard } from "@/components/planner/VendorBoard";
import type { VendorQuote } from "@/domain/types";

describe("vendor workflow", () => {
  it("restores entered quotations and sends the host's current requirements", async () => {
    const quote: VendorQuote = { id: "venue-1", vendorName: "Amber Hall", category: "venue", amountInr: 40000, guestCoverage: 120, included: ["Chairs"], notes: "GST extra", isEstimated: false };
    const compare = vi.fn();
    render(<VendorBoard category="venue" capInr={50000} questions={[]} rows={[]} busy={false} onCategory={vi.fn()} onAskQuestions={vi.fn()} onCompare={compare} savedQuotes={[quote]} initialMustHaves="Indoor access" />);
    expect(screen.getAllByRole("textbox", { name: "Vendor" })[0]).toHaveValue("Amber Hall");
    const user = userEvent.setup();
    await user.clear(screen.getByRole("textbox", { name: "Must-haves" }));
    await user.type(screen.getByRole("textbox", { name: "Must-haves" }), "Step-free stage");
    await user.click(screen.getByRole("button", { name: "Compare quotations" }));
    expect(compare).toHaveBeenCalledWith(expect.any(Array), "Step-free stage");
  });
});
