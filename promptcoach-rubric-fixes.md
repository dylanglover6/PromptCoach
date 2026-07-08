# PromptCoach Rubric Calibration Fixes

Based on adversarial test prompts run against the live rater. These
fixes address specific, observed miscalibrations — not hypothetical
ones. Add these as explicit rules in the rating system prompt.

## Finding: scores don't move when flaws are described but not total

Across three separate tests, the rater's written reasoning correctly
identified a significant, output-changing flaw in a dimension, but the
numeric score stayed in a generous 7-8 range anyway:
- Context scored 7/10 while noting it was unclear which factor should
  dominate an ambiguous case the prompt explicitly contained
- Clarity scored 7/10 while noting the prompt required a clarifying
  round and remained underspecified even after it
- Structure scored 7/10 while describing the prompt as "stream of
  consciousness" and "a rambling brief"

The pattern: dimensions only score low when something is **completely
absent** (e.g. zero examples → correctly scored 4/10). Partial or
described flaws don't move the score much. This means the numeric
score and the written note can contradict each other, which makes the
number less trustworthy than the prose next to it.

### Fix: anchor each score to the note before finalizing
Add this instruction to the rubric system prompt:

> Before assigning a numeric score for any dimension, re-read the note
> you're about to write for that dimension. If the note describes a
> flaw that would meaningfully change how well the output serves the
> user's actual goal — not a purely cosmetic nitpick — the score MUST
> be 5 or below, not 6-8. A score of 7-8 should only be used when the
> note describes minor polish opportunities, not structural or
> substantive gaps. If you find yourself writing a note that reads
> like a real problem but reaching for a 7, that mismatch means the
> score is wrong — lower it.

## Finding: Clarity inflates after a clarifying round

Confirmed directly: a prompt that required a clarifying question
(original phrasing was vague enough that intent wasn't resolvable
without it) scored Clarity 7/10 once the intent became clear.

### Fix: hard cap, not a soft instruction
Replace any existing "reflect original clarity" guidance with a hard
rule:

> If a clarifying question was required to determine the user's
> intent, the Clarity score for that submission is capped at 5/10,
> regardless of how clear the intent becomes after clarification. The
> score describes the prompt as originally submitted. Do not let a
> successful clarification round raise this score — the fact that
> clarification was necessary IS the clarity problem.

## Finding: Structure rewards logical flow over actual scannability

Test 3 used a single unbroken run-on sentence containing genuinely
good content (audience, tone, example, length, CTA requirement all
present) with zero line breaks or sections. It scored 7/10 for
Structure. The content being good is a separate axis from whether it's
formatted for scanning — right now the rater seems to average these
together instead of scoring structure on its own terms.

### Fix: separate "has good information" from "is organized for scanning"
Add:

> Structure measures how easily a human or model can scan and parse
> the prompt — NOT whether good information is present somewhere in
> it (that's covered by Context/Examples/Success criteria). A prompt
> that contains all the right information inside one long run-on
> paragraph, with no sections, headings, or line breaks, should score
> LOW on Structure (3-5) even if every other dimension is strong.
> Reserve 8-10 for prompts with clear visual/logical separation between
> distinct parts (task, context, examples, format), whether via
> headings, numbered lists, or clearly separated paragraphs.

## Finding: Context doesn't penalize missing decision-critical info

Test 1's prompt gave surface-level context (three category names) but
no guidance for the exact ambiguous case the test text represented
(mixed positive/negative sentiment). It scored 7/10. The note correctly
flagged the gap, but see the general fix above — this is really a
symptom of the same root issue, not a separate bug. No additional
Context-specific rule needed beyond the general anchoring fix, but
worth re-testing after the general fix lands to confirm it resolves on
its own.

## Suggested validation after applying these fixes
Re-run Tests 1, 2, and 3 (same prompts) and confirm:
- Test 1 Context drops from 7 into the 4-6 range
- Test 2 Clarity drops to exactly 5 (hard cap)
- Test 3 Structure drops from 7 into the 3-5 range
- Test 1 Examples (4/10) and Test 4 Success criteria (6/10) — which
  were already correctly calibrated — do NOT get accidentally dragged
  down by the stricter general instruction. If everything drops
  uniformly after this fix, the anchoring instruction was too blunt
  and needs softening for dimensions that were already working.
