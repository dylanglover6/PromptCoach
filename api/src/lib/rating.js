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
- When providing a rating, also provide a concise rewritten version of the prompt that fixes its weaknesses.
- Be honest about weaknesses in the notes even though scores have a floor applied afterward.
- The tool's fields are all present regardless of action, but only the ones relevant to your chosen action matter — set every other field to null.`;

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

module.exports = { DIMENSION_KEYS, RUBRIC_SYSTEM_PROMPT, buildRateTool, enforceScoreFloor };
