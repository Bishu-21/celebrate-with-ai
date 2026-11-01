# Marigold — Celebration & Event Planner (Hack2skill Challenge 5)

Marigold is a web planner for weddings, birthdays, and community events. It keeps one stateful plan: a clarifying intake, a budget with priority trade-offs, a dependency-aware timeline, vendor questions and quote comparison, guest RSVPs, and an interactive checklist.

Gemini drafts and rewrites the words. TypeScript recomputes the money, the dates, and the headcount.

## Problem Statement Alignment

| Challenge need | Where it lives |
| --- | --- |
| Clarifying intake for occasion, budget, guests, date, vibe, and priorities | `src/components/planner/IntakeWizard.tsx` |
| AI itinerary and plan generation | `generateInitialEventPlan` in `src/lib/gemini.ts`, `POST /api/plan/generate` |
| Budget tracking and trade-offs | `src/domain/budget.ts`, `recalculateBudgetTradeoffs`, `POST /api/plan/tradeoffs` |
| Dependency-aware timeline | `src/domain/timeline.ts`, `rescheduleTimelineWithDependencies`, `POST /api/plan/timeline` |
| Vendor checklist, questions, and quote comparison | `compareVendorQuotes`, `POST /api/vendors/questions`, `POST /api/vendors/compare` |
| Guest RSVP management | `src/domain/guests.ts`, Guests board |
| Interactive checklist | `src/components/planner/ChecklistBoard.tsx` |
| Stateful revision when guests, budget, or date change | `reviseEventPlan`, `src/domain/revision.ts`, `POST /api/plan/revise` |

The revision the planner is built around: “We have 50 more guests, the budget dropped by ₹2,00,000, and the event is 2 weeks earlier.” That sentence updates the open plan. It does not start a new event. Completed tasks stay completed.

Estimates use `isEstimated: true` and an **AI estimate** badge. A category becomes a confirmed quote only after the host marks a figure they entered. Marigold does not pretend to know which vendors are free.

## GenAI Architecture & Prompt Flow

- Provider: Google AI Studio, SDK `@google/genai`
- Model: `process.env.GEMINI_MODEL` or `gemini-3.5-flash-lite`
- Key: `GEMINI_API_KEY`, read only on the server
- Response shape: `responseMimeType: "application/json"` and `responseSchema`

| Function | Route | What Gemini returns | What TypeScript decides |
| --- | --- | --- | --- |
| `generateInitialEventPlan` | `POST /api/plan/generate` | `budgetBreakdown`, `timelineTasks` with `dependencies`, `tradeOffScenarios`, `vendorBriefs`, `checklist` | Sums the budget, schedules due dates backward from the event, forces `isEstimated: true` |
| `recalculateBudgetTradeoffs` | `POST /api/plan/tradeoffs` | Scenarios that name a protected priority | Rejects a scenario that cuts the top priority hardest, and checks the sum |
| `compareVendorQuotes` | `POST /api/vendors/questions`, `POST /api/vendors/compare` | Questions and `vendorComparisonMatrix` commentary | Coverage versus RSVP headcount, cap check, and extra-charge lines found in the host’s notes |
| `rescheduleTimelineWithDependencies` | `POST /api/plan/timeline` | Notes for the same task ids | Due dates, blocked status, and overdue flags |
| `reviseEventPlan` | `POST /api/plan/revise` | Calls the trade-off and timeline functions with the current plan plus the instruction | Guest delta, budget delta, date shift, catering scale, and preservation of task ids |
| `generateIdeas` | `POST /api/plan/ideas` | Occasion-specific idea titles and assumptions | Templates for wedding, birthday, and community events when the model is unavailable |

The first plan still requires Gemini. A missing key returns an error and does not invent an event. If a later note, trade-off, timeline note, quote commentary, or idea request fails, the screen keeps the calculated numbers and says the text is not from Gemini. `x-forwarded-for` is ignored unless `TRUST_FORWARDED_FOR=1`.

## Prompt Evolution Across Attempts

Attempt 0, this repository:

- System instructions require JSON that matches `responseSchema` for the plan, trade-offs, vendor matrix, and timeline.
- Invalid model JSON is discarded. The UI does not render a raw chat transcript.
- Cost language in every system instruction says the number is an assumption.
- Revision sends the current plan and keeps its id. Gemini may rewrite notes. It does not replace the calculated totals.

Update this section after a Hack2skill attempt. Only the last submission counts.

## Security & Accessibility

Security:

- No API key in source. Copy `.env.example` to `.env.local`.
- Zod validates every API body in `src/lib/schemas.ts`.
- Text is trimmed, control characters are stripped, and payloads over 120 KB are rejected.
- Routes are rate-limited.
- AI text is rendered as text, not HTML.
- `next.config.ts` sends `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and a Content-Security-Policy.
- `.gitignore` excludes `.env`, `.next`, and `node_modules`.

Accessibility:

- `header`, `nav`, `main`, `section`, and `footer` landmark the pages.
- Inputs have visible labels. Icon-only and reorder buttons have `aria-label`.
- Intake errors use `role="alert"`. Revisions and checklist progress use `aria-live`.
- Dialogs use `role="dialog"`, `aria-modal`, `aria-labelledby`, focus on open, Tab wrap, and Escape.
- The mobile plan menu closes on Escape.
- A skip link points at `#planner-main`.
- `tests/contrast.test.ts` checks the palette against WCAG AA.

## Testing

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Vitest covers budget trade-offs, dependency ordering and date shifts, RSVP headcount, vendor quote gaps, the 50-guest revision, Zod rejection, the Gemini response schema, color contrast, the intake error, checklist keyboard toggle, and dialog Escape. Gemini is not called from the test suite.

## Run locally

```bash
npm install
cp .env.example .env.local
```

Put a Google AI Studio key in `GEMINI_API_KEY`, then:

```bash
npm run dev
```

Open `http://localhost:3000` and start a plan. Generating the first plan calls Gemini. There is no sample plan. Revision, trade-offs, timeline notes, quote scores, and ideas still calculate in the app when Gemini does not answer, and the screen says so.

Deploy the Next.js app on any Node host. Set `GEMINI_API_KEY` in the host’s environment, not in the repository.
