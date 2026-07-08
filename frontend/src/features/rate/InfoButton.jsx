import { useState } from "react";
import { Link } from "react-router-dom";
import "./InfoButton.css";

export default function InfoButton() {
  const [open, setOpen] = useState(false);

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
            A good prompt is clear, gives enough context, includes examples where
            helpful, is well-structured, and states what success looks like —{" "}
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
