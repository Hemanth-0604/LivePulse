import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { saveToken } from "../lib/auth";
import { getRecentEmails, rememberEmail } from "../lib/recentEmails";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const slowTimer = useRef(null);
  const navigate = useNavigate();
  const recentEmails = getRecentEmails();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setSlow(false);
    // The backend's free-tier host sleeps after idle time and can take up to
    // ~50s to wake on the first request — this just sets expectations rather
    // than leaving the button looking frozen.
    slowTimer.current = setTimeout(() => setSlow(true), 3000);
    try {
      const data =
        mode === "login" ? await api.login(email, password) : await api.signup(email, password);
      saveToken(data.token);
      rememberEmail(email);
      navigate("/create");
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(slowTimer.current);
      setBusy(false);
      setSlow(false);
    }
  };

  return (
    <div className="lp-root">
      <div className="lp-card">
        <p className="lp-badge">LIVEPULSE</p>
        <h1 className="lp-q" style={{ marginTop: 14 }}>
          {mode === "login" ? "Log in" : "Create an account"}
        </h1>
        <p className="lp-sub">
          {mode === "login" ? "Log in to host a poll." : "Sign up to start hosting polls."}
        </p>
        {error && <p className="lp-err">{error}</p>}
        {slow && !error && (
          <p className="lp-sub" style={{ color: "var(--warn)", marginTop: -10, marginBottom: 14 }}>
            Waking up the server — this can take up to 50s on the free tier.
          </p>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            className="lp-input"
            style={{ textTransform: "none" }}
            type="email"
            list="lp-recent-emails"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {recentEmails.length > 0 && (
            <datalist id="lp-recent-emails">
              {recentEmails.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          )}

          <div style={{ position: "relative" }}>
            <input
              className="lp-input"
              style={{ textTransform: "none", paddingRight: 60, width: "100%" }}
              type={showPassword ? "text" : "password"}
              placeholder="password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              data-lpignore="true"
              data-1p-ignore="true"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "var(--mute)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
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