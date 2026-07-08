const { app } = require("@azure/functions");
const Anthropic = require("@anthropic-ai/sdk");
const { RUBRIC_SYSTEM_PROMPT, buildRateTool, enforceScoreFloor } = require("../lib/rating");

const MODEL = process.env.RATER_MODEL || "claude-haiku-4-5";

app.http("rate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "rate",
  handler: async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: "Request body must be JSON." } };
    }

    const prompt = body?.prompt;
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return { status: 400, jsonBody: { error: "\"prompt\" is required and must be a non-empty string." } };
    }

    const clarification = body?.clarification;
    const round = clarification ? 2 : 1;

    let userContent = `Prompt to evaluate:\n"""\n${prompt}\n"""`;
    if (round === 2) {
      userContent += `\n\nA clarifying question was already asked: "${clarification.question}"\nThe user answered: "${clarification.answer}"\n\nThis is the final round. You must choose provide_rating or insufficient_context now.`;
    }

    const client = new Anthropic();
    const tool = buildRateTool(round);

    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0,
        system: RUBRIC_SYSTEM_PROMPT,
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: userContent }],
      });
    } catch (err) {
      return { status: 500, jsonBody: { error: "Failed to evaluate prompt.", detail: err.message } };
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      return { status: 500, jsonBody: { error: "Model did not return a structured evaluation." } };
    }

    const result = toolUse.input;
    if (result.action === "provide_rating") {
      result.rating = enforceScoreFloor(result.rating);
    }

    return { jsonBody: result };
  },
});
