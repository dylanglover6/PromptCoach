import { useState } from "react";
import Tabs from "../../components/Tabs";
import "./RewritePanel.css";

const TABS = [
  { id: "rewritten", label: "Rewritten" },
  { id: "original", label: "Original" },
  { id: "side-by-side", label: "Side by side", hideOnMobile: true },
];

export default function RewritePanel({ originalPrompt, rewrittenPrompt }) {
  const [activeId, setActiveId] = useState("rewritten");
  const [currentRewrite, setCurrentRewrite] = useState(rewrittenPrompt);
  const [copied, setCopied] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [revising, setRevising] = useState(false);
  const [reviseError, setReviseError] = useState("");

  async function copyToClipboard() {
    await navigator.clipboard.writeText(currentRewrite);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submitFeedback(e) {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setRevising(true);
    setReviseError("");
    try {
      const res = await fetch("/api/rate/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalPrompt,
          rewrittenPrompt: currentRewrite,
          feedback: feedbackText,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setCurrentRewrite(data.rewritten_prompt);
      setFeedbackOpen(false);
      setFeedbackText("");
    } catch (err) {
      setReviseError(err.message);
    } finally {
      setRevising(false);
    }
  }

  return (
    <div className="rewrite-panel">
      <div className="rewrite-panel-header">
        <h2>Rewritten prompt</h2>
        <button type="button" className="copy-button" onClick={copyToClipboard}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Tabs tabs={TABS} activeId={activeId} onChange={setActiveId} />

      {activeId === "rewritten" && <pre>{currentRewrite}</pre>}
      {activeId === "original" && <pre>{originalPrompt}</pre>}
      {activeId === "side-by-side" && (
        <div className="rewrite-side-by-side">
          <div>
            <h3>Original</h3>
            <pre>{originalPrompt}</pre>
          </div>
          <div>
            <h3>Rewritten</h3>
            <pre>{currentRewrite}</pre>
          </div>
        </div>
      )}

      {!feedbackOpen && (
        <button type="button" className="feedback-toggle" onClick={() => setFeedbackOpen(true)}>
          This doesn't fit my needs
        </button>
      )}
      {feedbackOpen && (
        <form className="feedback-form" onSubmit={submitFeedback}>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="What doesn't work about this rewrite?"
            rows={3}
            disabled={revising}
          />
          <div className="feedback-form-actions">
            <button type="submit" disabled={revising || !feedbackText.trim()}>
              {revising ? "Revising..." : "Submit feedback"}
            </button>
            <button type="button" onClick={() => setFeedbackOpen(false)} disabled={revising}>
              Cancel
            </button>
          </div>
          {reviseError && <p className="rate-error">{reviseError}</p>}
        </form>
      )}
    </div>
  );
}
