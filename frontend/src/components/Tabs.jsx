import "./Tabs.css";

export default function Tabs({ tabs, activeId, onChange, className = "" }) {
  return (
    <div className={`tabs-strip ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeId}
          className={`tabs-tab ${tab.id === activeId ? "active" : ""} ${tab.hideOnMobile ? "hide-on-mobile" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
