const { app } = require("@azure/functions");
const Anthropic = require("@anthropic-ai/sdk");
const { REVISE_SYSTEM_PROMPT, reviseTool } = require("../lib/rating");

const MODEL = process.env.RATER_MODEL || "claude-haiku-4-5";

app.http("reviseRewrite", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "rate/revise",
  handler: async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: "Request body must be JSON." } };
    }

    const { originalPrompt, rewrittenPrompt, feedback } = body || {};
    for (const [name, value] of Object.entries({ originalPrompt, rewrittenPrompt, feedback })) {
      if (typeof value !== "string" || value.trim().length === 0) {
        return { status: 400, jsonBody: { error: `"${name}" is required and must be a non-empty string.` } };
      }
    }

    const userContent = `Original prompt:\n"""\n${originalPrompt}\n"""\n\nCurrent rewritten prompt:\n"""\n${rewrittenPrompt}\n"""\n\nUser feedback on the rewrite:\n"""\n${feedback}\n"""`;

    const client = new Anthropic();

    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: REVISE_SYSTEM_PROMPT,
        tools: [reviseTool],
        tool_choice: { type: "tool", name: reviseTool.name },
        messages: [{ role: "user", content: userContent }],
      });
    } catch (err) {
      return { status: 500, jsonBody: { error: "Failed to revise prompt.", detail: err.message } };
    }

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      return { status: 500, jsonBody: { error: "Model did not return a structured revision." } };
    }

    return { jsonBody: toolUse.input };
  },
});
