import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
