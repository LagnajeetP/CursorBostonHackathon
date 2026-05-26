import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { TrendLine, MultiLine, Bars } from "./charts.jsx";

function avg(arr, key) {
  const xs = arr.map((r) => r[key]).filter((v) => v != null);
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export default function PastInfo({ player }) {
  const [profile, setProfile] = useState(null);
  const [health, setHealth] = useState([]);
  const [perf, setPerf] = useState([]);

  useEffect(() => {
    Promise.all([
      api.profile(player.id),
      api.health(player.id),
      api.performance(player.id),
    ]).then(([pr, h, pf]) => {
      setProfile(pr); setHealth(h); setPerf(pf);
    });
  }, [player.id]);

  const healthChrono = useMemo(() => [...health].reverse(), [health]);
  const perfChrono = useMemo(
    () => [...perf].reverse().map((g, i) => ({ ...g, idx: `G${i + 1}` })),
    [perf]
  );

  if (!profile) {
    return (
      <div className="card">
        <div className="shimmer" style={{ width: "40%" }} />
        <div className="shimmer" />
        <div className="shimmer" style={{ width: "70%" }} />
      </div>
    );
  }

  const ppg = avg(perf, "points");
  const rpg = avg(perf, "rebounds");
  const apg = avg(perf, "assists");
  const fg = avg(perf, "fg_pct");
  const sleep = avg(health, "sleep_hours");
  const sore = avg(health, "soreness_0_10");
  const hrv = avg(health, "hrv_ms");

  return (
    <>
      <div className="grid cols-2">
        <div className="card">
          <span className="accent" />
          <div className="head">
            <h3>Intake & Profile</h3>
            <span className="badge gold">Non-Session</span>
          </div>
          <div className="kv">
            <div className="k">Name</div><div>{profile.full_name}</div>
            <div className="k">Team</div><div>{profile.team}</div>
            <div className="k">Position</div><div>{profile.position}</div>
            <div className="k">Height</div><div>{Math.floor(profile.height_in / 12)}'{profile.height_in % 12}"</div>
            <div className="k">Weight</div><div>{profile.weight_lb} lb</div>
            <div className="k">Age</div><div>{profile.age}</div>
            <div className="k">Hand</div><div>{profile.dominant_hand}</div>
          </div>
          <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>
            Medical / Background
          </div>
          <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>
            {profile.intake_notes}
          </div>
        </div>

        <div className="card">
          <span className="accent" />
          <div className="head">
            <h3>Career Snapshot · last 10</h3>
            <span className="badge">Synthesized</span>
          </div>
          <div className="stat-row">
            <Stat label="PPG" value={ppg?.toFixed(1)} />
            <Stat label="RPG" value={rpg?.toFixed(1)} />
            <Stat label="APG" value={apg?.toFixed(1)} />
            <Stat label="FG%" value={fg ? `${(fg * 100).toFixed(1)}%` : "—"} />
          </div>
          <div className="stat-row" style={{ marginTop: 10 }}>
            <Stat label="Avg Sleep" value={sleep?.toFixed(1) + "h"} />
            <Stat label="Avg HRV" value={hrv?.toFixed(0) + "ms"} />
            <Stat label="Avg Soreness" value={sore?.toFixed(1) + "/10"} />
            <Stat label="Games" value={perf.length} />
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Performance Trends</h2>
        <div className="line" />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="head">
            <h3>Points / Game</h3>
            <span className="badge">n = {perf.length}</span>
          </div>
          <div className="chart-wrap">
            <Bars
              data={perfChrono}
              xKey="idx"
              yKey="points"
              color="#e63946"
              referenceY={ppg}
              yLabel="PTS"
            />
          </div>
          <div className="chart-meta">
            <span>μ = {ppg?.toFixed(1)} pts</span>
            <span>σ ref dashed</span>
          </div>
        </div>

        <div className="card">
          <div className="head">
            <h3>Shooting %  ·  FG / 3P / FT</h3>
            <span className="badge">last 10</span>
          </div>
          <div className="chart-wrap">
            <MultiLine
              data={perfChrono.map((g) => ({
                idx: g.idx,
                FG: +(g.fg_pct * 100).toFixed(1),
                "3P": +(g.three_pct * 100).toFixed(1),
                FT: +(g.ft_pct * 100).toFixed(1),
              }))}
              xKey="idx"
              yLabel="PCT"
              unit="%"
              yDomain={[0, 100]}
              lines={[
                { key: "FG",  color: "#e6edf3" },
                { key: "3P",  color: "#e63946" },
                { key: "FT",  color: "#d29922" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Health · last 14 days</h2>
        <div className="line" />
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="head"><h3>Sleep</h3><span className="badge">14d</span></div>
          <div className="chart-wrap">
            <TrendLine
              data={healthChrono}
              xKey="recorded_on"
              yKey="sleep_hours"
              color="#3fb950"
              yLabel="HRS"
              unit="h"
              yDomain={[4, 10]}
            />
          </div>
        </div>
        <div className="card">
          <div className="head"><h3>HRV</h3><span className="badge">14d</span></div>
          <div className="chart-wrap">
            <TrendLine
              data={healthChrono}
              xKey="recorded_on"
              yKey="hrv_ms"
              color="#58a6ff"
              yLabel="MS"
              unit=" ms"
            />
          </div>
        </div>
        <div className="card">
          <div className="head"><h3>Soreness</h3><span className="badge">0–10</span></div>
          <div className="chart-wrap">
            <TrendLine
              data={healthChrono}
              xKey="recorded_on"
              yKey="soreness_0_10"
              color="#e63946"
              yLabel="0–10"
              yDomain={[0, 10]}
            />
          </div>
        </div>
      </div>

      <div className="section-title">
        <h2>Recent Games</h2>
        <div className="line" />
      </div>
      <div className="card">
        <span className="accent" />
        <table className="table">
          <thead>
            <tr>
              <th>Date</th><th>Opp</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th>
              <th>STL</th><th>BLK</th><th>TO</th><th>FG%</th><th>3P%</th><th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {perf.map((g) => (
              <tr key={g.id}>
                <td>{g.game_date}</td>
                <td>{g.opponent}</td>
                <td>{g.minutes}</td>
                <td>{g.points}</td>
                <td>{g.rebounds}</td>
                <td>{g.assists}</td>
                <td>{g.steals}</td>
                <td>{g.blocks}</td>
                <td>{g.turnovers}</td>
                <td>{(g.fg_pct * 100).toFixed(1)}%</td>
                <td>{(g.three_pct * 100).toFixed(1)}%</td>
                <td style={{ color: g.plus_minus >= 0 ? "var(--ok)" : "var(--bad)" }}>
                  {g.plus_minus > 0 ? "+" : ""}{g.plus_minus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value ?? "—"}</div>
    </div>
  );
}
