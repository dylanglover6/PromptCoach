const DIMENSION_KEYS = ["goal_clarity", "relevant_context", "constraints", "output_specification", "success_criteria"];

// Fixed weights, summing to 100. Applied in CODE, never by the model — the
// model only ever outputs raw 1-10 scores per dimension. This keeps the
// weighted-average math fully deterministic instead of asking the model to
// do arithmetic every call, which is a real source of run-to-run drift.
const DIMENSION_WEIGHTS = {
  goal_clarity: 25,
  relevant_context: 20,
  constraints: 15,
  output_specification: 20,
  success_criteria: 20,
};

const SCORE_FLOOR = 3; // per-dimension floor, out of 10 — unchanged from v2

// A prompt with zero line breaks and at least this many words is treated as
// a mechanical "wall of text" — enforced in code, not left to the model's
// judgment. This dimension has now shown twice (v2's "genuinely a wall of
// text" wording, and the original raw line-break perception bug before that)
// that soft/judgment-based instructions don't reliably override a model's
// tendency to credit good content for good formatting. Below this word
// count, a single unbroken sentence is normal and doesn't need structure.
const WALL_OF_TEXT_WORD_THRESHOLD = 40;
// Matches the "5 or below = real flaw" boundary used everywhere else in the
// rubric (see the general anchoring rule below), and specifically the
// goal_clarity clarification-cap, which lands exactly at 5 — the gate must
// catch that case, not sit one point above it.
const GOAL_CLARITY_GATE_THRESHOLD = 5; // if goal_clarity <= this, cap overall
const GOAL_CLARITY_GATE_CAP = 50; // ...at this value (out of 100)

// Bump whenever RUBRIC_SYSTEM_PROMPT's scoring logic changes materially — a
// rubric change is a measurement change, and past ratings are only
// comparable to new ones if you know which rubric version produced each.
const RUBRIC_VERSION = "2026-07-v3.2";

