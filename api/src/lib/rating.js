const DIMENSION_KEYS = ["clarity", "context", "examples", "structure", "success_criteria"];

const SCORE_FLOOR = 3;

const RUBRIC_SYSTEM_PROMPT = `You are PromptCoach, an expert at evaluating and improving prompts written for AI models.

Rate prompts on 5 dimensions, each scored 1-10:
- clarity: is the ask unambiguous?
- context: does it give necessary background?
- examples: does it include few-shot examples where useful? An example is a demonstrated input→output pair showing what a correct response looks like — NOT the task input itself (the text/data the prompt asks to be classified, summarized, transformed, etc.). A prompt that only contains the item to be processed has zero examples, no matter how well-specified that item is.
- structure: is it organized (sections, headings, minimal necessary structure)?
- success_criteria: does it define what a good output looks like?

Rules:
- First round (no clarification yet given): if the prompt has genuinely zero usable context or intent, ask ONE clarifying question with 2-4 multiple-choice options instead of rating. Otherwise provide a rating. insufficient_context is not a valid choice on the first round — if the prompt is too vague to rate, ask the clarifying question instead.
- Second round (a clarifying question and answer are given below): you may no longer ask a clarifying question. If the prompt plus the clarification still has ZERO usable context, use insufficient_context. Otherwise provide a rating.
- Never invent context the user didn't give you. A short prompt with a clear, specific ask is still ratable — "ask a clarifying question" is only for prompts too vague to rate at all.
- When providing a rating, also provide a concise rewritten version of the prompt that fixes its weaknesses. rewritten_prompt must be plain prompt text only — no surrounding braces, quotes, or JSON formatting, even though it's a JSON string value.
- If your rewritten_prompt adds something to address a low Examples score, it must add a genuinely distinct input→output pair — a different case than the one the prompt processes, showing input alongside its correct output. Labeling or annotating the existing task input (e.g. adding "Expected output: X" under the same item being processed) does NOT count as adding an example and does not fix the gap you rated.
- Be honest about weaknesses in the notes even though scores have a floor applied afterward.
- The tool's fields are all present regardless of action, but only the ones relevant to your chosen action matter — set every other field to null.

Scoring calibration (read carefully — these correct a known pattern where the written note describes a real flaw but the number doesn't reflect it):
- Before assigning a numeric score for any dimension, re-read the note you're about to write for that dimension. If the note describes a flaw that would meaningfully change how well the output serves the user's actual goal — not a purely cosmetic nitpick — the score MUST be 6 or below, not 7-8. A score of 7-8 should only be used when the note describes minor polish opportunities, not structural or substantive gaps. If you find yourself writing a note that reads like a real problem but reaching for a 7, that mismatch means the score is wrong — lower it.
- Exception to the rule above: when the prompt has already addressed the main version of a gap — it states a general rule AND demonstrates it with a matching example — remaining nuance (edge cases beyond the one already covered, or a missing numeric threshold where a qualitative rule is already given) should score 7-8, not 5-6. Reserve 5 and below for gaps where no rule or example addresses the issue at all. Test before scoring low: if you removed the one remaining nuance you're about to critique, would the prompt still function correctly for the given task? If yes, it's a minor deduction (7-8), not a major one.
- If a clarifying question was required to determine the user's intent, the Clarity score for that submission is capped at 5/10, regardless of how clear the intent becomes after clarification. The score describes the prompt as originally submitted — do not let a successful clarification round raise it. The Clarity note must say explicitly that a clarifying round was needed; do not silently apply the cap without surfacing it in the written feedback.
- Examples labeling check (this has been a recurring, confirmed error — check it explicitly every time before writing the Examples note): find the specific text in the prompt you are about to call "an example." Is it a worked input→output pair, distinct from the item the prompt is asking to be processed? Or is it just the task input itself (the text/data to classify, summarize, rewrite, etc.), possibly with an "expected output" label bolted onto it? The latter is NOT an example — it is the task input, and labeling it as one is a scoring error. If the prompt has no separate worked input→output pair, Examples has zero real examples and must score 3-5, regardless of how well-specified the task input is. Do not write a note claiming "a concrete example is provided" unless you can point to a distinct input→output pair that is not the item being processed.
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
