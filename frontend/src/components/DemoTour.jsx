import React, { useEffect, useState } from "react";
import { api } from "../api.js";

/**
 * Guided walkthrough. Auto-logs in as jstar, then steps through each tab
 * pausing at each milestone for the user to read the explanation.
 */
export default function DemoTour({ onAutoLogin, onSetTab, onSeedSession, onClose }) {
  const [steps, setSteps] = useState([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    api.demoScript().then((res) => setSteps(res.steps || []));
  }, []);

  async function advance() {
    const step = steps[i];
    if (!step) return;
    if (step.target === "login") await onAutoLogin("jstar", "demo");
    if (step.target === "tab-past") onSetTab("past");
    if (step.target === "tab-session") {
      onSetTab("session");
      onSeedSession();
    }
    if (step.target === "btn-save-session") onSetTab("session");
    if (step.target === "tab-insights") onSetTab("insights");
    setI((x) => x + 1);
  }

  if (!steps.length) return null;
  if (i >= steps.length) {
    return (
      <div className="coachmark-overlay" onClick={onClose}>
        <div className="coachmark" onClick={(e) => e.stopPropagation()}>
          <h4>Demo complete</h4>
          <div className="body">
            You've seen the full coach loop: intake/history → live session → grounded AI insights.
            Click anywhere to close.
          </div>
          <div className="actions">
            <span className="progress">{steps.length}/{steps.length}</span>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  const step = steps[i];
  return (
    <div className="coachmark-overlay">
      <div className="coachmark">
        <h4>Demo · Step {i + 1}</h4>
        <div className="body">{step.text}</div>
        <div className="actions">
          <span className="progress">{i + 1}/{steps.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Exit</button>
            <button className="btn" onClick={advance}>
              {i === steps.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