const RUBRIC_SYSTEM_PROMPT = `You are PromptCoach, an expert at evaluating and improving prompts written for AI models.

Score prompts on 5 core dimensions, each 1-10. These combine into a weighted 100-point score computed separately — you do not need to compute or state the overall score yourself, only the 5 raw dimension scores.

- goal_clarity: is the requested task unambiguous?
- relevant_context: is the necessary background/input present?
- constraints: are requirements, boundaries, and decision rules for handling edge cases defined?
- output_specification: is the desired response FORM clear (format, structure, shape of the answer)?
- success_criteria: can a successful/correct answer be recognized by inspecting the OUTPUT ITSELF against what the prompt actually asked for — not by predicting an external, real-world downstream outcome (e.g. whether a recipient replies, a sale closes, a reader is persuaded) that no prompt could ever specify and no model could ever verify at generation time?

Output Specification vs. Success Criteria — these are easy to blur on simple tasks, do not let one absorb the other: Output Specification owns the SHAPE of the response (e.g. "return one word," "respond in JSON matching this schema," "under 100 words"). Success Criteria owns whether the CONTENT can be judged correct or successful against the prompt's stated and reasonably-implied requirements (e.g. is there a way to verify the classification was right, does the output actually address everything the prompt asked for). A prompt can have a perfectly specified format and still have no way to verify correctness, or vice versa — score them independently, don't let a strong one on paper cover for a weak one. Do not penalize success_criteria for the absence of a real-world outcome metric (engagement, conversion, persuasion) — that is never something a prompt can specify, so its absence is not a gap.

Separately, score 2 modifiers. These are NOT part of the weighted 100-point score — they are shown to the user as independent, non-numeric signals:
- structure: categorical, one of: well_organized, adequate, needs_improvement, not_applicable
- examples: categorical, one of: useful, unnecessary, missing, misleading

Flow rules:
- First round (no clarification yet given): if the prompt has genuinely zero usable context or intent, ask ONE clarifying question with 2-4 multiple-choice options instead of rating. Otherwise provide a rating. insufficient_context is not a valid choice on the first round — if the prompt is too vague to rate, ask the clarifying question instead.
- Second round (a clarifying question and answer are given below): you may no longer ask a clarifying question. If the prompt plus the clarification still has ZERO usable context, use insufficient_context. Otherwise provide a rating.
- Never invent context the user didn't give you. A short prompt with a clear, specific ask is still ratable — "ask a clarifying question" is only for prompts too vague to rate at all.
- When providing a rating, also provide a concise rewritten version of the prompt that fixes its weaknesses. rewritten_prompt must be plain prompt text only — no surrounding braces, quotes, or JSON formatting, even though it's a JSON string value. If it adds something to address a missing/misleading Examples modifier, it must add a genuinely distinct input→output pair — a different case than the one the prompt processes. Labeling or annotating the existing task input (e.g. "Expected output: X" under the same item being processed) does NOT count as adding an example.
- The tool's fields are all present regardless of action, but only the ones relevant to your chosen action matter — set every other field to null.

Scoring process for the 5 core dimensions — do this for every one, every time:
1. Write the specific evidence from the prompt that supports your assessment BEFORE committing to a number. Base the score strictly on that evidence — do not pick a score first and rationalize a note afterward. If no genuine evidence supports a claim, do not make that claim.
2. Re-read the note you just wrote. Ask: if a competent model executed this prompt exactly as written, would a reasonable output plausibly be WRONG, UNUSABLE, or require the user to redo/re-prompt because of this specific gap — not merely less polished than it could be? If yes, the score MUST be 5 or below. If instead the gap is something a competent model would reasonably fill in on its own without missing the user's intent — a conventional structural choice the prompt left unstated, a stylistic/tone nuance with no wrong answer, a rule that's stated in prose but not additionally demonstrated with an example — that is a 7-8 deduction, not 5-or-below. Reserve 9-10 for a note that identifies no material gap at all. If a note reads like a minor nitpick but you're reaching for a 5, the mismatch means the score is wrong — raise it. If a note reads like a real problem but you're reaching for a 7, the mismatch means the score is wrong — lower it.
3. Exception: once a prompt has already addressed the CORE of a gap (states a general rule AND demonstrates it with a matching example), remaining minor nuance should NOT be scored as if the core gap still existed. Test: if you removed only the one remaining nuance you're about to critique, would the prompt still function correctly for the task? If yes, that's a 7-8 deduction, not 5-or-below.

Dimension-specific rules:
- goal_clarity: if a clarifying question was required to determine the user's intent, goal_clarity is capped at 5/10 for that submission, regardless of how clear intent becomes after clarification. The score describes the prompt as originally submitted — a successful clarification round does not raise it. The note must say explicitly that a clarifying round was needed.
- constraints — explicit ambiguity check, required before scoring: first state, in the note, whether the SPECIFIC input given (not the task category in the abstract) contains two or more elements that could reasonably be classified or handled differently (e.g. conflicting sentiment, multiple valid interpretations of the same instruction). Name the specific conflicting elements if so. If the input is genuinely ambiguous this way and the prompt provides neither a decision rule nor a resolving example, constraints scores 5 or below — this is a direct consequence of the input being ambiguous, not a soft judgment call about how "meaningful" the gap feels. Do not let task simplicity elsewhere in the prompt soften this.
- relevant_context vs. constraints: relevant_context owns whether necessary background/input DATA is present (e.g. is the text-to-process given, is the audience/purpose stated). constraints owns whether RULES for handling that data are defined, including edge-case decision rules. A prompt can supply all the right background data and still score low on constraints if it gives no rule for an ambiguous case within that data.

Modifier-specific rules:
- structure: use the "Structural facts" provided in the user message (line break count, headings, lists, word count) exactly as given — do not independently judge formatting by reading the prompt text yourself; you are unreliable at detecting whitespace this way. Use not_applicable for short, simple prompts where structure doesn't meaningfully matter (informed by the word count fact) — do not penalize a short prompt for lacking headings/lists it doesn't need. Use needs_improvement only for longer/complex prompts that are genuinely a wall of text per the structural facts.
- examples — task input vs. few-shot example: distinguish the "task input" (the specific text/data the user wants processed right now) from a "few-shot example" (a demonstrated input→output pair placed elsewhere in the prompt, before the task input, to teach the model the pattern). The task input never counts as an example, no matter how illustrative it looks. Before writing a note claiming an example exists, name the specific distinct input→output pair — if you can't point to one, there are zero examples.
- examples — categorical assessment: first classify whether this task type meaningfully benefits from demonstrated input→output pairs (ambiguous/subjective judgment calls, fuzzy category boundaries, precise structured formats, style/tone matching all benefit; simple self-contained unambiguous instructions do not). Then choose: "useful" if examples are present and genuinely help; "unnecessary" if none are present but the task doesn't need them (say so plainly in the note — do not treat this as a gap); "missing" if the task would benefit from examples and none are given; "misleading" if an example is present but contradicts the stated instructions or would teach the wrong pattern.`;

