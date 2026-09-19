import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getInitialTheme, applyTheme } from "../lib/theme";

export default function Header() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <header className="lp-header">
      <Link to="/" className="lp-logo">
        <span className="lp-logo-mark">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 12h4l2 7 4-14 2 7h8"
              stroke="white"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="lp-logo-word">LivePulse</span>
      </Link>

      <button
        className="lp-theme-switch"
        onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        aria-label="Toggle light/dark theme"
      >
        <span className={`lp-ts-icon ${theme === "light" ? "active" : ""}`}>☀</span>
        <span className={`lp-ts-icon ${theme === "dark" ? "active" : ""}`}>☾</span>
      </button>
    </header>
  );
}