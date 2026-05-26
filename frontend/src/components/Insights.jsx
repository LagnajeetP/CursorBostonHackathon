import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { Bars, TrendLine } from "./charts.jsx";


/**
 * Insights tab.
 *  - Pulls the full session list and re-pulls whenever `refreshNonce` changes
 *    (parent bumps this every time a new session is saved).
 *  - Shows a feed of all sessions (newest first) and lets you click to expand
 *    the deep Claude (Sonnet) analysis for that one.
 *  - Renders trend charts across the recent sessions (RPE, FG%).
 */
export default function Insights({ player, currentSessionId, refreshNonce }) {
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(currentSessionId || null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Reload sessions whenever the player changes OR the parent signals a new save.
  useEffect(() => {
    let cancelled = false;
    api.sessions(player.id).then((rows) => {
      if (cancelled) return;
      setSessions(rows);
      // Auto-select the just-saved session if provided, else the newest.
      if (currentSessionId && rows.some((r) => r.id === currentSessionId)) {
        setSelected(currentSessionId);
      } else if (!selected && rows[0]) {
        setSelected(rows[0].id);
      }
    });
    return () => { cancelled = true; };
  }, [player.id, refreshNonce, currentSessionId]);

  useEffect(() => {
    if (!selected) { setText(""); return; }
    fetchInsights(false);
  }, [selected]);

  async function fetchInsights(force) {
    setLoading(true); setErr(""); setText("");
    try {
      const res = await api.insights(selected, force);
      setText(res.insights || "");
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Build chart data from the visible session list (oldest -> newest).
  const sessionTrend = useMemo(() => {
    return [...sessions].reverse().map((s, i) => {
      const fg = computeFg(s);
      return {
        label: `#${s.id}`,
        idx: `S${i + 1}`,
        RPE: s.perceived_exertion_0_10 ?? null,
        "FG%": fg == null ? null : +(fg * 100).toFixed(1),
      };
    });
  }, [sessions]);

  const totalSessions = sessions.length;
  const flaggedCount = sessions.filter((s) => s.pain_flags).length;
  const avgRpe = average(sessions.map((s) => s.perceived_exertion_0_10));

  return (
    <>
      {/* Top summary strip */}
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="card">
          <span className="accent" />
          <div className="head"><h3>Sessions Logged</h3><span className="badge gold">Live</span></div>
          <div className="stat-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Mini label="Total" value={totalSessions} />
            <Mini label="With Pain Flags" value={flaggedCount} warn={flaggedCount > 0} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            New sessions appear here the instant you save them.
          </div>
        </div>
        <div className="card">
          <div className="head"><h3>RPE / Session</h3><span className="badge">0–10</span></div>
          <div className="chart-wrap" style={{ height: 130 }}>
            <Bars
              data={sessionTrend}
              xKey="idx"
              yKey="RPE"
              color="#e63946"
              referenceY={avgRpe}
              yLabel="RPE"
            />
          </div>
        </div>
        <div className="card">
          <div className="head"><h3>FG% / Session</h3><span className="badge">live</span></div>
          <div className="chart-wrap" style={{ height: 130 }}>
            <TrendLine
              data={sessionTrend}
              xKey="idx"
              yKey="FG%"
              color="#e6edf3"
              yLabel="PCT"
              unit="%"
              yDomain={[0, 100]}
            />
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        {/* Feed */}
        <div className="card">
          <span className="accent" />
          <div className="head">
            <h3>Session Feed</h3>
            <span className="badge">{totalSessions} total</span>
          </div>
          {sessions.length === 0 ? (
            <div className="empty">No sessions yet. Log one in the Live Session tab.</div>
          ) : (
            <div className="session-feed">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={"session-row" + (selected === s.id ? " selected" : "")}
                  onClick={() => setSelected(s.id)}
                >
                  <div className="num">#{s.id}</div>
                  <div>
                    <div className="title-line">
                      {s.session_type}{s.drill_focus ? ` · ${s.drill_focus}` : ""}
                    </div>
                    <div className="meta">
                      {s.created_at}
                      {s.perceived_exertion_0_10 != null && ` · RPE ${s.perceived_exertion_0_10}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {s.pain_flags && <span className="badge red">⚠ {s.pain_flags}</span>}
                    {s.ai_quick_summary && <span className="badge gold">AI ✓</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RAG explainer */}
        <div className="card">
          <span className="accent" />
          <div className="head">
            <h3>How it's grounded · RAG</h3>
            <span className="badge gold">Claude Sonnet</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
            <li>Player intake + medical notes</li>
            <li>Last 7 days of health (HRV, sleep, soreness)</li>
            <li>Last 5 game stat lines</li>
            <li>Last 3 prior session notes for trend continuity</li>
            <li>All of it goes into a strict <code>&lt;context&gt;</code> block — Claude cites fields and refuses to invent stats.</li>
          </ul>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
            Cached per session to keep API spend down. Re-run only when needed.
          </div>
        </div>
      </div>

      {/* Detailed analysis */}
      <div className="section-title">
        <h2>Detailed Analysis</h2>
        <div className="line" />
        {selected && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={() => fetchInsights(false)} disabled={loading}>
              {loading ? "Analyzing…" : "Load"}
            </button>
            <button className="btn" onClick={() => fetchInsights(true)} disabled={loading}>
              Re-run Claude
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <span className="accent" />
        <div className="head">
          <h3>{selected ? `Session #${selected}` : "No session selected"}</h3>
          {loading && <span className="thinking"><span className="dot-mini" /> Sonnet thinking…</span>}
        </div>
        {err && <div style={{ color: "var(--red-soft)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        {loading ? (
          <>
            <div className="shimmer" />
            <div className="shimmer" style={{ width: "92%" }} />
            <div className="shimmer" style={{ width: "78%" }} />
            <div className="shimmer" style={{ width: "85%" }} />
          </>
        ) : (
          <div className="ai-output">{text || (selected ? "Press “Load”." : "Select a session from the feed.")}</div>
        )}
      </div>
    </>
  );
}

function Mini({ label, value, warn }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ color: warn ? "var(--red-soft)" : "var(--ice)" }}>{value ?? "—"}</div>
    </div>
  );
}

function computeFg(s) {
  if (!s.shots_taken || s.shots_taken <= 0) return null;
  return (s.shots_made ?? 0) / s.shots_taken;
}

function average(arr) {
  const xs = arr.filter((v) => v != null);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