// note is declared before score so the model writes its evidence for a
// dimension before committing to that dimension's number — property order
// in a strict tool schema is the order the model fills them in.
const dimensionSchema = {
  type: "object",
  properties: {
    note: { type: "string" },
    score: { type: "integer" },
  },
  required: ["note", "score"],
  additionalProperties: false,
};

// Same note-before-label ordering trick applied to the categorical modifiers.
const structureModifierSchema = {
  type: "object",
  properties: {
    note: { type: "string" },
    applicability: {
      type: "string",
      enum: ["well_organized", "adequate", "needs_improvement", "not_applicable"],
    },
  },
  required: ["note", "applicability"],
  additionalProperties: false,
};

const examplesModifierSchema = {
  type: "object",
  properties: {
    note: { type: "string" },
    applicability: {
      type: "string",
      enum: ["useful", "unnecessary", "missing", "misleading"],
    },
  },
  required: ["note", "applicability"],
  additionalProperties: false,
};

// dimensions/modifiers declared before verdict so all scores and modifier
// labels exist before the model writes its summary — same
// generation-order-matches-dependency-order reasoning as dimensionSchema.
// Note there is NO "overall" field here — overall is computed in code by
// computeOverallScore(), never by the model.
const ratingSchema = {
  type: "object",
  properties: {
    dimensions: {
      type: "object",
      properties: Object.fromEntries(DIMENSION_KEYS.map((k) => [k, dimensionSchema])),
      required: DIMENSION_KEYS,
      additionalProperties: false,
    },
    modifiers: {
      type: "object",
      properties: {
        structure: structureModifierSchema,
        examples: examplesModifierSchema,
      },
      required: ["structure", "examples"],
      additionalProperties: false,
    },
    verdict: { type: "string" },
  },
  required: ["dimensions", "modifiers", "verdict"],
  additionalProperties: false,
};

const clarifyingQuestionSchema = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    allow_free_text: { type: "boolean" },
  },
  required: ["question", "options", "allow_free_text"],
  additionalProperties: false,
};

// Anthropic's structured-output input_schema rejects oneOf/allOf/anyOf at the
// top level, so the discriminated union (action -> which fields apply) is
// modeled as a flat object where every field is required but nullable —
// the model fills only the fields relevant to the chosen action and sets
// the rest to null.
function buildRateTool(round) {
  const actions =
    round === 1
      ? ["ask_clarifying_question", "provide_rating"]
      : ["provide_rating", "insufficient_context"];

  const properties = {
    action: { type: "string", enum: actions },
    rating: { anyOf: [ratingSchema, { type: "null" }] },
    rewritten_prompt: { anyOf: [{ type: "string" }, { type: "null" }] },
    insufficient_context_message: { anyOf: [{ type: "string" }, { type: "null" }] },
  };
  const required = ["action", "rating", "rewritten_prompt", "insufficient_context_message"];

  if (round === 1) {
    properties.clarifying_question = { anyOf: [clarifyingQuestionSchema, { type: "null" }] };
    required.push("clarifying_question");
  }

  return {
    name: "submit_prompt_evaluation",
    description: "Submit the evaluation outcome for the user's prompt.",
    strict: true,
    input_schema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  };
}

// Practice mode grades a prompt against a specific, already-known task instead
// of evaluating a prompt cold — so the clarifying-question/insufficient-context
// branches from the main rater don't apply at all (there's nothing to clarify;
// the task is fixed). This is a strictly simpler tool than buildRateTool: no
// "action" discriminated union, no nullable fields — always exactly rating +
// rewritten_prompt, reusing the same ratingSchema (and therefore the same
// dimensions/modifiers/gating) the main rater uses.
function buildPracticeTool() {
  return {
    name: "submit_practice_evaluation",
    description: "Submit the evaluation of the user's prompt against the given task.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        rating: ratingSchema,
        rewritten_prompt: { type: "string" },
      },
      required: ["rating", "rewritten_prompt"],
      additionalProperties: false,
    },
  };
}

// Folds the task's scenario + specific criteria into the same base rubric,
// rather than building a separate criteria-checklist scorer — a missing
// criterion is scored as a real gap in whichever dimension it naturally
// belongs to (constraints, relevant_context, success_criteria, etc.),
// using the exact same anchoring rules already in RUBRIC_SYSTEM_PROMPT.
function buildPracticeSystemPrompt(scenario, criteria) {
  const criteriaList = criteria.map((c) => `- ${c}`).join("\n");
  return `${RUBRIC_SYSTEM_PROMPT}

Practice mode: the user is responding to a specific task, not writing a prompt from scratch.

The task the user was given: "${scenario}"

A strong response to this task should address the following, in whichever dimension each naturally belongs to (do not treat this as a separate checklist — score it through the existing 5 dimensions and 2 modifiers exactly as defined above):
${criteriaList}

A prompt that ignores one of these is a real gap in the corresponding dimension — score it using the same anchoring rules as above, not more leniently just because the task itself is already known. Since the task is fully specified here, always call the tool with a full rating — never ask a clarifying question and never call it insufficient, even if the user's submission is weak, off-topic, or just repeats the task scenario back verbatim without adding anything.`;
}

