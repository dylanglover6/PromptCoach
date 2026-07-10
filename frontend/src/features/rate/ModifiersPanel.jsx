import "./ModifiersPanel.css";

const MODIFIER_LABELS = {
  structure: "Structure",
  examples: "Examples",
};

const APPLICABILITY_LABELS = {
  well_organized: "Well organized",
  adequate: "Adequate",
  needs_improvement: "Needs improvement",
  not_applicable: "Not applicable",
  useful: "Useful",
  unnecessary: "Unnecessary",
  missing: "Missing",
  misleading: "Misleading",
};

// Plain tone mapping for now (per the v3 rollout plan) — icons/colors come
// in the next pass once this data layer is confirmed correct.
const TONE_MAP = {
  well_organized: "positive",
  useful: "positive",
  adequate: "neutral",
  unnecessary: "neutral",
  not_applicable: "muted",
  needs_improvement: "attention",
  missing: "attention",
  misleading: "attention",
};

export default function ModifiersPanel({ modifiers }) {
  return (
    <div className="modifiers-panel">
      {Object.entries(modifiers).map(([key, mod]) => (
        <div className={`modifier-badge tone-${TONE_MAP[mod.applicability] || "neutral"}`} key={key}>
          <div className="modifier-badge-header">
            <strong>{MODIFIER_LABELS[key] || key}</strong>
            <span>{APPLICABILITY_LABELS[mod.applicability] || mod.applicability}</span>
          </div>
          <p>{mod.note}</p>
        </div>
      ))}
    </div>
  );
}
