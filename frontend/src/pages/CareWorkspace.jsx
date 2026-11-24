import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EcgWaveform from "../components/EcgWaveform";
import { API_BASE_URL } from "../config";
import "./CareWorkspace.css";

const api = API_BASE_URL;
const empty = { heartRate: null, spo2: null, temperature: null };

function CareWorkspace({ role }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [patientId, setPatientId] = useState("");
  const [vital, setVital] = useState(null);
  const [history, setHistory] = useState([]);
  const [device, setDevice] = useState(null);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("user"));
      if (!saved || saved.role !== role) return navigate("/login", { replace: true });
      setUser(saved);
    } catch { navigate("/login", { replace: true }); }
  }, [navigate, role]);

  const loadPatient = async (id = patientId) => {
    const normalized = id.trim();
    if (!normalized) return setMessage("Enter or scan a Patient ID.");
    setLoading(true);
    setMessage("");
    try {
      const [latest, trend, status, careNotes] = await Promise.all([
        fetch(`${api}/api/vitals/${encodeURIComponent(normalized)}`),
        fetch(`${api}/api/vitals/${encodeURIComponent(normalized)}/history`),
        fetch(`${api}/api/care/${encodeURIComponent(normalized)}/device`),
        fetch(`${api}/api/care/${encodeURIComponent(normalized)}/notes`),
      ]);
      const latestData = await latest.json();
      const trendData = await trend.json();
      const statusData = await status.json();
      const noteData = await careNotes.json();
      setPatientId(normalized);
      setVital(latest.ok ? latestData.vital : null);
      setHistory(trend.ok ? trendData.vitals : []);
      setDevice(status.ok ? statusData.device : null);
      setNotes(careNotes.ok ? noteData.notes : []);
      if (!latest.ok) setMessage("No recent sensor reading. Review device status below.");
    } catch {
      setMessage("Unable to reach the Patient K backend.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!patientId) return undefined;
    const timer = setInterval(() => loadPatient(patientId), 5000);
    return () => clearInterval(timer);
  }, [patientId]);

  const saveNote = async (event) => {
    event.preventDefault();
    if (!note.trim() || !patientId || !user) return;
    try {
      const response = await fetch(`${api}/api/care/${encodeURIComponent(patientId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: user.name, authorRole: role, text: note.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setNotes((current) => [data.note, ...current]);
      setNote("");
    } catch (error) { setMessage(error.message || "Unable to save note."); }
  };

  const alerts = [];
  if (!device) alerts.push("No monitoring device is assigned to this patient.");
  else if (!device.online) alerts.push("Monitoring device is offline or has not sent data in the last 15 seconds.");
  if (vital?.leadsOff) alerts.push("ECG electrodes are disconnected.");

  const points = history.slice(0, 12).reverse();
  const values = points.map((item) => item.heartRate).filter((item) => typeof item === "number");
  const max = Math.max(...values, 1);

  return (
    <div className="care-workspace">
      <header className="care-header">
        <div><p>{role.toUpperCase()} PORTAL</p><h1>Patient monitoring</h1></div>
        <button onClick={() => { localStorage.clear(); navigate("/login"); }}>Log out</button>
      </header>

      <section className="care-search">
        <label htmlFor="care-patient-id">Patient ID or QR result</label>
        <div>
          <input id="care-patient-id" value={patientId} placeholder="PAT-2026-0001" onChange={(event) => setPatientId(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadPatient()} />
          <button onClick={() => loadPatient()} disabled={loading}>{loading ? "Loading…" : "Open monitoring"}</button>
        </div>
        <small>Scan the patient QR with a phone camera, log in, and this same monitoring view opens automatically.</small>
      </section>

      {message && <p className="care-message">{message}</p>}
      {patientId && <>
        <section className="care-summary">
          <div><span>PATIENT</span><strong>{patientId}</strong></div>
          <div><span>DEVICE</span><strong>{device ? device.deviceId : "Not assigned"}</strong></div>
          <div><span>STATUS</span><strong className={device?.online ? "care-online" : "care-offline"}>{device?.online ? "● Sending data" : "● Needs attention"}</strong></div>
        </section>

        <section className="care-vitals">
          {[["Heart rate", vital?.heartRate ?? empty.heartRate, "BPM"], ["Blood oxygen", vital?.spo2 ?? empty.spo2, "%"], ["Contact temperature", vital?.temperature ?? empty.temperature, "°C"], ["Blood pressure", null, "Unavailable"]].map(([label, value, unit]) => <article key={label}><span>{label}</span><strong>{value ?? "—"}</strong><small>{unit}</small></article>)}
        </section>

        <EcgWaveform patientId={patientId} />

        <section className="care-grid">
          <article className="care-panel"><h2>Alerts</h2>{alerts.length ? alerts.map((alert) => <p className="care-alert" key={alert}>● {alert}</p>) : <p className="care-clear">No device or ECG connection alerts.</p>}<small>Sensor readings are measurements only; this screen does not make clinical decisions.</small></article>
          <article className="care-panel"><h2>Heart-rate trend</h2>{points.length ? <div className="care-chart">{points.map((item) => <span key={item._id} title={`${item.heartRate ?? "Unavailable"} BPM`} style={{ height: `${Math.max(5, ((item.heartRate || 0) / max) * 100)}%` }} />)}</div> : <p>No stored sensor history.</p>}<small>Most recent 12 stored readings.</small></article>
        </section>

        <section className="care-panel"><h2>Care notes</h2>{notes.length ? <div className="care-notes">{notes.map((item) => <p key={item._id}><strong>{item.authorName} · {item.authorRole}</strong>{item.text}<small>{new Date(item.createdAt).toLocaleString()}</small></p>)}</div> : <p>No notes yet.</p>}
          <form onSubmit={saveNote}><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength="1000" placeholder="Add a care observation or handover note…" /><button type="submit">Save note</button></form>
        </section>
      </>}
    </div>
  );
}

export default CareWorkspace;
