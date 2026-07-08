const DIMENSION_KEYS = ["clarity", "context", "examples", "structure", "success_criteria"];

const SCORE_FLOOR = 3;

const RUBRIC_SYSTEM_PROMPT = `You are PromptCoach, an expert at evaluating and improving prompts written for AI models.

Rate prompts on 5 dimensions, each scored 1-10:
- clarity: is the ask unambiguous?
- context: does it give necessary background?
- examples: does it include few-shot examples where useful?
- structure: is it organized (sections, headings, minimal necessary structure)?
- success_criteria: does it define what a good output looks like?

Rules:
- First round (no clarification yet given): if the prompt has genuinely zero usable context or intent, ask ONE clarifying question with 2-4 multiple-choice options instead of rating. Otherwise provide a rating. insufficient_context is not a valid choice on the first round — if the prompt is too vague to rate, ask the clarifying question instead.
- Second round (a clarifying question and answer are given below): you may no longer ask a clarifying question. If the prompt plus the clarification still has ZERO usable context, use insufficient_context. Otherwise provide a rating.
- Never invent context the user didn't give you. A short prompt with a clear, specific ask is still ratable — "ask a clarifying question" is only for prompts too vague to rate at all.
- When providing a rating, also provide a concise rewritten version of the prompt that fixes its weaknesses. rewritten_prompt must be plain prompt text only — no surrounding braces, quotes, or JSON formatting, even though it's a JSON string value.
- Be honest about weaknesses in the notes even though scores have a floor applied afterward.
- The tool's fields are all present regardless of action, but only the ones relevant to your chosen action matter — set every other field to null.

Scoring calibration (read carefully — these correct a known pattern where the written note describes a real flaw but the number doesn't reflect it):
- Before assigning a numeric score for any dimension, re-read the note you're about to write for that dimension. If the note describes a flaw that would meaningfully change how well the output serves the user's actual goal — not a purely cosmetic nitpick — the score MUST be 6 or below, not 7-8. A score of 7-8 should only be used when the note describes minor polish opportunities, not structural or substantive gaps. If you find yourself writing a note that reads like a real problem but reaching for a 7, that mismatch means the score is wrong — lower it.
- If a clarifying question was required to determine the user's intent, the Clarity score for that submission is capped at 5/10, regardless of how clear the intent becomes after clarification. The score describes the prompt as originally submitted — do not let a successful clarification round raise it. The Clarity note must say explicitly that a clarifying round was needed; do not silently apply the cap without surfacing it in the written feedback.
- Structure measures how easily a human or model can scan and parse the prompt — NOT whether good information is present somewhere in it (that's covered by Context/Examples/Success criteria). A prompt that contains all the right information inside one long run-on paragraph, with no sections, headings, or line breaks, should score LOW on Structure (3-5) even if every other dimension is strong. Reserve 8-10 for prompts with clear visual/logical separation between distinct parts (task, context, examples, format), whether via headings, numbered lists, or clearly separated paragraphs.`;

const dimensionSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    note: { type: "string" },
  },
  required: ["score", "note"],
  additionalProperties: false,
};

const ratingSchema = {
  type: "object",
  properties: {
    overall: { type: "integer" },
    verdict: { type: "string" },
    dimensions: {
      type: "object",
      properties: Object.fromEntries(DIMENSION_KEYS.map((k) => [k, dimensionSchema])),
      required: DIMENSION_KEYS,
      additionalProperties: false,
    },
  },
  required: ["overall", "verdict", "dimensions"],
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

function enforceScoreFloor(rating) {
  if (!rating) return rating;
  rating.overall = Math.max(rating.overall, SCORE_FLOOR);
  for (const key of DIMENSION_KEYS) {
    if (rating.dimensions?.[key]) {
      rating.dimensions[key].score = Math.max(rating.dimensions[key].score, SCORE_FLOOR);
    }
  }
  return rating;
}

module.exports = {
  DIMENSION_KEYS,
  RUBRIC_SYSTEM_PROMPT,
  buildRateTool,
  enforceScoreFloor,
  REVISE_SYSTEM_PROMPT,
  reviseTool,
};
