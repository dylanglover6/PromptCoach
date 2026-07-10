export const LESSONS = [
  {
    id: "goal_clarity",
    label: "Goal Clarity",
    kind: "dimension",
    badPrompt: "Write something about dogs.",
    goodPrompt:
      "Write an 800-word blog post comparing Golden Retrievers and German Shepherds for first-time dog owners.",
    why: "The bad version leaves the format, angle, and audience entirely undefined — the model has to guess. The good version states the task, length, and comparison angle up front, so nothing needs to be inferred.",
  },
  {
    id: "relevant_context",
    label: "Relevant Context",
    kind: "dimension",
    badPrompt: "Summarize this article for executives.",
    goodPrompt:
      'Summarize the following article for a non-technical executive audience in under 150 words:\n\n"Renewable energy capacity grew 12% globally last year, driven mainly by solar installations in Asia and government subsidies in Europe..."',
    why: '"This article" is never actually supplied in the bad version — there\'s no input data to work from. The good version includes the source material the task depends on.',
  },
  {
    id: "constraints",
    label: "Constraints",
    kind: "dimension",
    badPrompt:
      'Classify this review into one of: positive, negative, neutral.\n\nReview: "The food was amazing but the service was painfully slow and the waiter was rude."',
    goodPrompt:
      'Classify this review into one of: positive, negative, neutral. If the review contains mixed sentiment, classify based on the dominant tone.\n\nReview: "The food was amazing but the service was painfully slow and the waiter was rude."',
    why: "This specific review genuinely contains both positive and negative signals, and the bad prompt gives no rule for resolving that conflict — two people could reasonably classify it differently. The good version adds one sentence of decision rule that removes the ambiguity.",
  },
  {
    id: "output_specification",
    label: "Output Specification",
    kind: "dimension",
    badPrompt: "Give me info about the top 3 programming languages.",
    goodPrompt:
      "List the top 3 programming languages as a numbered list, each with a one-sentence description, in under 50 words total.",
    why: '"Give me info" could come back as a paragraph, a table, or a single sentence — the shape is undefined. The good version pins down the format, structure, and length so the output is predictable.',
  },
  {
    id: "success_criteria",
    label: "Success Criteria",
    kind: "dimension",
    badPrompt: "Write a good tagline for my coffee shop.",
    goodPrompt:
      'Write a tagline for my coffee shop, under 8 words, that mentions either "community" or "craft" and would work on a storefront sign.',
    why: '"Good" is undefined — any tagline could claim to satisfy the bad prompt. The good version gives concrete, checkable criteria (length, required theme, use case) that let you tell a strong output from a weak one.',
  },
  {
    id: "structure",
    label: "Structure",
    kind: "modifier",
    badPrompt:
      "I need you to write a marketing email for our new productivity app targeting busy professionals aged 25-45 who struggle with time management and the tone should be upbeat and encouraging not preachy and it should be around 150 words and include a clear call to action to start a free trial and the email absolutely must mention our 14-day free trial and the fact that no credit card is required to sign up.",
    goodPrompt:
      "Write a marketing email for our new productivity app.\n\nAudience: busy professionals who struggle with time management\nTone: upbeat, encouraging, not preachy\nLength: ~150 words\nMust include: a clear call to action, the 14-day free trial, no credit card required to sign up",
    why: "Both versions contain the exact same requirements, but the bad one crams them into one dense paragraph a reader has to carefully re-parse. The good version uses line breaks and labels so each requirement is scannable at a glance. This mostly matters for longer, multi-requirement prompts — a short, simple ask doesn't need this treatment.",
  },
  {
    id: "examples",
    label: "Examples",
    kind: "modifier",
    badPrompt:
      'Classify text as positive, negative, or neutral.\n\nText to classify: "The onboarding took longer than I expected but support was responsive."',
    goodPrompt:
      'Classify text as positive, negative, or neutral.\n\nExample: "The product arrived late but works great." → positive\nExample: "Good service, but the price is too high." → negative\n\nText to classify: "The onboarding took longer than I expected but support was responsive."',
    why: "For subjective judgment calls like sentiment classification, a worked example shows exactly how to weigh conflicting signals — something instructions alone often can't fully pin down. Not every prompt needs this: simple, unambiguous tasks don't benefit from examples at all.",
  },
];
