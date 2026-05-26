import React, { useState } from "react";
import Login from "./components/Login.jsx";
import PastInfo from "./components/PastInfo.jsx";
import Session from "./components/Session.jsx";
import Insights from "./components/Insights.jsx";
import DemoTour from "./components/DemoTour.jsx";
import { api } from "./api.js";

export default function App() {
  const [player, setPlayer] = useState(null);
  const [tab, setTab] = useState("past");
  const [lastSessionId, setLastSessionId] = useState(null);
  const [sessionsNonce, setSessionsNonce] = useState(0); // bump → Insights refetches
  const [demo, setDemo] = useState(false);
  const [seededSession, setSeededSession] = useState(null);
  const [toast, setToast] = useState(null);

  async function autoLogin(u, p) {
    const { player } = await api.login(u, p);
    setPlayer(player);
  }

  function seedSession() {
    setSeededSession({
      session_type: "practice",
      drill_focus: "transition 3s + closeouts",
      coach_notes:
        "Looked sharp early; legs went flat in the 3rd block. " +
        "Need cleaner footwork on closeouts. Mentioned slight right-knee tightness — monitor.",
      shots_taken: 42,
      shots_made: 19,
      sprint_count: 18,
      avg_heart_rate: 162,
      perceived_exertion_0_10: 8,
      pain_flags: "right knee",
    });
  }

  function handleSessionSaved(sessionId) {
    setLastSessionId(sessionId);
    setSessionsNonce((n) => n + 1);
    setToast({
      message: `Session #${sessionId} saved. Added to Insights feed.`,
      action: { label: "View", run: () => { setTab("insights"); setToast(null); } },
    });
    setTimeout(() => setToast(null), 6000);
  }

  if (!player) {
    return (
      <>
        <Login onLogin={setPlayer} onDemo={() => setDemo(true)} />
        {demo && (
          <DemoTour
            onAutoLogin={autoLogin}
            onSetTab={setTab}
            onSeedSession={seedSession}
            onClose={() => setDemo(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="dot" />
          HOOPS&nbsp;AI <span className="sub">Coach Console</span>
        </div>
        <div className="who">
          <span className="pill">{player.full_name}</span>
          <span>{player.team} · {player.position}</span>
          <button className="btn ghost" onClick={() => setDemo(true)}>View Demo</button>
          <button className="btn ghost" onClick={() => setPlayer(null)}>Sign out</button>
        </div>
      </header>

      <main className="main">
        <div className="tabs">
          <button id="tab-past" className={`tab ${tab === "past" ? "active" : ""}`} onClick={() => setTab("past")}>
            Past Info
          </button>
          <button id="tab-session" className={`tab ${tab === "session" ? "active" : ""}`} onClick={() => setTab("session")}>
            Live Session
          </button>
          <button id="tab-insights" className={`tab ${tab === "insights" ? "active" : ""}`} onClick={() => setTab("insights")}>
            Insights
          </button>
        </div>

        {tab === "past" && <PastInfo key={`past-${player.id}`} player={player} />}
        {tab === "session" && (
          <Session
            key={`sess-${player.id}`}
            player={player}
            prefill={seededSession}
            onSaved={handleSessionSaved}
          />
        )}
        {tab === "insights" && (
          <Insights
            key={`ins-${player.id}`}
            player={player}
            currentSessionId={lastSessionId}
            refreshNonce={sessionsNonce}
          />
        )}
      </main>

      {toast && (
        <div className="toast">
          <span>{toast.message}</span>
          {toast.action && (
            <button onClick={toast.action.run}>{toast.action.label}</button>
          )}
        </div>
      )}

      {demo && (
        <DemoTour
          onAutoLogin={autoLogin}
          onSetTab={setTab}
          onSeedSession={seedSession}
          onClose={() => setDemo(false)}
        />
      )}
    </div>
  );
}
