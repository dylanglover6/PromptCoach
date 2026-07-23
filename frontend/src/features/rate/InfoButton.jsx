import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./InfoButton.css";

export default function InfoButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="info-button-wrap">
      <button
        type="button"
        className="info-button"
        aria-label="How prompts are scored"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <div className="info-popover" role="dialog">
          <p>
            A good prompt is clear about the goal, gives the necessary context, defines
            rules for edge cases, specifies the output format, and states what success
            looks like — with structure and examples as a bonus when they help —{" "}
            <Link to="/learn" onClick={() => setOpen(false)}>
              Learn more
            </Link>{" "}
            about each of these.
          </p>
        </div>
      )}
    </div>
  );
}
