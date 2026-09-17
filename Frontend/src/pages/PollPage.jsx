import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { connectPollSocket } from "../lib/socket";
import { getVoterName, saveVoterName } from "../lib/voter";

export default function PollPage() {
  const { code: pollCode } = useParams();

  const [poll, setPoll] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [counts, setCounts] = useState({});
  const [feed, setFeed] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [voteError, setVoteError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting"); // connecting | open | closed
  const [name, setName] = useState(() => getVoterName());
  const seq = useRef(0);
  const wsRef = useRef(null);

  // 1. Load the poll once on mount (and whenever the URL's code changes).
  useEffect(() => {
    let cancelled = false;
    setPoll(null);
    setLoadError(null);
    api
      .getPoll(pollCode)
      .then((data) => {
        if (cancelled) return;
        setPoll(data);
        const initial = Object.fromEntries(data.options.map((o) => [o.id, o.votes]));
        setCounts(initial);
        const remaining = Math.max(
          0,
          Math.round((new Date(data.closesAt).getTime() - Date.now()) / 1000)
        );
        setSecondsLeft(remaining);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [pollCode]);

  // 2. Open the WebSocket once we know the poll exists.
  useEffect(() => {
    if (!poll) return;
    const ws = connectPollSocket(pollCode, (msg) => {
      if (msg.type !== "tally") return;
      setCounts(msg.counts);
      if (msg.last) {
        seq.current += 1;
        setFeed((f) => [{ k: seq.current, ...msg.last }, ...f].slice(0, 5));
      }
    });
    ws.onopen = () => setWsStatus("open");
    ws.onclose = () => setWsStatus("closed");
    ws.onerror = () => setWsStatus("closed");
    wsRef.current = ws;
    return () => ws.close();
  }, [poll, pollCode]);

  // 3. Local countdown display (server owns the real expiry check).
  useEffect(() => {
    if (!poll || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [poll, secondsLeft]);

  const total = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts]
  );
  const leaderId = useMemo(() => {
    if (!poll || total === 0) return null;
    let best = null;
    for (const o of poll.options) {
      if (best === null || (counts[o.id] ?? 0) > (counts[best] ?? 0)) best = o.id;
    }
    return best;
  }, [poll, counts, total]);

  const status = secondsLeft > 0 ? "live" : "closed";

  const castVote = async (optionId) => {
    if (myVote || status !== "live") return;
    setVoteError(null);
    try {
      await api.vote(pollCode, optionId, name || "Anonymous");
      setMyVote(optionId);
    } catch (err) {
      if (err.status === 409) {
        setMyVote("already-voted");
        setVoteError("You've already voted on this poll.");
      } else {
        setVoteError(err.message);
      }
    }
  };

  const share = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const labelFor = (id) => poll?.options.find((o) => o.id === id)?.text ?? "";
  const pct = (id) => (total === 0 ? 0 : ((counts[id] ?? 0) / total) * 100);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const urgent = status === "live" && secondsLeft <= 10;

  if (loadError) {
    return (
      <div className="lp-root">
        <div className="lp-card">
          <p className="lp-err">Couldn't load poll "{pollCode}": {loadError}</p>
          <p className="lp-sub">
            Double check the code, or <Link to="/" style={{ color: "var(--run)" }}>join a different poll</Link>.
          </p>
        </div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="lp-root">
        <div className="lp-card">
          <p className="lp-sub">Loading poll…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-root">
      <div className={`lp-card ${status === "closed" ? "lp-closed" : ""}`}>
        <div className={`lp-timerail ${urgent ? "warn" : ""}`}>
          <i style={{ width: `${(secondsLeft / poll.durationSec) * 100}%` }} />
        </div>

        <div className="lp-head">
          <span className="lp-dot" />
          <span className="lp-state">{status === "live" ? "Voting open" : "Voting closed"}</span>
          <span className={`lp-ws ${wsStatus}`}>
            {wsStatus === "open" ? "● live" : wsStatus === "connecting" ? "connecting…" : "disconnected"}
          </span>
          <span className={`lp-clock ${urgent ? "warn" : ""}`}>{mm}:{ss}</span>
        </div>

        <h1 className="lp-q">{poll.question}</h1>
        <p className="lp-sub">
          {status === "live"
            ? myVote
              ? "Your vote is in. Results keep updating until the timer runs out."
              : "Pick one. You can only vote once."
            : "Final results."}
        </p>
        {voteError && <p className="lp-err">{voteError}</p>}

        {status === "live" && !myVote && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              className="lp-input"
              style={{ textTransform: "none" }}
              placeholder="Your name (shown next to your vote)"
              value={name}
              maxLength={24}
              onChange={(e) => {
                setName(e.target.value);
                saveVoterName(e.target.value);
              }}
            />
          </div>
        )}

        {poll.options.map((o) => {
          const isLead = leaderId === o.id;
          return (
            <button
              key={o.id}
              className={`lp-opt ${isLead ? "lead" : ""} ${myVote === o.id ? "mine" : ""}`}
              onClick={() => castVote(o.id)}
              disabled={!!myVote || status !== "live"}
              aria-pressed={myVote === o.id}
            >
              <span className="fill" style={{ width: `${pct(o.id)}%` }} />
              <span className="lp-row">
                <span className="lp-label">
                  {o.text}
                  {myVote === o.id && <span className="lp-you">your vote</span>}
                </span>
                <span className="lp-nums">
                  <span className="lp-pct">{pct(o.id).toFixed(0)}%</span>
                  <span className="lp-cnt">{counts[o.id] ?? 0}</span>
                </span>
              </span>
            </button>
          );
        })}

        {status === "closed" && leaderId && (
          <div className="lp-result">
            <p>Winner with {counts[leaderId] ?? 0} of {total} votes</p>
            <h3>{labelFor(leaderId)}</h3>
          </div>
        )}

        <div className="lp-foot">
          <span className="lp-total"><b>{total}</b> votes</span>
          <button className="lp-share" onClick={share}>
            {copied ? "Link copied" : "Copy share link"}
          </button>
        </div>

        <div className="lp-ticker">
          {feed.length === 0 ? (
            <p className="lp-empty">Waiting for the first vote.</p>
          ) : (
            feed.map((f) => (
              <div className="lp-tick" key={f.k}>
                <b>{f.voter}</b> voted <span>{labelFor(f.optionId)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}