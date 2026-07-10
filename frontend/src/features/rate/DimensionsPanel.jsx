const DIMENSION_LABELS = {
  goal_clarity: "Goal clarity",
  relevant_context: "Relevant context",
  constraints: "Constraints",
  output_specification: "Output specification",
  success_criteria: "Success criteria",
};

export default function DimensionsPanel({ dimensions }) {
  return (
    <details className="dimensions-panel">
      <summary>Rating details</summary>
      <div className="dimensions-content">
        {Object.entries(dimensions).map(([key, dim]) => (
          <div className="rate-dimension" key={key}>
            <div className="rate-dimension-header">
              <strong>{DIMENSION_LABELS[key] || key}</strong>
              <span>{dim.score}/10</span>
            </div>
            <p>{dim.note}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
