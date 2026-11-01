# Marigold — Celebration & Event Planner (Hack2skill Challenge 5)

Marigold is a GenAI planning assistant for weddings, birthdays, and community events, with budgets, timelines, vendor checklists, and personalized ideas. It keeps one stateful plan: a clarifying intake, priority trade-offs, a dependency-aware timeline, vendor questions and quote comparison, guest RSVPs, and an interactive checklist.

Gemini drafts and rewrites the words. TypeScript recomputes the money, the dates, and the headcount.

## Problem Statement Alignment

| Challenge need | Where it lives |
| --- | --- |
| Clarifying intake for occasion, budget, guests, date, vibe, and priorities | `src/components/planner/IntakeWizard.tsx` |
| AI itinerary and plan generation | `generateInitialEventPlan` in `src/lib/gemini.ts`, `POST /api/plan/generate` |
| Budget tracking and trade-offs | `src/domain/budget.ts`, `recalculateBudgetTradeoffs`, `POST /api/plan/tradeoffs` |
| Dependency-aware timeline | `src/domain/timeline.ts`, `rescheduleTimelineWithDependencies`, `POST /api/plan/timeline` |
| Vendor checklist, questions, and quote comparison | `Vendor checklist` board, `compareVendorQuotes`, `POST /api/vendors/questions`, `POST /api/vendors/compare` |
| Guest RSVP management | `src/domain/guests.ts`, Guests board |
| Interactive checklist | `src/components/planner/ChecklistBoard.tsx` |
| Occasion-specific ideas | `generateIdeas`, `POST /api/plan/ideas`, `src/domain/occasion-templates.ts` |
| Stateful revision when guests, budget, or date change | `reviseEventPlan`, `src/domain/revision.ts`, `POST /api/plan/revise` |
| Trade-offs when spend is about 20% over, without a blind cut | `proposeTradeoffs` in `src/domain/budget.ts` |
| A delayed dependency blocks the next task | `scheduleTasks` in `src/domain/timeline.ts` |
| Vendor questions even when Gemini does not answer | `localVendorQuestions` in `src/domain/vendors.ts`, `POST /api/vendors/questions` |
| No invented vendor availability or confirmed price | Quote scores in `src/domain/vendors.ts`. `isEstimated` stays true until the host enters a quote. |

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

Attempt 1:

- System instructions require JSON that matches `responseSchema`. Category and priority fields are enums, so the model is asked for `high`, `medium`, or `low` and the six budget categories.
- Model JSON is normalized before Zod validation. A priority such as "Urgent", a category such as "Food", or a numeric string still becomes a valid draft. Invalid JSON is discarded. The UI does not render a raw chat transcript.
- Cost language in every system instruction says the number is an assumption.
- Revision keeps the plan id. When the local parser already read the guest, budget, or date change, Gemini is not asked to read that sentence again. Trade-off notes are requested only when the guest count or budget changed. Timeline notes are requested only when the date changed. Gemini does not replace the calculated totals.

## Efficiency

- Budget, timeline, vendor, guest, checklist, and idea boards load with `next/dynamic`. The intake and overview stay in the first planner chunk.
- One Gemini client is reused for the server process. Response schemas share one budget-line shape. Identical requests already in progress share one provider operation, and at most eight distinct operations run in one process.
- Trade-offs receive budget aggregates, timeline notes receive the complete task identity set, and ideas receive occasion constraints. Unrelated task/vendor arrays and guest identities are omitted. Context is bounded without truncating serialized JSON.
- AI work has a 20-second deadline, SDK cancellation and request timeout, at most one application retry, and explicit output limits (8,192 tokens for the initial plan, 4,096 for later operations). Aborting a client request does not guarantee cancellation or billing reversal at the provider.
- A settled revision skips `extractConstraintDelta`. The two advisory calls run only for fields that changed, and they run together when both are needed.
- Cycle removal walks the task graph once per removed edge. Due dates take the earliest child start in one memoized pass. Category lookups during a trade-off use a map, not a scan per category.
- Saving a plan reuses the parsed copy already in memory when the browser text has not changed.
- The rate limiter keeps a sliding window per caller and prunes the key map in batches.
- Currency and guest totals reuse one formatter and one pass over the guest list.
- Budget rows, timeline tasks, the checklist, the vendor board, and the ideas board skip re-rendering when their data and callbacks have not changed. Planner callbacks are stable across unrelated state updates. Guest, checklist, budget, and vendor-brief lookups use a map for the current plan.
- A checklist title matches a task by an exact-title index before any fuzzy scan. Trade-off lines and vendor commentary join by category or quote id, and the first match wins.
- The revision parser compiles its patterns once. The Gemini client caches the hash of each response schema, so an in-flight duplicate does not serialize that schema again.
- The React Compiler memoizes component output during the production build. `src/lib/gemini.ts` imports `server-only`, so the Gemini SDK stays out of the browser bundle.
- Fonts use `display: "swap"` so text stays readable while Instrument Serif and Inter load.

## Security & Accessibility

Security:

