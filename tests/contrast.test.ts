import { describe, expect, it } from "vitest";
import { CONTRAST_PAIRS, contrastRatio } from "@/domain/contrast";

describe("contrast", () => {
  it("meets WCAG AA for the Marigold palette", () => {
    for (const pair of CONTRAST_PAIRS) {
      expect(contrastRatio(pair.foreground, pair.background), pair.name).toBeGreaterThanOrEqual(pair.minimum);
    }
  });
});
