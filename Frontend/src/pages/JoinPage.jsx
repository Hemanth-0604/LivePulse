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
    <div className="lp-page">
      <div className="lp-hero">
        <span className="lp-float lp-float-left" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" />
            <rect x="10" y="7" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor" />
          </svg>
        </span>
        <span className="lp-float lp-float-right" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="8" r="3" fill="currentColor" />
            <circle cx="17" cy="9" r="2.4" fill="currentColor" />
            <path
              d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 15.3c2.6.2 4.5 2.3 4.5 4.7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <span className="lp-badge">LIVEPULSE</span>
        <h1 className="lp-hero-q">
          Join a <span className="lp-accent-text">poll</span>
        </h1>
        <p className="lp-sub">Enter the code your host shared with you.</p>

        <form className="lp-form" onSubmit={join}>
          <div className="lp-input-wrap">
            <span className="lp-input-icon">#</span>
            <input
              className="lp-input lp-input-has-icon"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. k3n9p"
              autoFocus
            />
          </div>
          <button className="lp-btn" type="submit" disabled={!code.trim()}>
            Join <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="lp-sub" style={{ marginTop: 22 }}>
          Hosting? <Link to="/login" style={{ color: "var(--run)" }}>Log in to start a poll →</Link>
        </p>

        <div className="lp-features">
          <div className="lp-feature">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
            </svg>
            Real-time voting
          </div>
          <div className="lp-feature">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Secure &amp; private
          </div>
          <div className="lp-feature">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 15.3c2.6.2 4.5 2.3 4.5 4.7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Engage your audience
          </div>
        </div>
      </div>

      <div className="lp-wave" aria-hidden="true">
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,100 C240,180 480,20 720,80 C960,140 1200,40 1440,100 L1440,200 L0,200 Z"
            fill="var(--wave)"
          />
        </svg>
      </div>
    </div>
  );
}