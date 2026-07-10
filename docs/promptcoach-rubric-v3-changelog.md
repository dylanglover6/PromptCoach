# PromptCoach Rubric v3 — 100-Point Weighted Rework

Supersedes the v2 rubric (`promptcoach-rubric-fixes-v2.md`). This is a
structural change, not just another calibration patch — the dimension
set itself changed, based on an external rubric reference the user
sourced and reviewed.

## What changed and why

### Dimension set: 5 core (weighted) + 2 modifiers (categorical, unweighted)

| Old (v2) | New (v3) | Notes |
|---|---|---|
| Clarity | Goal Clarity | Same concept, renamed |
| Context | Relevant Context | Narrower now — background/input data only |
| (none) | Constraints | NEW — rules/boundaries/edge-case decision rules |
| (split out of Success Criteria) | Output Specification | Response FORM/shape |
| Success Criteria | Success Criteria | Narrower now — can correctness be recognized |
| Structure | Structure (modifier) | No longer part of the weighted score |
| Examples | Examples (modifier) | No longer part of the weighted score |

**Why this is a real improvement, not just relabeling:** the old
Context dimension had accumulated a patchwork of addenda over several
rounds of testing (the Context-vs-Success-Criteria boundary rule, the
ambiguity-check rule) because "does it give necessary background" was
being stretched to also cover "does it define decision rules for
ambiguous input." The new Constraints dimension gives that a proper,
dedicated home instead of a bolted-on exception.

### Weights are fixed constants, computed in code — never by the model

```
goal_clarity: 25%, relevant_context: 20%, constraints: 15%,
output_specification: 20%, success_criteria: 20%
```

The model outputs 5 raw 1-10 scores, same as before. `rate.js` computes
the weighted 100-point overall via `computeOverallScore()`. This was
the reconciling point on the earlier "should we weight dimensions"
question — weighting is fine and useful, as long as the model never
has to do the arithmetic itself. Doing it in code removes an entire
category of instability risk rather than adding one.

### Gating, carried forward but simplified

v2 gated on BOTH Clarity and Success Criteria. v3 gates on
**goal_clarity only**: if it scores ≤4, overall is capped at 50/100
regardless of the weighted sum. The reasoning: with fixed weights now
doing real work (goal_clarity is already the highest-weighted
dimension at 25%), a second hard gate may be redundant. This is a
provisional simplification — see validation plan below for how to
check whether it's sufficient or whether success_criteria needs its
own gate reinstated.

### Structure and Examples: categorical modifiers, not scored dimensions

Per the sourced rubric's recommendation, both are now purely
categorical and excluded from the weighted 100-point score entirely —
shown to the user as separate, non-numeric signals.

- **structure**: `well_organized | adequate | needs_improvement | not_applicable`
  — `not_applicable` is used for short/simple prompts where structure
  doesn't meaningfully matter, informed by the computed word count fact.
  This directly implements the sourced rubric's note that structure
  should "apply mainly to longer or more complex prompts."
- **examples**: `useful | unnecessary | missing | misleading` — this
  supersedes the boolean `applicable` + nullable `score` design from
  the prior message; the 4-state categorical label is a cleaner
  expression of the same underlying idea and adds a state (misleading)
  the boolean version didn't have.

All the task-input-vs-few-shot-example and "check whether this task
type needs examples" logic from v2 carries forward unchanged — only
the output shape (categorical label vs. number) changed.

### New preemptive fix: Output Specification vs. Success Criteria

Not discovered through testing yet — added proactively because it's
structurally the same trap as the old Context-vs-Success-Criteria
overlap: for simple tasks (e.g. "return one lowercased label"), the
format instruction and the correctness check are nearly the same
sentence, so the two dimensions could blur into each other the same
way. The rubric text now explicitly separates FORM (Output
Specification) from whether CONTENT can be judged correct (Success
Criteria). Flag this if testing turns up score/note mismatches between
these two — same failure signature as the earlier Context issue.

### Ambiguity check moved from Context to Constraints

The explicit "state yes/no whether the specific input contains
conflicting elements" rule from the last round now lives under
Constraints, matching its new, more natural home.

## Frontend implications (not built yet — flagging for the UI pass)

- **Overall score display:** 100-point scale, likely a donut/pie chart
  with 5 wedges sized by weight (25/20/15/20/20 degrees-of-circle),
  each wedge's fill proportional to the score achieved within it
  (score/10). `recharts` (already available in this environment) can
  do this with a `PieChart` + custom per-segment fill.
- **Modifiers are NOT wedges** — show `structure` and `examples` as
  separate badges/tags below or beside the pie chart, each showing its
  categorical label plus the note. Do not fold them into the 100-point
  visual at all; mixing a scored chart with unscored modifiers in the
  same visual would misrepresent them as contributing to the total.
- **`not_applicable` / `unnecessary` states** should render as neutral
  informational badges (not red/warning-colored) — these are
  correctly-detected non-issues, not flaws.

## Validation plan

Re-run the same four original test prompts (sentiment classifier,
vague "do the thing" prompt, run-on headphones prompt, beginner Python
debug prompt) through the new schema and check:

1. **Sentiment classifier prompt (with mixed-sentiment input):**
   confirm the "no decision rule for mixed sentiment" gap now shows up
   under `constraints`, not `relevant_context` — this is the main
   structural bet of this rework and the easiest thing to verify.
2. **Vague "do the thing" prompt:** confirm `goal_clarity` still caps
   at 5 after a clarifying round, and confirm the gate correctly caps
   overall at 50 in this case.
3. **Run-on headphones prompt:** confirm `structure` modifier reads
   `needs_improvement` (it's long enough that structure should apply),
   using the word count fact to distinguish it from a short prompt that
   should read `not_applicable` instead.
4. **Beginner Python debug prompt:** confirm `output_specification`
   and `success_criteria` land on genuinely different notes/scores
   rather than one restating the other — this is the new preemptive
   fix, and it's untested since it wasn't a problem that existed before
   this rework.
5. Run any single prompt 3 times in a row and confirm overall-score
   stability, same check as before — the weighted-math-in-code change
   should make this at least as stable as v2, not less.
6. **Open question to resolve from testing, not guessing:** does
   gating on `goal_clarity` alone catch everything the old
   Clarity+Success-Criteria dual gate caught? If a prompt with strong
   goal_clarity but very weak success_criteria produces a
   misleadingly-high overall score, reinstate a second gate on
   success_criteria.
