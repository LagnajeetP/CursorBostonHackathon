import React from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Label,
} from "recharts";

/* Technical chart styling — hairline grid, mono tick labels, axis units,
 * linear interpolation, no gradient fills. Matches the Grafana/Linear look. */

const MONO = "ui-monospace, 'SFMono-Regular', Menlo, monospace";
const COL_TEXT_2 = "#8b949e";
const COL_GRID   = "#1c2128";
const COL_AXIS   = "#2a303a";

const AXIS_TICK = {
  fill: COL_TEXT_2,
  fontSize: 10,
  fontFamily: MONO,
};

const AXIS_PROPS_X = {
  tick: AXIS_TICK,
  tickLine: { stroke: COL_AXIS, strokeWidth: 1 },
  axisLine: { stroke: COL_AXIS, strokeWidth: 1 },
  tickMargin: 6,
  minTickGap: 8,
};

const AXIS_PROPS_Y = {
  tick: AXIS_TICK,
  tickLine: { stroke: COL_AXIS, strokeWidth: 1 },
  axisLine: { stroke: COL_AXIS, strokeWidth: 1 },
  tickMargin: 4,
  width: 38,
};

const TOOLTIP_STYLE = {
  background: "#0f1218",
  border: "1px solid #2a303a",
  borderRadius: 4,
  color: "#e6edf3",
  fontSize: 12,
  fontFamily: MONO,
  padding: "6px 10px",
};

const TOOLTIP_LABEL_STYLE = {
  color: "#8b949e",
  fontSize: 10,
  marginBottom: 2,
  fontFamily: MONO,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

function YAxisUnit({ unit }) {
  if (!unit) return null;
  return (
    <Label
      value={unit}
      angle={-90}
      position="insideLeft"
      offset={10}
      style={{ fill: COL_TEXT_2, fontSize: 9, fontFamily: MONO, letterSpacing: 1, textTransform: "uppercase" }}
    />
  );
}

/** Single-series line. Linear interpolation, hairline grid, axis-labeled. */
export function TrendLine({
  data, xKey, yKey,
  color = "#e6edf3",
  unit = "",
  yLabel = "",
  refY = null,
  yDomain,
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={COL_GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS_PROPS_X} />
        <YAxis {...AXIS_PROPS_Y} domain={yDomain}>
          <YAxisUnit unit={yLabel} />
        </YAxis>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={(v) => [`${v}${unit}`, ""]}
          cursor={{ stroke: COL_AXIS, strokeWidth: 1, strokeDasharray: "2 2" }}
          separator=""
        />
        {refY != null && (
          <ReferenceLine y={refY} stroke="#565d68" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <Line
          type="linear"
          dataKey={yKey}
          stroke={color}
          strokeWidth={1.5}
          dot={{ r: 2, stroke: color, fill: "#0a0c10", strokeWidth: 1 }}
          activeDot={{ r: 3, fill: color, stroke: color }}
          isAnimationActive
          animationDuration={400}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Multi-series line chart with legend; technical look. */
export function MultiLine({ data, xKey, lines, yLabel = "", unit = "", yDomain }) {
  return (
    <>
      <div style={{ height: "calc(100% - 20px)" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke={COL_GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey={xKey} {...AXIS_PROPS_X} />
            <YAxis {...AXIS_PROPS_Y} domain={yDomain}>
              <YAxisUnit unit={yLabel} />
            </YAxis>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={(v, name) => [`${v}${unit}`, name]}
              cursor={{ stroke: COL_AXIS, strokeWidth: 1, strokeDasharray: "2 2" }}
            />
            {lines.map((l) => (
              <Line
                key={l.key}
                type="linear"
                dataKey={l.key}
                name={l.label || l.key}
                stroke={l.color}
                strokeWidth={1.5}
                dot={{ r: 2, stroke: l.color, fill: "#0a0c10", strokeWidth: 1 }}
                activeDot={{ r: 3 }}
                isAnimationActive
                animationDuration={400}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend" style={{ marginTop: 2 }}>
        {lines.map((l) => (
          <span className="item" key={l.key}>
            <span className="swatch" style={{ background: l.color }} />
            <span>{l.label || l.key}</span>
          </span>
        ))}
      </div>
    </>
  );
}

/** Bar chart; flat solid bars, optional dashed reference line. */
export function Bars({ data, xKey, yKey, color = "#e6edf3", referenceY = null, yLabel = "", unit = "" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={COL_GRID} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS_PROPS_X} />
        <YAxis {...AXIS_PROPS_Y}>
          <YAxisUnit unit={yLabel} />
        </YAxis>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={(v) => [`${v}${unit}`, ""]}
          cursor={{ fill: "rgba(255,255,255,0.025)" }}
          separator=""
        />
        {referenceY != null && (
          <ReferenceLine y={referenceY} stroke="#565d68" strokeDasharray="3 3" strokeWidth={1} />
        )}
        <Bar
          dataKey={yKey}
          fill={color}
          isAnimationActive
          animationDuration={400}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Minimal radial gauge — single thin ring, mono value. */
export function RadialGauge({ value, label }) {
  const v = value == null ? null : Math.max(0, Math.min(100, value));
  const r = 50;
  const C = 2 * Math.PI * r;
  const offset = v == null ? C : C - (v / 100) * C;
  return (
    <div className="gauge">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1c2128" strokeWidth="6" />
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke="#e63946"
          strokeWidth="6"
          strokeLinecap="butt"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: "stroke-dashoffset 0.4s linear" }}
        />
      </svg>
      <div className="center">
        <div>
          <div className="v">{v == null ? "—" : `${v.toFixed(0)}%`}</div>
          <div className="l">{label}</div>
        </div>
      </div>
    </div>
  );
}
