import { useEffect, useState } from "react";
import "./SplashScreen.css";

const STORAGE_KEY = "promptcoach.splashSeen";

function hasSeenSplash() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // localStorage unavailable (e.g. sandboxed/private mode) — splash will
    // simply reappear next load, which is an acceptable fallback.
  }
}

export default function SplashScreen({ onDone }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function dismiss() {
    markSplashSeen();
    setClosing(true);
    setTimeout(onDone, 350);
  }

  return (
    <div className={`splash-screen ${closing ? "splash-closing" : ""}`} role="dialog" aria-label="Welcome to Prompt Coach">
      <div className="splash-board">
        <div className="app-icon-slot splash-icon" aria-hidden="true">
          icon
        </div>

        <h1 className="splash-title">
          <span className="splash-write">Prompt Coach</span>
        </h1>

        <p className="splash-tagline chalk-underline">Write prompts that actually get you what you want.</p>

        <p className="splash-body">
          Prompt Coach is a coach for your prompts — it rates what you write against the
          things that make prompts work, shows you exactly what's missing, and rewrites
          it sharper so you can see the difference.
        </p>

        <button type="button" className="splash-enter" onClick={dismiss} autoFocus>
          Get started
        </button>
      </div>
    </div>
  );
}

export { hasSeenSplash };
