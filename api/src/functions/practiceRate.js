const { app } = require("@azure/functions");
const Anthropic = require("@anthropic-ai/sdk");
const {
  RUBRIC_VERSION,
  buildPracticeTool,
  buildPracticeSystemPrompt,
  computeStructuralFacts,
  computeOverallScore,
  enforceStructureModifier,
} = require("../lib/rating");
const { getTaskById } = require("../lib/tasks");

const MODEL = process.env.RATER_MODEL || "claude-haiku-4-5";

app.http("practiceRate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "practice/rate",
  handler: async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: "Request body must be JSON." } };
    }

    const { taskId, prompt } = body || {};
    if (typeof taskId !== "string" || taskId.trim().length === 0) {
      return { status: 400, jsonBody: { error: '"taskId" is required and must be a non-empty string.' } };
    }
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return { status: 400, jsonBody: { error: '"prompt" is required and must be a non-empty string.' } };
    }

    const task = getTaskById(taskId);
    if (!task) {
      return { status: 404, jsonBody: { error: `No task found with id "${taskId}".` } };
    }

    const structuralFacts = computeStructuralFacts(prompt);
    const userContent = `Prompt to evaluate:\n"""\n${prompt}\n"""\n\nStructural facts (computed, not your judgment — use these exactly, do not re-derive them by reading the text): line breaks = ${structuralFacts.lineBreakCount}, headings present = ${structuralFacts.hasHeadings}, bullet list present = ${structuralFacts.hasBulletList}, numbered list present = ${structuralFacts.hasNumberedList}, word count = ${structuralFacts.wordCount}.`;

    const client = new Anthropic();
    const tool = buildPracticeTool();
    const systemPrompt = buildPracticeSystemPrompt(task.scenario, task.criteria);

    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0,
        system: systemPrompt,
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
    result.rating.modifiers = enforceStructureModifier(result.rating.modifiers, structuralFacts);
    result.rating.overall = computeOverallScore(result.rating.dimensions);
    result.rubricVersion = RUBRIC_VERSION;
    result.taskId = task.id;

    return { jsonBody: result };
  },
});
