import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EcgWaveform from "../components/EcgWaveform";
import { API_BASE_URL } from "../config";
import { celsiusToFahrenheit } from "../utils/temperature";
import { useCriticalAlarm } from "../hooks/useCriticalAlarm";
import CriticalAlarmBanner from "../components/CriticalAlarmBanner";
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
  const [reports, setReports] = useState([]);
  const [reportForm, setReportForm] = useState({ symptoms: "", history: "", assessment: "" });

  // ── Critical alarm (browser beep + notification) ──────────
  const { isCritical, criticalReasons, permissionState } = useCriticalAlarm(vital);
  function handleAllowAlarm() {
    Notification.requestPermission();
    try { new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  const [doctors, setDoctors] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("user"));
      if (!saved || saved.role !== role) return navigate("/login", { replace: true });
      setUser(saved);
    } catch { navigate("/login", { replace: true }); }
  }, [navigate, role]);

  useEffect(() => {
    if (role !== "doctor") return undefined;
    fetch(`${api}/api/care/doctors`)
      .then((response) => response.json())
      .then((data) => setDoctors(Array.isArray(data.doctors) ? data.doctors : []))
      .catch(() => setDoctors([]));
    return undefined;
  }, [role]);

  const loadPatient = async (id = patientId) => {
    const normalized = id.trim();
    if (!normalized) return setMessage("Enter or scan a Patient ID.");
    setLoading(true);
    setMessage("");
    try {
      const [latest, trend, status, careNotes, careReports, treatment] = await Promise.all([
        fetch(`${api}/api/vitals/${encodeURIComponent(normalized)}`),
        fetch(`${api}/api/vitals/${encodeURIComponent(normalized)}/history`),
        fetch(`${api}/api/care/${encodeURIComponent(normalized)}/device`),
        fetch(`${api}/api/care/${encodeURIComponent(normalized)}/notes`),
        fetch(`${api}/api/care/${encodeURIComponent(normalized)}/reports`),
        fetch(`${api}/api/care/${encodeURIComponent(normalized)}/treatment`),
      ]);
      const latestData = await latest.json();
      const trendData = await trend.json();
      const statusData = await status.json();
      const noteData = await careNotes.json();
      const reportData = await careReports.json();
      const treatmentData = await treatment.json();
      setPatientId(normalized);
      setVital(latest.ok ? latestData.vital : null);
      setHistory(trend.ok ? trendData.vitals : []);
      setDevice(status.ok ? statusData.device : null);
      setNotes(careNotes.ok ? noteData.notes : []);
      setReports(careReports.ok ? reportData.reports : []);
      setAssignments(treatment.ok ? treatmentData.assignments : []);
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

  const saveReport = async (event) => {
    event.preventDefault();
    if (!patientId || !user || (!reportForm.symptoms.trim() && !reportForm.history.trim() && !reportForm.assessment.trim())) {
      setMessage("Enter symptoms, history, or assessment before saving.");
      return;
    }
    setReportSaving(true);
    try {
      const response = await fetch(`${api}/api/care/${encodeURIComponent(patientId)}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reportForm, authorId: user.id || user._id, authorName: user.name, authorRole: role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save report.");
      setReports((current) => [data.report, ...current]);
      setReportForm({ symptoms: "", history: "", assessment: "" });
      setMessage("Patient report saved.");
    } catch (error) { setMessage(error.message); }
    finally { setReportSaving(false); }
  };

  const assignTreatment = async () => {
    if (!patientId || !user || role !== "doctor") return;
    try {
      const response = await fetch(`${api}/api/care/${encodeURIComponent(patientId)}/treatment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: user.id || user._id, doctorName: user.name, department: "General care" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to add patient to treatment.");
      setAssignments((current) => [data.assignment, ...current.filter((item) => item.doctorId !== data.assignment.doctorId)]);
      setMessage("Patient added to your treatment list.");
    } catch (error) { setMessage(error.message); }
  };

  const referPatient = async (event) => {
    const doctorId = event.target.value;
    if (!doctorId || !patientId || !user) return;
    const doctor = doctors.find((item) => String(item._id) === String(doctorId));
    if (!doctor) return;
    try {
      const response = await fetch(`${api}/api/care/${encodeURIComponent(patientId)}/referrals`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, doctorName: doctor.name, department: "Specialist review", referredById: user.id || user._id, referredByName: user.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to refer patient.");
      setAssignments((current) => [data.assignment, ...current.filter((item) => item.doctorId !== data.assignment.doctorId)]);
      event.target.value = "";
      setMessage(`Patient referred to Dr. ${doctor.name}.`);
    } catch (error) { setMessage(error.message); }
  };

  const openCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported by this browser.");
      setCameraOpen(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError("Camera permission was denied or no camera is available.");
      setCameraOpen(true);
    }
  };

  const closeCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  };

  useEffect(() => () => closeCamera(), []);

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
      <CriticalAlarmBanner
        isCritical={isCritical}
        criticalReasons={criticalReasons}
        permissionState={permissionState}
        onAllow={handleAllowAlarm}
      />
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
          <button className="care-camera-button" type="button" onClick={openCamera}>Open camera</button>
        </section>

        <section className="care-report-layout">
          <article className="care-panel care-report-editor">
            <div className="care-panel-heading">
              <div><span className="care-section-kicker">PATIENT RECORD</span><h2>Symptoms & history</h2></div>
              <span className="care-record-badge">Private care record</span>
            </div>
            <form onSubmit={saveReport}>
              <label>Current symptoms<textarea value={reportForm.symptoms} onChange={(event) => setReportForm((current) => ({ ...current, symptoms: event.target.value }))} placeholder="Describe the patient's current symptoms..." maxLength="3000" /></label>
              <label>Medical history<textarea value={reportForm.history} onChange={(event) => setReportForm((current) => ({ ...current, history: event.target.value }))} placeholder="Previous conditions, surgery, medication, allergies..." maxLength="5000" /></label>
              <label>Clinical assessment<textarea value={reportForm.assessment} onChange={(event) => setReportForm((current) => ({ ...current, assessment: event.target.value }))} placeholder="Add your assessment or follow-up plan..." maxLength="3000" /></label>
              <button type="submit" disabled={reportSaving}>{reportSaving ? "Saving..." : "Save patient report"}</button>
            </form>
          </article>

          <article className="care-panel care-record-history">
            <div className="care-panel-heading"><div><span className="care-section-kicker">HISTORY</span><h2>Saved reports</h2></div><strong>{reports.length}</strong></div>
            {reports.length ? reports.slice(0, 4).map((report) => (
              <div className="care-report-item" key={report._id}>
                <div><strong>{report.authorName}</strong><small>{new Date(report.createdAt).toLocaleString()}</small></div>
                {report.symptoms && <p><b>Symptoms:</b> {report.symptoms}</p>}
                {report.history && <p><b>History:</b> {report.history}</p>}
                {report.assessment && <p><b>Assessment:</b> {report.assessment}</p>}
              </div>
            )) : <p className="care-empty-record">No reports yet. Add the first patient history above.</p>}
          </article>
        </section>

        {role === "doctor" && <section className="care-panel care-referral-panel">
          <div className="care-panel-heading"><div><span className="care-section-kicker">CARE TEAM</span><h2>Manage treatment</h2></div></div>
          <div className="care-care-actions">
            <button type="button" onClick={assignTreatment}>Add patient to my treatment</button>
            <label>Refer to another doctor<select defaultValue="" onChange={referPatient}><option value="" disabled>Select a registered doctor</option>{doctors.filter((doctor) => String(doctor._id) !== String(user?.id || user?._id)).map((doctor) => <option key={doctor._id} value={doctor._id}>Dr. {doctor.name} · {doctor.email}</option>)}</select></label>
          </div>
          {assignments.length > 0 && <div className="care-assignment-list">{assignments.map((assignment) => <span key={`${assignment.doctorId}-${assignment.status}`} className={assignment.status === "referred" ? "referred" : "assigned"}>{assignment.status === "referred" ? `Referred to Dr. ${assignment.doctorName}` : `Under Dr. ${assignment.doctorName}'s treatment`}</span>)}</div>}
        </section>}

        <section className="care-vitals">
          {[["Heart rate", vital?.heartRate ?? empty.heartRate, "BPM"], ["Blood oxygen", vital?.spo2 ?? empty.spo2, "%"], ["Contact temperature", celsiusToFahrenheit(vital?.temperature ?? empty.temperature), "°F"], ["Blood pressure", null, "Unavailable"]].map(([label, value, unit]) => <article key={label}><span>{label}</span><strong>{value ?? "—"}</strong><small>{unit}</small></article>)}
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

      {cameraOpen && <div className="care-camera-modal" role="dialog" aria-modal="true" aria-label="Patient camera">
        <div className="care-camera-card">
          <button className="care-camera-close" type="button" onClick={closeCamera}>×</button>
          <span className="care-section-kicker">REMOTE VISUAL CHECK</span>
          <h2>Patient camera</h2>
          {cameraError ? <p className="care-camera-error">{cameraError}</p> : <video ref={videoRef} className="care-camera-video" autoPlay playsInline muted />}
          <p className="care-camera-note">Testing mode: this uses the clinician's phone or laptop camera. A connected clinical camera can replace this stream later.</p>
          <button className="care-camera-stop" type="button" onClick={closeCamera}>Close camera</button>
        </div>
      </div>}
    </div>
  );
}

export default CareWorkspace;