- No API key in source. Copy `.env.example` to `.env.local`. `src/lib/gemini.ts` imports `server-only`, so the client bundle cannot load the Gemini client.
- Zod validates every API body in `src/lib/schemas.ts`.
- Text is trimmed. Control characters and bidi overrides are stripped from API JSON and from the plan saved in the browser. Keys named `__proto__`, `constructor`, and `prototype` are dropped.
- A request with an `Origin` from another site is rejected using the complete origin, including protocol and port. Only the `application/json` media type is accepted. Body reading stops at 120,000 bytes, including when Content-Length is absent or misleading. A missing `Origin` is still accepted so same-machine checks keep working.
- Routes are rate-limited. On Vercel, or when `TRUST_FORWARDED_FOR=1`, the key is `x-real-ip`, then the first `x-forwarded-for` hop. Elsewhere every caller shares the local bucket so a spoofed forwarding header cannot dodge the limit.
- AI text is rendered as text, not HTML.
- `next.config.ts` sends `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `X-DNS-Prefetch-Control`, `X-Permitted-Cross-Domain-Policies`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `Permissions-Policy`, and a Content-Security-Policy with `object-src 'none'`. Production also sends HSTS and `upgrade-insecure-requests`. `script-src` still allows inline scripts because Next requires that.
- `.gitignore` excludes `.env`, `.next`, and `node_modules`.

Accessibility:

- `header`, `nav`, `main`, `section`, and `footer` landmark the pages.
- A field's accessible name is its label. Hints and errors are descriptions (`aria-describedby`), and an invalid control sets `aria-invalid`.
- Intake errors use one `role="alert"`. The invalid name, city, date, guest count, or budget field points at that alert. Revisions and checklist progress use `aria-live`.
- Dialogs use `role="dialog"`, `aria-modal`, `aria-labelledby`, focus on open, Tab wrap, and Escape.
- The mobile plan menu is a modal dialog. Focus moves inside it, Tab stays inside it, and Escape closes it. The rest of the planner is `inert` while it is open.
- Timeline status buttons and idea actions include the item name. Budget and vendor tables have captions. Checklist boxes are named by their labels.
- A skip link points at `#planner-main`.
- `tests/contrast.test.ts` checks the palette against WCAG AA, including secondary text on the page and on glass. `tests/a11y.test.tsx` checks labels, the plan menu, and named timeline actions. `tests/axe.test.tsx` runs axe-core on the landing page and the intake form. The phone header opens a modal for Product, How it works, and FAQ.

## Testing

```bash
npm test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
```

`npm run test:coverage` includes all domain modules, all libraries (including the Gemini service and storage), and every API route. CI enforces minimums of 88% lines, 82% statements, 86% functions, and 68% branches, then runs lint with zero warnings, typecheck, a production build, and `npm audit --omit=dev`. Pure domain/API tests run in Node; UI/storage tests run in jsdom. Vitest mocks provider transport and does not consume Gemini credits. The latest verified results and release limitations are recorded in [the submission review](docs/final-submission-review.md). These tests map to the challenge:

| Requirement | Test |
| --- | --- |
| Clarifying intake: occasion, budget, guests, date, vibe, priority | `tests/intake-form.test.tsx` |
| The 50-guest, ₹2,00,000, two-week revision keeps the plan id and finished tasks | `tests/problem-statement.test.ts`, `tests/revision.test.ts` |
| A 20% overage proposes cuts that protect the top priority | `tests/budget.test.ts` |
| Venue lock precedes secondary vendors, and a slip blocks them | `tests/timeline.test.ts` |
| Quote comparison: coverage, cap, hidden charges, no availability flag | `tests/vendors.test.ts` |
| Local vendor questions when the model is down | `tests/vendor-questions.test.ts` |
| RSVP headcount and occasion-specific ideas | `tests/guests.test.ts`, `tests/ideas.test.ts` |
| Same-origin JSON, control-character stripping, and platform IP keying | `tests/http-security.test.ts` |
| Labels, modal plan menu, named timeline actions, and axe on the landing page and intake | `tests/a11y.test.tsx`, `tests/axe.test.tsx` |
| Checklist keyboard toggle linked to a task | `tests/checklist.test.tsx`, `tests/commands.test.ts` |
| Local fallback visibility, stale responses/previews, and reset errors | `tests/planner-recovery.test.tsx` |
| Actual route handlers and degraded operation | `tests/api-routes.test.ts` |
| Provider deadlines, retry bounds, coalescing, and operation-specific context | `tests/ai-efficiency.test.ts` |
| Quote locks, exact rounding, catering basis, and duplicate idea charges | `tests/final-regressions.test.ts` |
| Restored vendor inputs and current host requirements | `tests/vendor-workflow.test.tsx` |

## Plan integrity

- A locally recalculated revision remains open when Gemini is unavailable, with honest source labels.
- Async results are checked against the saved event ID and revision. A stale preview or undo cannot overwrite newer work, including work saved in another tab.
- Storage validates writes before replacing a durable copy, preserves compatible historical category-scoped quote IDs, and reports read/write/reset failures. Reset removes both the current and legacy plan.
- Confirmed quotes remain locked in local and AI scenarios. Allocation uses largest remainders so integer rounding cannot make a category negative. Unsupported guest/budget changes are rejected instead of silently clamped.
- Saved, dismissed, and added ideas survive regeneration; adding an idea twice never charges twice. Vendor caps follow budget changes and quote forms restore saved entries by category.

## Run locally

```bash
npm install
cp .env.example .env.local
```

Put a Google AI Studio key in `GEMINI_API_KEY`, then:

```bash
npm run dev
```

Open `http://localhost:3000` and start a plan. Generating the first plan calls Gemini. There is no sample plan. Revision, trade-offs, timeline notes, quote scores, vendor questions, and ideas still calculate in the app when Gemini does not answer, and the screen says so.

Deploy the Next.js app on any Node host. Set `GEMINI_API_KEY` in the host’s environment, not in the repository.
