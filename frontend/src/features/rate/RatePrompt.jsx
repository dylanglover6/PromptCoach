import { useState } from "react";
import "./RatePrompt.css";

const DIMENSION_LABELS = {
  clarity: "Clarity",
  context: "Context",
  examples: "Examples",
  structure: "Structure",
  success_criteria: "Success criteria",
};

async function callRate(body) {
  const res = await fetch("/api/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function RatePrompt() {
  const [promptText, setPromptText] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | clarifying | rating | insufficient | error
  const [clarifyingQuestion, setClarifyingQuestion] = useState(null);
  const [freeTextAnswer, setFreeTextAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function submitInitial(e) {
    e.preventDefault();
    if (!promptText.trim()) return;
    setPhase("loading");
    try {
      const data = await callRate({ prompt: promptText });
      handleResponse(data);
    } catch (err) {
      setErrorMessage(err.message);
      setPhase("error");
    }
  }

  async function submitClarification(answer) {
    if (!answer.trim()) return;
    setPhase("loading");
    try {
      const data = await callRate({
        prompt: promptText,
        clarification: { question: clarifyingQuestion.question, answer },
      });
      handleResponse(data);
    } catch (err) {
      setErrorMessage(err.message);
      setPhase("error");
    }
  }

  function handleResponse(data) {
    if (data.action === "ask_clarifying_question") {
      setClarifyingQuestion(data.clarifying_question);
      setFreeTextAnswer("");
      setPhase("clarifying");
    } else if (data.action === "provide_rating") {
      setResult(data);
      setPhase("rating");
    } else {
      setResult(data);
      setPhase("insufficient");
    }
  }

  function reset() {
    setPromptText("");
    setClarifyingQuestion(null);
    setFreeTextAnswer("");
    setResult(null);
    setErrorMessage("");
    setPhase("idle");
  }

  return (
    <section className="rate-prompt">
      <h1>Rate my prompt</h1>

      {(phase === "idle" || phase === "loading" || phase === "error") && (
        <form className="rate-form" onSubmit={submitInitial}>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Paste the prompt you want rated..."
            rows={8}
            disabled={phase === "loading"}
          />
          <button type="submit" disabled={phase === "loading" || !promptText.trim()}>
            {phase === "loading" ? "Evaluating..." : "Rate my prompt"}
          </button>
          {phase === "error" && <p className="rate-error">{errorMessage}</p>}
        </form>
      )}

      {phase === "clarifying" && clarifyingQuestion && (
        <div className="rate-clarifying">
          <p className="rate-question">{clarifyingQuestion.question}</p>
          <div className="rate-options">
            {clarifyingQuestion.options.map((option) => (
              <button key={option} onClick={() => submitClarification(option)}>
                {option}
              </button>
            ))}
          </div>
          {clarifyingQuestion.allow_free_text && (
            <form
              className="rate-free-text"
              onSubmit={(e) => {
                e.preventDefault();
                submitClarification(freeTextAnswer);
              }}
            >
              <input
                type="text"
                value={freeTextAnswer}
                onChange={(e) => setFreeTextAnswer(e.target.value)}
                placeholder="Or type your own answer..."
              />
              <button type="submit" disabled={!freeTextAnswer.trim()}>
                Submit
              </button>
            </form>
          )}
        </div>
      )}

      {phase === "rating" && result && (
        <div className="rate-result">
          <div className="rate-overall">
            <span className="rate-score">{result.rating.overall}/10</span>
            <span className="rate-verdict">{result.rating.verdict}</span>
          </div>
          <div className="rate-dimensions">
            {Object.entries(result.rating.dimensions).map(([key, dim]) => (
              <div className="rate-dimension" key={key}>
                <div className="rate-dimension-header">
                  <strong>{DIMENSION_LABELS[key] || key}</strong>
                  <span>{dim.score}/10</span>
                </div>
                <p>{dim.note}</p>
              </div>
            ))}
          </div>
          <div className="rate-rewrite">
            <h2>Rewritten prompt</h2>
            <pre>{result.rewritten_prompt}</pre>
          </div>
          <button onClick={reset}>Rate another prompt</button>
        </div>
      )}

      {phase === "insufficient" && result && (
        <div className="rate-insufficient">
          <p>{result.insufficient_context_message}</p>
          <button onClick={reset}>Add more detail and try again</button>
        </div>
      )}
    </section>
  );
}
