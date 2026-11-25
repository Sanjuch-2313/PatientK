import { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "../config";
import "./PatientKBot.css";

// ── Inline SVG sparkline ──────────────────────────────────────────────────────
function Sparkline({ values = [], color = "#ef6c54", title, unit }) {
  if (!values.length) return null;
  const W = 280, H = 60, PAD = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <div className="pkbot-chart">
      {title && <span className="pkbot-chart-title">{title}{unit ? ` (${unit})` : ""}</span>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {values.map((v, i) => {
          const x = PAD + (i / Math.max(values.length - 1, 1)) * (W - PAD * 2);
          const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
          return (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5"
              fill={color} opacity="0.7" />
          );
        })}
      </svg>
      <div className="pkbot-chart-range">
        <span>Min: {min}{unit}</span>
        <span>Max: {max}{unit}</span>
      </div>
    </div>
  );
}

// ── Comparison bar chart ──────────────────────────────────────────────────────
function ComparisonBars({ bars = [], title }) {
  if (!bars.length) return null;
  const allVals = bars.flatMap(b => [b.today, b.yesterday]).filter(Boolean);
  const max = Math.max(...allVals, 1);
  return (
    <div className="pkbot-chart">
      {title && <span className="pkbot-chart-title">{title}</span>}
      <div className="pkbot-bars">
        {bars.map((b, i) => (
          <div key={i} className="pkbot-bar-row">
            <span className="pkbot-bar-label">{b.label}</span>
            <div className="pkbot-bar-tracks">
              <div className="pkbot-bar-track">
                <div className="pkbot-bar today" style={{ width: `${(b.today / max) * 100}%` }} />
                <span>{b.today}</span>
              </div>
              <div className="pkbot-bar-track">
                <div className="pkbot-bar yesterday" style={{ width: `${(b.yesterday / max) * 100}%` }} />
                <span>{b.yesterday}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="pkbot-bar-legend">
        <span className="dot today" /> Today &nbsp;
        <span className="dot yesterday" /> Yesterday
      </div>
    </div>
  );
}

// ── Chart renderer ────────────────────────────────────────────────────────────
function ChartBlock({ chart }) {
  if (!chart) return null;
  if (chart.type === "sparkline")
    return <Sparkline values={chart.values} color={chart.color} title={chart.title} unit={chart.unit} />;
  if (chart.type === "comparison")
    return <ComparisonBars bars={chart.bars} title={chart.title} />;
  return null;
}

// ── Suggested questions ───────────────────────────────────────────────────────
const SUGGESTED = [
  { icon: "❤️", text: "Explain my heart rate" },
  { icon: "🩺", text: "How was my health today?" },
  { icon: "📊", text: "Compare today with yesterday" },
  { icon: "🔔", text: "Why did I get an alert?" },
  { icon: "🫀", text: "What does SpO2 mean?" },
  { icon: "⚠️", text: "What should I do if a reading looks unusual?" },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientKBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  function getPatientId() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      return user.patientId || user._id || null;
    } catch {
      return null;
    }
  }

  async function sendMessage(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", text: trimmed, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const patientId = getPatientId();
      const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, patientId }),
      });
      const data = await res.json();

      const botMsg = {
        role: "bot",
        text: data.reply || "Sorry, I couldn't understand that.",
        chart: data.chart || null,
        seekHelp: data.seekHelp || false,
        disclaimer: data.disclaimer || null,
        id: Date.now() + 1,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: "bot",
          text: "I'm having trouble connecting right now. Please check your internet connection.",
          id: Date.now() + 2,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const showWelcome = messages.length === 0;

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        className={`pkbot-fab${open ? " pkbot-fab--active" : ""}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Open patienkbot.ai"
        title="patienkbot.ai"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.0 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91A16 16 0 0016 17.91l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
        )}
        {!open && <span className="pkbot-fab-label">patienkbot.ai</span>}
      </button>

      {/* ── Chat Panel ── */}
      <div className={`pkbot-panel${open ? " pkbot-panel--open" : ""}`} role="dialog" aria-label="patienkbot.ai chat">

        {/* Header */}
        <div className="pkbot-header">
          <div className="pkbot-header-left">
            <div className="pkbot-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </div>
            <div>
              <div className="pkbot-header-title">patienkbot<span>.ai</span></div>
              <div className="pkbot-header-sub">Personal health assistant</div>
            </div>
          </div>
          <button className="pkbot-close" onClick={() => setOpen(false)} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="pkbot-messages">
          {showWelcome ? (
            <div className="pkbot-welcome">
              <div className="pkbot-welcome-wave">👋</div>
              <h2>Hi, I'm patienkbot.ai</h2>
              <p>How can I help you today?<br />
                <small>Here to help with your health readings, sensor data, and health questions.</small>
              </p>
              <div className="pkbot-suggestions">
                {SUGGESTED.map((s, i) => (
                  <button key={i} className="pkbot-chip" onClick={() => sendMessage(s.text)}>
                    <span>{s.icon}</span> {s.text}
                  </button>
                ))}
              </div>
              <p className="pkbot-disclaimer-global">
                AI can make mistakes. Please double check responses.<br />
                <em>patienkbot.ai never diagnoses medical conditions.</em>
              </p>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <div key={msg.id} className={`pkbot-msg pkbot-msg--${msg.role}`}>
                  {msg.role === "bot" && (
                    <div className="pkbot-bot-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                      </svg>
                    </div>
                  )}
                  <div className="pkbot-bubble">
                    <p>{msg.text}</p>
                    {msg.chart && <ChartBlock chart={msg.chart} />}
                    {msg.seekHelp && (
                      <div className="pkbot-seek-help">
                        ⚠️ <strong>When to seek help:</strong> If your readings are consistently abnormal or you feel unwell, contact your doctor or visit the nearest clinic.
                      </div>
                    )}
                    {msg.disclaimer && (
                      <p className="pkbot-disclaimer">{msg.disclaimer}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="pkbot-msg pkbot-msg--bot">
                  <div className="pkbot-bot-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                    </svg>
                  </div>
                  <div className="pkbot-bubble pkbot-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />

              {/* Quick follow-ups after first reply */}
              {!loading && messages.length > 1 && (
                <div className="pkbot-followups">
                  {SUGGESTED.slice(0, 3).map((s, i) => (
                    <button key={i} className="pkbot-chip pkbot-chip--small" onClick={() => sendMessage(s.text)}>
                      {s.text}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Input */}
        <div className="pkbot-input-row">
          <input
            ref={inputRef}
            className="pkbot-input"
            type="text"
            placeholder="Type here..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            autoComplete="off"
          />
          <button
            className="pkbot-send"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Overlay (mobile) */}
      {open && <div className="pkbot-overlay" onClick={() => setOpen(false)} />}
    </>
  );
}
