import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { RadialGauge } from "./charts.jsx";

const EMPTY = {
  session_type: "practice",
  coach_notes: "",
  drill_focus: "",
  shots_taken: "",
  shots_made: "",
  sprint_count: "",
  avg_heart_rate: "",
  perceived_exertion_0_10: "",
  pain_flags: "",
};

/**
 * Live Session tab. Three sections per the spec:
 *   1. Coach Written Human Notes
 *   2. Base Data Displayed on Screen (live metrics + FG% gauge)
 *   3. AI Recommendation (Claude Haiku quick summary)
 *
 * After save we call onSaved(sessionId) so the parent can refresh the global
 * sessions list and pop the user over to the Insights tab.
 */
export default function Session({ player, onSaved, prefill }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [aiSummary, setAiSummary] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (prefill) setForm((f) => ({ ...f, ...prefill }));
  }, [prefill]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true); setErr(""); setAiSummary("");
    try {
      const body = {
        player_id: player.id,
        session_type: form.session_type,
        coach_notes: form.coach_notes || null,
        drill_focus: form.drill_focus || null,
        shots_taken: numOrNull(form.shots_taken),
        shots_made: numOrNull(form.shots_made),
        sprint_count: numOrNull(form.sprint_count),
        avg_heart_rate: numOrNull(form.avg_heart_rate),
        perceived_exertion_0_10: numOrNull(form.perceived_exertion_0_10),
        pain_flags: form.pain_flags || null,
      };
      const res = await api.createSession(body);
      setSavedId(res.session_id);
      setAiSummary(res.ai_quick_summary || "");
      onSaved?.(res.session_id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const fgFraction = computeFg(form.shots_made, form.shots_taken);
  const fgPct = fgFraction == null ? null : fgFraction * 100;
  const rpe = numOrNull(form.perceived_exertion_0_10);
  const painFlagCount = form.pain_flags ? form.pain_flags.split(",").filter(Boolean).length : 0;

  return (
    <div className="grid cols-2">
      {/* SECTION 1: Coach Notes */}
      <div className="card">
        <span className="accent" />
        <div className="head">
          <h3>Coach Notes</h3>
          <span className="badge">Section 1</span>
        </div>
        <textarea
          rows={10}
          placeholder={`What did you observe today?\n\n• Footwork in closeouts\n• Decision-making in the pick-and-roll\n• Body language late in scrimmage…`}
          value={form.coach_notes}
          onChange={(e) => set("coach_notes", e.target.value)}
        />
        <div style={{ marginTop: 14 }} className="form-grid">
          <div className="field">
            <label>Session type</label>
            <select value={form.session_type} onChange={(e) => set("session_type", e.target.value)}>
              <option>practice</option>
              <option>film</option>
              <option>conditioning</option>
              <option>game</option>
            </select>
          </div>
          <div className="field">
            <label>Drill focus</label>
            <input
              placeholder="e.g. transition 3, weak-hand finishing"
              value={form.drill_focus}
              onChange={(e) => set("drill_focus", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Live metrics + gauge */}
      <div className="card">
        <span className="accent" />
        <div className="head">
          <h3>Live Metrics</h3>
          <span className="badge gold">Section 2 · Base Data</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 16, alignItems: "center" }}>
          <div className="form-grid">
            <Field label="Shots taken" v={form.shots_taken} onChange={(v) => set("shots_taken", v)} />
            <Field label="Shots made" v={form.shots_made} onChange={(v) => set("shots_made", v)} />
            <Field label="Sprints" v={form.sprint_count} onChange={(v) => set("sprint_count", v)} />
            <Field label="Avg HR (bpm)" v={form.avg_heart_rate} onChange={(v) => set("avg_heart_rate", v)} />
            <Field label="RPE (0–10)" v={form.perceived_exertion_0_10} onChange={(v) => set("perceived_exertion_0_10", v)} />
            <div className="field">
              <label>Pain flags</label>
              <input
                placeholder="comma-separated (e.g. right knee)"
                value={form.pain_flags}
                onChange={(e) => set("pain_flags", e.target.value)}
              />
            </div>
          </div>
          <RadialGauge value={fgPct} label="Live FG%" />
        </div>

        <div className="stat-row" style={{ marginTop: 14 }}>
          <Tile label="Volume" value={form.shots_taken || "—"} />
          <Tile label="RPE" value={rpe ?? "—"} warn={rpe != null && rpe >= 8} />
          <Tile label="HR" value={form.avg_heart_rate ? `${form.avg_heart_rate} bpm` : "—"} />
          <Tile label="Flags" value={painFlagCount} warn={painFlagCount > 0} />
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
          <button id="btn-save-session" className="btn" onClick={save} disabled={saving}>
            {saving ? "Saving & calling Claude…" : "Save session & get AI rec"}
          </button>
          <button className="btn ghost" onClick={() => setForm(EMPTY)} disabled={saving}>Reset</button>
        </div>
        {err && <div style={{ marginTop: 10, color: "var(--red-soft)", fontSize: 13 }}>{err}</div>}
      </div>

      {/* SECTION 3: AI Recommendation */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <span className="accent" />
        <div className="head">
          <h3>AI Recommendation · Claude Haiku</h3>
          <span className="badge red">Section 3 · Live</span>
        </div>
        {saving ? (
          <div className="thinking"><span className="dot-mini" /> Claude is analyzing this session…</div>
        ) : aiSummary ? (
          <div className="ai-output">{aiSummary}</div>
        ) : (
          <div className="ai-output empty">
            Fill in the live metrics, add coach notes, then hit “Save session & get AI rec”.
            Claude will ground its bullets in this player’s recent health, prior games, and the
            session you just logged. Open the <b>Insights</b> tab for a deeper Sonnet breakdown.
          </div>
        )}
        {savedId && !saving && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            ✓ Saved session #{savedId} · added to history · jump to Insights for the full analysis.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, v, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" value={v} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Tile({ label, value, warn }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ color: warn ? "var(--red-soft)" : "var(--ice)" }}>{value}</div>
    </div>
  );
}

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeFg(made, taken) {
  const m = Number(made), t = Number(taken);
  if (!Number.isFinite(m) || !Number.isFinite(t) || t <= 0) return null;
  return m / t;
}
