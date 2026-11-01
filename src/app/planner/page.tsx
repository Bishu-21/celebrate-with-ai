import type { Metadata } from "next";
import { PlannerApp } from "@/components/planner/PlannerApp";

export const metadata: Metadata = {
  title: "Planner | Marigold",
  description: "Build and revise a celebration plan with budget trade-offs, a dependency timeline, vendors, and RSVPs.",
};

export default function PlannerPage() {
  return <PlannerApp />;
}
