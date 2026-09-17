import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { saveToken } from "../lib/auth";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data =
        mode === "login" ? await api.login(email, password) : await api.signup(email, password);
      saveToken(data.token);
      navigate("/create");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lp-root">
      <div className="lp-card">
        <p className="lp-brand">LIVEPULSE</p>
        <h1 className="lp-q">{mode === "login" ? "Log in" : "Create an account"}</h1>
        <p className="lp-sub">
          {mode === "login" ? "Log in to host a poll." : "Sign up to start hosting polls."}
        </p>
        {error && <p className="lp-err">{error}</p>}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="lp-input"
            style={{ textTransform: "none" }}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="lp-input"
            style={{ textTransform: "none" }}
            type="password"
            placeholder="password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button className="lp-btn" type="submit" disabled={busy} style={{ padding: "13px 0" }}>
            {busy ? "…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <p className="lp-sub" style={{ marginTop: 18 }}>
          {mode === "login" ? (
            <>
              No account yet?{" "}
              <button type="button" className="lp-linklike" onClick={() => setMode("signup")}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have one?{" "}
              <button type="button" className="lp-linklike" onClick={() => setMode("login")}>
                Log in
              </button>
            </>
          )}
        </p>
        <p className="lp-sub">
          <Link to="/" style={{ color: "var(--run)" }}>← Back to join a poll</Link>
        </p>
      </div>
    </div>
  );
}