const REVISE_SYSTEM_PROMPT = `You are PromptCoach, helping a user revise a rewritten prompt that didn't fit their needs.
You will be given the user's original prompt, a rewritten version of it, and the user's feedback on why the rewrite doesn't work for them.
Produce a new rewritten prompt that addresses the feedback while still preserving the original prompt's underlying intent. rewritten_prompt must be plain prompt text only — no surrounding braces, quotes, or JSON formatting, even though it's a JSON string value.`;

const reviseTool = {
  name: "submit_revision",
  description: "Submit a revised rewrite of the user's prompt.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      rewritten_prompt: { type: "string" },
    },
    required: ["rewritten_prompt"],
    additionalProperties: false,
  },
};

// Deterministic, computable-in-code structural signals — handed to the model
// as facts rather than left to its (unreliable) reading of raw whitespace.
function computeStructuralFacts(prompt) {
  const lineBreakCount = (prompt.match(/\n/g) || []).length;
  const hasHeadings = /^#{1,6}\s/m.test(prompt);
  const hasBulletList = /^[-*]\s/m.test(prompt);
  const hasNumberedList = /^\d+\.\s/m.test(prompt);
  const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
  return { lineBreakCount, hasHeadings, hasBulletList, hasNumberedList, wordCount };
}

// Enforces the per-dimension floor, then computes the weighted 100-point
// overall score in code — the model never sees or produces this number.
// Also applies the goal_clarity gate: an unclear task poisons everything
// downstream regardless of how the weighted math would otherwise land.
function computeOverallScore(dimensions) {
  let total = 0;
  for (const key of DIMENSION_KEYS) {
    const flooredScore = Math.max(dimensions[key].score, SCORE_FLOOR);
    dimensions[key].score = flooredScore; // keep displayed sub-score consistent with what was used
    total += (flooredScore / 10) * DIMENSION_WEIGHTS[key];
  }

  let overall = Math.round(total);
  if (dimensions.goal_clarity.score <= GOAL_CLARITY_GATE_THRESHOLD) {
    overall = Math.min(overall, GOAL_CLARITY_GATE_CAP);
  }
  return overall;
}

// Overrides modifiers.structure for the two cases that are fully mechanical
// (zero line breaks) and have proven unreliable to leave as a model
// judgment across two prior rubric versions. Both applicability AND note
// are replaced together — overriding only the label while leaving the
// model's original note in place would reintroduce the exact score/note
// mismatch problem found earlier (e.g. a note praising "logical
// organization" sitting next to a label that says needs_improvement).
// Prompts with at least one line break are left entirely to the model's
// own judgment (well_organized vs. adequate) — that distinction hasn't
// shown the same instability, so there's no reason to take it out of the
// model's hands too.
function enforceStructureModifier(modifiers, structuralFacts) {
  const { lineBreakCount, wordCount } = structuralFacts;

  if (lineBreakCount === 0 && wordCount >= WALL_OF_TEXT_WORD_THRESHOLD) {
    modifiers.structure.applicability = "needs_improvement";
    modifiers.structure.note = `This prompt is ${wordCount} words with zero line breaks, headings, or lists — a single unbroken block of text. Regardless of how clearly it reads, this lacks the visual separation needed to scan a prompt of this length quickly.`;
  } else if (lineBreakCount === 0 && wordCount < WALL_OF_TEXT_WORD_THRESHOLD) {
    modifiers.structure.applicability = "not_applicable";
    modifiers.structure.note = `This prompt is short (${wordCount} words) and doesn't need line breaks or headings to be scannable.`;
  }

  return modifiers;
}

module.exports = {
  DIMENSION_KEYS,
  DIMENSION_WEIGHTS,
  RUBRIC_VERSION,
  RUBRIC_SYSTEM_PROMPT,
  buildRateTool,
  buildPracticeTool,
  buildPracticeSystemPrompt,
  computeStructuralFacts,
  computeOverallScore,
  enforceStructureModifier,
  REVISE_SYSTEM_PROMPT,
  reviseTool,
};
