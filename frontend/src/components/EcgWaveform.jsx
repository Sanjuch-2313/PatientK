import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config";
import "./EcgWaveform.css";

const API_URL = API_BASE_URL;

function EcgWaveform({ patientId, compact = false }) {
  const [traces, setTraces] = useState([]);
  const [message, setMessage] = useState("Loading ECG trace…");

  useEffect(() => {
    if (!patientId) return undefined;
    let cancelled = false;
    const loadTrace = async () => {
      try {
        const response = await fetch(`${API_URL}/api/vitals/${encodeURIComponent(patientId)}/ecg`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!cancelled) {
          setTraces(data.traces);
          setMessage(data.traces.at(-1)?.leadsOff ? "ECG electrodes are disconnected." : "Live ECG signal");
        }
      } catch (error) {
        if (!cancelled) {
          setTraces([]);
          setMessage(error.message || "ECG trace unavailable.");
        }
      }
    };
    loadTrace();
    const timer = setInterval(loadTrace, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [patientId]);

  const samples = useMemo(() => traces.flatMap((trace) => trace.samples).slice(-600), [traces]);
  const points = useMemo(() => {
    if (samples.length < 2) return "";
    const low = Math.min(...samples);
    const high = Math.max(...samples);
    const range = Math.max(high - low, 300);
    const midpoint = (high + low) / 2;
    return samples.map((sample, index) => {
      const x = (index / (samples.length - 1)) * 100;
      const y = 50 - ((sample - midpoint) / range) * 78;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }, [samples]);

  return (
    <section className={`ecg-waveform ${compact ? "ecg-waveform-compact" : ""}`}>
      <div className="ecg-waveform-title"><div><span>LIVE ECG</span><h2>ECG waveform</h2></div><small>{message}</small></div>
      <div className="ecg-screen">
        {points ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Live ECG waveform"><polyline points={points} /></svg> : <p>{message}</p>}
      </div>
      <p className="ecg-waveform-note">Raw 100 Hz signal from AD8232. This display is not an interpretation or diagnosis.</p>
    </section>
  );
}

export default EcgWaveform;
