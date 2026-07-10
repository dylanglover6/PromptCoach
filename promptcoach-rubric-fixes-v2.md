# PromptCoach Rubric Fixes — Consolidated (v2, supersedes v1)

This replaces `promptcoach-rubric-fixes.md`. It folds in everything
found across the full calibration testing round: the original
score/text mismatch findings, the Clarity-after-clarification bug, the
Examples task-input mislabeling bug, run-to-run instability, and the
new conditional-Examples and dimension-weighting rules.

## 1. General anchoring rule (score must match the severity of the note)

Observed repeatedly: the model's written note correctly identifies a
real, output-changing flaw, but the numeric score stays in a generous
7-8 range anyway. This happened independently on Context, Clarity, and
Structure across different test prompts.

Add to the system prompt:

> Before finalizing a numeric score for any dimension, re-read the note
> you just wrote. If the note describes a flaw that would meaningfully
> change how well the output serves the user's actual goal — not a
> purely cosmetic nitpick — the score MUST be 5 or below. A score of
> 7-8 should only be used when the note describes minor polish
> opportunities, not structural or substantive gaps. If a note reads
> like a real problem but you're reaching for a 7, that mismatch means
> the score is wrong — lower it.
>
> Conversely, once a prompt has addressed the CORE of a gap (states a
> general rule AND demonstrates it with a matching example), remaining
> minor nuance should NOT be scored as if the core gap still exists.
> Test: if you removed only the one remaining nuance you're about to
> critique, would the prompt still function correctly for the task? If
> yes, that's a 7-8 deduction, not a 5-or-below one.

## 2. Clarity hard cap after a clarifying round

Confirmed directly in testing: a prompt that required a clarifying
question to resolve intent scored Clarity 7/10 once intent became
clear — inflating the score based on the *resolved* understanding
rather than the *original* submission.

> If a clarifying question was required to determine the user's
> intent, the Clarity score for that submission is capped at 5/10,
> regardless of how clear the intent becomes after clarification. The
> score describes the prompt as originally submitted. A successful
> clarification round does not raise this score — the fact that
> clarification was necessary IS the clarity problem.

## 3. Structure measures scannability, not content quality

A single unbroken run-on-sentence prompt containing genuinely good
information (audience, tone, example, length, CTA requirement) scored
7/10 for Structure. Good content and good formatting are being
conflated.

> Structure measures how easily a human or model can scan and parse the
> prompt — NOT whether good information is present somewhere in it
> (that's covered by Context/Examples/Success criteria). A prompt with
> all the right information crammed into one long run-on paragraph, no
> sections, headings, or line breaks, should score LOW on Structure
> (3-5) even if every other dimension is strong. Reserve 8-10 for
> prompts with clear visual/logical separation between distinct parts.

## 4. Task input vs. few-shot example (labeling bug — not a calibration issue)

Repeatedly, prompts with ZERO worked examples still scored 6-8 on
Examples, with notes claiming "one example is provided" — the model
was counting the task's own input (the specific text to classify) as
if it were a demonstrated input→output pair.

> Distinguish clearly between the "task input" (the specific text/data
> the user wants processed right now) and a "few-shot example" (a
> demonstrated input→output pair placed elsewhere in the prompt to
> teach the model the pattern, BEFORE the actual task input). The task
> input itself does NOT count as a few-shot example, no matter how
> illustrative it happens to be. Only score Examples based on genuine
> worked input→output pairs distinct from the thing being processed.

## 5. Examples: conditional, not universal — bonus vs. penalty

Not every good prompt needs examples. Forcing a flat penalty for
missing examples on every prompt produces inconsistent scoring, since
the model has to make an ad hoc judgment call each time about how much
to penalize.

> Before scoring the Examples dimension, first classify whether this
> task type meaningfully benefits from demonstrated input→output pairs:
> - Benefits from examples: ambiguous/subjective judgment calls, fuzzy
>   category boundaries, precise structured output formats, style/tone
>   matching
> - Does NOT need examples: simple, self-contained, unambiguous
>   instructions where the task is fully specified in prose alone
>
> If the task benefits from examples and none are given, apply a real
> penalty (3-5 range) — same as before. If the task does NOT need
> examples, their absence should NOT lower the score at all; instead,
> their presence can act as a BONUS that pushes an already-strong
> prompt from 8 toward 10. Do not flatly subtract points for missing
> examples on tasks where they wouldn't add value.

## 6. Dimension importance: gating, not weighted averaging

Not all five dimensions are equally load-bearing, but a numeric
weighted average adds a math step the model must execute identically
every call — more surface area for the instability already observed.
Use gating instead:

> Clarity and Success Criteria are foundational: if either scores 4 or
> below, the OVERALL score cannot exceed 5, regardless of how strong
> the other dimensions are. Context contributes meaningfully to the
> overall score but does not gate it the same way. Structure and
> Examples should shift the overall score up or down by at most 1-2
> points from what Clarity + Context + Success Criteria alone would
> suggest — they refine the score, they do not anchor it.

## 7. Reasoning before scoring (stability fix)

Examples swung 4 → 6 → 8 across three runs of the IDENTICAL unmodified
prompt — real run-to-run instability, not just calibration drift.

> For each dimension, write out the specific evidence from the prompt
> BEFORE committing to a number. Base the score strictly on that
> written evidence — do not assign a score first and rationalize a note
> afterward. If no genuine evidence supports a claim (e.g. "an example
> is provided"), do not include that claim.

## 8. Model call settings

- Set `temperature: 0` on all rating calls. This is a grading/
  classification task, not creative generation — deterministic scoring
  is more valuable here than variation.
- Confirm this is actually set in the live API call, not just assumed
  from a default.

## 9. Rubric versioning

Tag every rating with which rubric/system-prompt version produced it
(e.g. `rubricVersion: "2026-07-v2"`) in whatever gets logged or stored.
A rubric change is a measurement change — comparing scores across
rubric versions without this tag makes future before/after comparisons
unreliable.

## Validation plan after applying all fixes above
Re-run the exact same four test prompts used in the original
calibration round (unchanged) and confirm:
- Test 1 Examples scores low (3-5) and the note no longer claims an
  example exists where there isn't one
- Test 1 Context stays in the 4-6 range (not back up to 7+)
- Test 2 Clarity lands at exactly 5 (hard cap), not 6-7
- Test 3 Structure drops into the 3-5 range for the run-on-sentence
  version
- Test 4 Success criteria stays correctly low (this one was already
  working — confirm the new rules don't accidentally drag it up or
  down)
- Run Test 1 (or any single prompt) 3 times in a row with temperature
  0 set, and confirm the spread across runs is now much tighter than
  the 4-point swing seen before
