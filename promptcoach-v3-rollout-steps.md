# PromptCoach v3 Rollout — Steps for Claude Code

## Scope for THIS pass
Apply the new backend rubric files, update the frontend to correctly
display the new response shape in a PLAIN format (no pie chart yet).
Getting the data layer verifiably correct comes before making it look
good — do not implement the pie chart visualization in this pass, even
if it seems like a small addition while already in the rating-card
component. That's the next pass, once this one is confirmed working.

## Step 1: Locate and review the new files
The `files/` folder contains three new files:
- `rating.js` — replaces the existing rubric/scoring library
- `rate.js` — replaces the existing rate endpoint handler
- `promptcoach-rubric-v3-changelog.md` — full explanation of what
  changed and why; read this before touching any code, since it
  documents the reasoning behind each change (dimension redesign,
  weighting approach, gating logic, modifier design)

## Step 2: Diff and replace the backend files
1. Locate the current versions in the repo (likely `api/lib/rating.js`
   and `api/rate/index.js` — confirm actual paths first)
2. Diff each against its `files/` counterpart and review the changes
   before overwriting — this is a structural rewrite, not a small
   patch, so read the diff rather than blindly replacing
3. Replace both files with the new versions
4. Search the codebase for any other files that import from
   `lib/rating.js` and reference now-removed exports — specifically:
   - `enforceScoreFloor` (removed, replaced by `computeOverallScore`)
   - the old `DIMENSION_KEYS` values (`clarity`, `context`, `examples`,
     `structure`, `success_criteria`) — these are now
     `goal_clarity`, `relevant_context`, `constraints`,
     `output_specification`, `success_criteria`, with `examples` and
     `structure` moved to a separate `modifiers` object entirely
   Fix any callers that break as a result.

## Step 3: File the changelog
Move `promptcoach-rubric-v3-changelog.md` into wherever the project
keeps docs (e.g. `docs/`). If a `promptcoach-rubric-fixes-v2.md` (or
similar) already exists there, keep it rather than deleting it — it's
a useful record of how the rubric evolved, referenced by version in
`RUBRIC_VERSION`.

## Step 4: Update the frontend to match the new response shape
The rating-card component (or wherever `/api/rate` responses are
rendered) needs to change for this new shape:

```
rating.overall                    // now 0-100, was 0-10
rating.dimensions.goal_clarity          // { note, score } same as before
rating.dimensions.relevant_context      // { note, score }
rating.dimensions.constraints           // { note, score } — NEW dimension
rating.dimensions.output_specification  // { note, score } — NEW dimension
rating.dimensions.success_criteria      // { note, score }
rating.modifiers.structure        // { note, applicability } — was a scored dimension, now categorical
rating.modifiers.examples         // { note, applicability } — was a scored dimension, now categorical
```

Concretely, for this pass:
1. Update dimension labels in the UI: rename "Clarity" → "Goal
   Clarity", "Context" → "Relevant Context"; add two new score rows
   for "Constraints" and "Output Specification"; remove "Structure"
   and "Examples" from the scored-dimension list entirely
2. Change the overall score display from an "/10" scale to "/100" —
   plain numeric or a simple progress bar scaled to 100 is fine for
   now, no pie chart
3. Add a simple, separate section below/beside the scored dimensions
   for the two modifiers, rendered as plain badges — not scored, not
   part of the 100-point total. Suggested plain-text tone mapping for
   now (refine visually in the next pass):
   - `well_organized` / `useful` → positive/neutral tone
   - `adequate` / `unnecessary` → neutral tone (these are NOT problems
     — `unnecessary` specifically means examples correctly weren't
     needed, don't render it as a warning)
   - `needs_improvement` / `missing` → attention tone
   - `misleading` → attention tone
   - `not_applicable` → neutral/muted tone
4. Confirm the `rewritten_prompt`, `insufficient_context_message`, and
   `clarifying_question` rendering paths still work unchanged — their
   shapes didn't change in this rework, only the rating shape did

## Step 5: Local environment check
Confirm `ANTHROPIC_API_KEY` and other `local.settings.json` values are
still in place (this rework doesn't touch environment config, but
worth confirming before testing).

## Step 6: Run the validation plan from the changelog
The changelog's "Validation plan" section lists the specific checks to
run (mixed-sentiment prompt → gap should show under `constraints` now,
not `relevant_context`; vague prompt → `goal_clarity` cap still works;
run-on prompt → `structure` modifier reads `needs_improvement`; repeat
runs → overall score stability). Run through each one and confirm
before considering this pass done.

## Step 7: Commit
Commit with a message referencing the rubric version bump (e.g.
"PromptCoach: rubric v3 — weighted 100-point scoring, Structure/
Examples as modifiers"), separate from any later pie-chart-specific
commit.

## Explicitly NOT in this pass
- Pie/donut chart visualization — plain numeric/progress display only
  for now
- Any change to `REVISE_SYSTEM_PROMPT` or `reviseTool` — unchanged by
  this rework
- Any Prompt Effectiveness / Observed Performance feature — out of
  scope, deferred indefinitely per earlier decision

## Next pass (separate handoff, once this one is verified working)
- Pie/donut chart for the 100-point score: 5 wedges sized by weight
  (25/20/15/20/20 degrees), each wedge's fill proportional to
  score/10 within it. `recharts` is available in this environment.
- Modifier badges get real visual treatment (icons/colors) once the
  plain version from this pass is confirmed showing correct data
