import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function JoinPage() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const join = (e) => {
    e.preventDefault();
    const trimmed = code.trim().toLowerCase();
    if (trimmed) navigate(`/p/${trimmed}`);
  };

  return (
    <div className="lp-root">
      <div className="lp-card">
        <p className="lp-brand">LIVEPULSE</p>
        <h1 className="lp-q">Join a poll</h1>
        <p className="lp-sub">Enter the code your host shared with you.</p>
        <form className="lp-form" onSubmit={join}>
          <input
            className="lp-input"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. k3n9p"
            autoFocus
          />
          <button className="lp-btn" type="submit" disabled={!code.trim()}>
            Join
          </button>
        </form>
        <p className="lp-sub" style={{ marginTop: 22 }}>
          Hosting? <Link to="/login" style={{ color: "var(--run)" }}>Log in to start a poll →</Link>
        </p>
      </div>
    </div>
  );
}