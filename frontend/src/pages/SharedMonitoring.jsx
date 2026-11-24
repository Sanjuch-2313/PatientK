import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EcgWaveform from "../components/EcgWaveform";
import { API_BASE_URL } from "../config";
import { celsiusToFahrenheit } from "../utils/temperature";
import "./SharedMonitoring.css";

const emptyVitals = {
  heartRate: null,
  spo2: null,
  temperature: null,
  systolic: null,
  diastolic: null,
};

function SharedMonitoring() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [vitals, setVitals] = useState(emptyVitals);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [status, setStatus] = useState("Checking for sensor data…");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate(`/login?next=${encodeURIComponent(`/monitor/${patientId}`)}`, { replace: true });
    }
  }, [navigate, patientId]);

  useEffect(() => {
    if (!localStorage.getItem("user") || !patientId) return undefined;
    let cancelled = false;
    const loadVitals = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/vitals/${encodeURIComponent(patientId)}`,
        );
        const data = await response.json();
        if (!response.ok || !data.vital) throw new Error("No recent reading");
        if (!cancelled) {
          setVitals(data.vital);
          setUpdatedAt(new Date(data.vital.measuredAt));
          setStatus("Recent sensor data received");
        }
      } catch {
        if (!cancelled) {
          setVitals(emptyVitals);
          setUpdatedAt(null);
          setStatus("Sensor data unavailable or stale");
        }
      }
    };
    loadVitals();
    const timer = setInterval(loadVitals, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [patientId]);

  const cards = [
    ["Heart rate", vitals.heartRate, "BPM"],
    ["Blood oxygen", vitals.spo2, "%"],
    ["Contact temperature", celsiusToFahrenheit(vitals.temperature), "°F"],
    ["Blood pressure", null, "Not available with this hardware"],
  ];

  return (
    <main className="shared-monitoring-page">
      <section className="shared-monitoring-card">
        <p className="shared-monitoring-label">PATIENT K · READ-ONLY MONITORING</p>
        <h1>Patient {patientId}</h1>
        <p className="shared-monitoring-status">● {status}</p>
        <div className="shared-vitals-grid">
          {cards.map(([label, value, unit]) => (
            <article className="shared-vital" key={label}>
              <span>{label}</span>
              <strong>{value ?? "—"}</strong>
              <small>{unit}</small>
            </article>
          ))}
        </div>
        <EcgWaveform patientId={patientId} compact />
        <p className="shared-monitoring-time">
          {updatedAt ? `Last reading: ${updatedAt.toLocaleString()}` : "No recent reading"}
        </p>
        <p className="shared-monitoring-note">
          Measurements are shown as received from the sensor. This page does not provide a clinical assessment.
        </p>
      </section>
    </main>
  );
}

export default SharedMonitoring;
