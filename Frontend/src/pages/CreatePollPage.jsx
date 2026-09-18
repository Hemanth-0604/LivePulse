import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { isLoggedIn, clearToken } from "../lib/auth";

const DURATIONS = [
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
  { label: "30 min", value: 1800 },
  { label: "1 hour", value: 3600 },
];
const CUSTOM = "custom";
const MAX_CUSTOM_MINUTES = 240; // matches backend's 14400s ceiling

export default function CreatePollPage() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState(300);
  const [customMinutes, setCustomMinutes] = useState("");
  const isCustom = duration === CUSTOM;
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (!isLoggedIn()) {
    return (
      <div className="lp-root">
        <div className="lp-card">
          <p className="lp-sub">You need to be logged in to host a poll.</p>
          <p className="lp-sub">
            <Link to="/login" style={{ color: "var(--run)" }}>Log in →</Link>
          </p>
        </div>
      </div>
    );
  }

  const updateOption = (i, val) =>
    setOptions((opts) => opts.map((o, idx) => (idx === i ? val : o)));
  const addOption = () => options.length < 5 && setOptions((o) => [...o, ""]);
  const removeOption = (i) =>
    options.length > 2 && setOptions((o) => o.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("Add at least 2 options.");
      return;
    }

    let durationSec = duration;
    if (isCustom) {
      const mins = Number(customMinutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        setError("Enter a valid custom duration in minutes.");
        return;
      }
      if (mins > MAX_CUSTOM_MINUTES) {
        setError(`Custom duration can't exceed ${MAX_CUSTOM_MINUTES} minutes.`);
        return;
      }
      durationSec = Math.round(mins * 60);
    }

    setBusy(true);
    try {
      const poll = await api.createPoll({
        question: question.trim(),
        options: cleanOptions,
        durationSec,
      });
      navigate(`/p/${poll.code}`);
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        navigate("/login");
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lp-root">
      <div className="lp-card">
        <p className="lp-brand">LIVEPULSE</p>
        <h1 className="lp-q">Host a poll</h1>
        <p className="lp-sub">Ask a question, give people a few seconds to answer.</p>
        {error && <p className="lp-err">{error}</p>}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            className="lp-input"
            style={{ textTransform: "none" }}
            placeholder="Which map do we run next?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
            required
          />

          {options.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input
                className="lp-input"
                style={{ textTransform: "none" }}
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                maxLength={80}
                required
              />
              {options.length > 2 && (
                <button type="button" className="lp-share" onClick={() => removeOption(i)}>
                  Remove
                </button>
              )}
            </div>
          ))}

          {options.length < 5 && (
            <button
              type="button"
              className="lp-share"
              onClick={addOption}
              style={{ alignSelf: "flex-start" }}
            >
              + Add option
            </button>
          )}

          <div>
            <p className="lp-sub" style={{ margin: "6px 0" }}>Duration</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DURATIONS.map((d) => (
                <button
                  type="button"
                  key={d.value}
                  className="lp-share"
                  onClick={() => setDuration(d.value)}
                  style={{
                    borderColor: duration === d.value ? "var(--run)" : "var(--edge)",
                    color: duration === d.value ? "var(--ink)" : "var(--mute)",
                  }}
                >
                  {d.label}
                </button>
              ))}
              <button
                type="button"
                className="lp-share"
                onClick={() => setDuration(CUSTOM)}
                style={{
                  borderColor: isCustom ? "var(--run)" : "var(--edge)",
                  color: isCustom ? "var(--ink)" : "var(--mute)",
                }}
              >
                Custom
              </button>
            </div>

            {isCustom && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <input
                  className="lp-input"
                  style={{ textTransform: "none", maxWidth: 110 }}
                  type="number"
                  min={1}
                  max={MAX_CUSTOM_MINUTES}
                  placeholder="e.g. 15"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                />
                <span className="lp-sub" style={{ margin: 0 }}>minutes (max {MAX_CUSTOM_MINUTES})</span>
              </div>
            )}
          </div>

          <button
            className="lp-btn"
            type="submit"
            disabled={busy}
            style={{ padding: "13px 0", marginTop: 8 }}
          >
            {busy ? "Creating…" : "Start poll"}
          </button>
        </form>
      </div>
    </div>
  );
}