import { useEffect, useState } from "react";
import "../rate/RatePrompt.css";
import "./PracticePage.css";
import DimensionsPanel from "../rate/DimensionsPanel";
import ModifiersPanel from "../rate/ModifiersPanel";
import RewritePanel from "../rate/RewritePanel";

async function fetchTasks() {
  const res = await fetch("/api/tasks");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

async function submitPracticeRate(taskId, prompt) {
  const res = await fetch("/api/practice/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, prompt }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function PracticePage() {
  const [tasks, setTasks] = useState([]);
  const [phase, setPhase] = useState("loading-tasks"); // loading-tasks | list | form | grading | rating | error
  const [selectedTask, setSelectedTask] = useState(null);
  const [promptText, setPromptText] = useState("");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchTasks()
      .then((data) => {
        setTasks(data);
        setPhase("list");
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setPhase("error");
      });
  }, []);

  function selectTask(task) {
    setSelectedTask(task);
    setPromptText("");
    setResult(null);
    setErrorMessage("");
    setPhase("form");
  }

  function backToList() {
    setSelectedTask(null);
    setPhase("list");
  }

  async function submitPrompt(e) {
    e.preventDefault();
    if (!promptText.trim()) return;
    setPhase("grading");
    try {
      const data = await submitPracticeRate(selectedTask.id, promptText);
      setResult(data);
      setPhase("rating");
    } catch (err) {
      setErrorMessage(err.message);
      setPhase("form");
    }
  }

  return (
    <section className="rate-prompt practice-page">
      <h1>Practice</h1>

      {phase === "loading-tasks" && <p>Loading tasks...</p>}

      {phase === "error" && !selectedTask && <p className="rate-error">{errorMessage}</p>}

      {phase === "list" && (
        <div className="task-list">
          {tasks.map((task) => (
            <button type="button" className="task-card" key={task.id} onClick={() => selectTask(task)}>
              {task.isCapstone && <span className="task-capstone-tag">Capstone</span>}
              <strong>{task.title}</strong>
              <span className="task-category">{task.category.replaceAll("_", " ")}</span>
            </button>
          ))}
        </div>
      )}

      {(phase === "form" || phase === "grading") && selectedTask && (
        <div className="task-form">
          <button type="button" className="task-back-link" onClick={backToList}>
            ← Back to tasks
          </button>
          <h2>{selectedTask.title}</h2>
          <p className="task-scenario">{selectedTask.scenario}</p>
          <form className="rate-form" onSubmit={submitPrompt}>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Write your prompt to solve this task..."
              rows={8}
              disabled={phase === "grading"}
            />
            <button type="submit" disabled={phase === "grading" || !promptText.trim()}>
              {phase === "grading" ? "Grading..." : "Submit prompt"}
            </button>
            {errorMessage && <p className="rate-error">{errorMessage}</p>}
          </form>
        </div>
      )}

      {phase === "rating" && result && selectedTask && (
        <div className="rate-result">
          <button type="button" className="task-back-link" onClick={backToList}>
            ← Back to tasks
          </button>
          <div className="rate-overall">
            <span className="rate-score">{result.rating.overall}/100</span>
            <span className="rate-verdict">{result.rating.verdict}</span>
          </div>
          <DimensionsPanel dimensions={result.rating.dimensions} />
          <ModifiersPanel modifiers={result.rating.modifiers} />
          <RewritePanel originalPrompt={promptText} rewrittenPrompt={result.rewritten_prompt} />
          <button onClick={backToList}>Try another task</button>
        </div>
      )}
    </section>
  );
}
