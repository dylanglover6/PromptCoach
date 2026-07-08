import { useState } from "react";
import Tabs from "../../components/Tabs";

const DIMENSION_LABELS = {
  clarity: "Clarity",
  context: "Context",
  examples: "Examples",
  structure: "Structure",
  success_criteria: "Success criteria",
};

export default function DimensionsPanel({ dimensions }) {
  const keys = Object.keys(dimensions);
  const [activeId, setActiveId] = useState(keys[0]);
  const tabs = keys.map((key) => ({ id: key, label: DIMENSION_LABELS[key] || key }));
  const active = dimensions[activeId];

  return (
    <div className="dimensions-panel">
      <Tabs tabs={tabs} activeId={activeId} onChange={setActiveId} />
      <div className="dimensions-content">
        <div className="rate-dimension-header">
          <strong>{DIMENSION_LABELS[activeId] || activeId}</strong>
          <span>{active.score}/10</span>
        </div>
        <p>{active.note}</p>
      </div>
    </div>
  );
}
