import React, { useState } from "react";
import { api } from "../api.js";

export default function Login({ onLogin, onDemo }) {
  const [u, setU] = useState("jstar");
  const [p, setP] = useState("demo");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const { player } = await api.login(u, p);
      onLogin(player);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">
          <span className="dot" /> HOOPS<span className="thin">.AI</span>
        </div>
        <h1>Coach Console</h1>
        <p className="sub">Sign in to view player metrics & AI insights.</p>

        <div className="field">
          <label>Username</label>
          <input value={u} onChange={(e) => setU(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} />
        </div>

        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button className="btn ghost" type="button" onClick={onDemo}>
            View demo
          </button>
        </div>

        {err && <div className="err">{err}</div>}
        <div className="hint">
          Demo accounts &nbsp;·&nbsp; <code>jstar / demo</code> &nbsp;·&nbsp; <code>mrise / demo</code>
        </div>
      </form>
    </div>
  );
}
