const { app } = require("@azure/functions");
const Anthropic = require("@anthropic-ai/sdk");
const { RUBRIC_VERSION, RUBRIC_SYSTEM_PROMPT, buildRateTool, computeStructuralFacts, computeOverallScore, enforceStructureModifier } = require("../lib/rating");
const { checkRequestAllowed, recordSpend } = require("../lib/costControls");

const MODEL = process.env.RATER_MODEL || "claude-haiku-4-5";
const MAX_PROMPT_LENGTH = Number(process.env.MAX_PROMPT_LENGTH) || 4000;

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
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return { status: 413, jsonBody: { error: `"prompt" must be ${MAX_PROMPT_LENGTH} characters or fewer.` } };
    }

    const rateCheck = await checkRequestAllowed(request);
    if (!rateCheck.allowed) {
      return { status: rateCheck.status, jsonBody: { error: rateCheck.error } };
    }

    const clarification = body?.clarification;
    if (clarification && typeof clarification.answer === "string" && clarification.answer.length > MAX_PROMPT_LENGTH) {
      return { status: 413, jsonBody: { error: `"clarification.answer" must be ${MAX_PROMPT_LENGTH} characters or fewer.` } };
    }
    const round = clarification ? 2 : 1;

    const structuralFacts = computeStructuralFacts(prompt);
    let userContent = `Prompt to evaluate:\n"""\n${prompt}\n"""\n\nStructural facts (computed, not your judgment — use these exactly, do not re-derive them by reading the text): line breaks = ${structuralFacts.lineBreakCount}, headings present = ${structuralFacts.hasHeadings}, bullet list present = ${structuralFacts.hasBulletList}, numbered list present = ${structuralFacts.hasNumberedList}, word count = ${structuralFacts.wordCount}.`;
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
      console.error("rate: Anthropic call failed:", err.message);
      return { status: 500, jsonBody: { error: "Failed to evaluate prompt." } };
    }

    await recordSpend(response.usage);

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      return { status: 500, jsonBody: { error: "Model did not return a structured evaluation." } };
    }

    const result = toolUse.input;
    if (result.action === "provide_rating") {
      result.rating.modifiers = enforceStructureModifier(result.rating.modifiers, structuralFacts);
      result.rating.overall = computeOverallScore(result.rating.dimensions);
    }
    result.rubricVersion = RUBRIC_VERSION;

    return { jsonBody: result };
  },
});
