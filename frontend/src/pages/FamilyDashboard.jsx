import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import EcgWaveform from "../components/EcgWaveform";
import { API_BASE_URL } from "../config";
import { celsiusToFahrenheit } from "../utils/temperature";
import "./FamilyDashboard.css";

function FamilyDashboard() {

  const navigate = useNavigate();

  const [patientId, setPatientId] = useState("");
  const [vitals, setVitals] = useState(null);
  const [device, setDevice] = useState(null);
  const [history, setHistory] = useState([]);
  useEffect(() => {
    const timer = setInterval(() => setVitals(current =>
      current && Date.now() - Date.parse(current.measuredAt) <= 15000 ? current : null), 1000);
    return () => clearInterval(timer);
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const viewPatient = async () => {

    if (!patientId.trim()) {
      setError("Enter the Patient ID.");
      return;
    }

    try {

      setVitals(null);
      setDevice(null);
      setHistory([]);
      setLoading(true);
      setError("");

      const id = patientId.trim();
      const [response, deviceResponse, historyResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/vitals/${encodeURIComponent(id)}`),
        fetch(`${API_BASE_URL}/api/care/${encodeURIComponent(id)}/device`),
        fetch(`${API_BASE_URL}/api/vitals/${encodeURIComponent(id)}/history`),
      ]);

      const [data, deviceData, historyData] = await Promise.all([
        response.json(), deviceResponse.json(), historyResponse.json(),
      ]);

      if (!response.ok) {
        throw new Error(
          data.message || "Patient not found."
        );
      }

      setVitals(data.vital);
      setDevice(deviceResponse.ok ? deviceData.device : null);
      setHistory(historyResponse.ok ? historyData.vitals.slice(0, 8).reverse() : []);

    } catch (error) {

      setError(
        error.message ||
        "Unable to load patient data."
      );

    } finally {

      setLoading(false);

    }
  };


  const logout = () => {

    localStorage.clear();

    navigate("/login");

  };


  return (

    <div className="family-dashboard">

      <header className="family-header">

        <div className="family-brand">

          <div className="family-logo">
            K
          </div>

          <div>
            <strong>Patient K</strong>
            <span>Family Care</span>
          </div>

        </div>


        <div className="family-user">

          <span>
            Family Member
          </span>

          <button onClick={logout}>
            Logout
          </button>

        </div>

      </header>


      <main className="family-main">

        <section className="family-welcome">

          <p>
            FAMILY MONITORING
          </p>

          <h1>
            Stay connected with your loved one's recovery.
          </h1>

          <span>
            Enter the Patient ID provided by
            your loved one to view their latest
            health information.
          </span>

        </section>


        <section className="family-search">

          <input
            placeholder="PAT-2026-0001"
            value={patientId}
            onChange={(e) => {
              setPatientId(e.target.value);
              setError("");
            }}
          />

          <button
            onClick={viewPatient}
            disabled={loading}
          >
            {loading
              ? "Loading..."
              : "View Health Status"}
          </button>

        </section>


        {error && (
          <div className="family-error">
            {error}
          </div>
        )}


        {vitals && (

          <section className="family-patient">

            <div className="family-patient-title">

              <div>

                <p>
                  PATIENT
                </p>

                <h2>
                  {patientId}
                </h2>

              </div>

              <span>
                Not assessed
              </span>

            </div>


            <div className="family-vitals">


              <div className="family-vital">

                <span>
                  Heart Rate
                </span>

                <strong>
                  {vitals.heartRate ?? "—"}
                  <small> BPM</small>
                </strong>

              </div>


              <div className="family-vital">

                <span>
                  Blood Oxygen
                </span>

                <strong>
                  {vitals.spo2 ?? "—"}
                  <small> %</small>
                </strong>

              </div>


              <div className="family-vital">

                <span>
                  Blood Pressure
                </span>

                <strong>
                  {vitals.systolic ?? "—"}/
                  {vitals.diastolic ?? "—"}
                  <small> mmHg</small>
                </strong>

              </div>


              <div className="family-vital">

                <span>
                  Temperature
                </span>

                <strong>
                  {celsiusToFahrenheit(vitals.temperature) ?? "—"}
                  <small> °F</small>
                </strong>

              </div>

            </div>

            <EcgWaveform patientId={patientId} compact />


            <div className="family-notice">

              <strong>
                Latest update
              </strong>

              <span>
                {new Date(
                  vitals.createdAt
                ).toLocaleString()}
              </span>

            </div>

            <div className="family-device-status">
              <div>
                <strong>Monitoring device</strong>
                <span>{device ? `${device.name} · ${device.deviceId}` : "No device assigned"}</span>
              </div>
              <b className={device?.online ? "family-online" : "family-offline"}>
                {device?.online ? "● Sending data" : "● Device offline"}
              </b>
            </div>

            {(vitals.leadsOff || !device?.online) && (
              <div className="family-alert">
                {vitals.leadsOff ? "ECG electrodes are disconnected." : "The monitoring device has not sent recent data."}
              </div>
            )}

            <div className="family-trend">
              <strong>Recent heart-rate readings</strong>
              <div>
                {history.length ? history.map((reading) => (
                  <span key={reading._id}>{reading.heartRate ?? "—"}</span>
                )) : "No stored history yet."}
              </div>
            </div>


            <div className="family-readonly">

              🔒 Family view is read-only.
              Clinical controls and medical
              decisions remain with the care team.

            </div>

          </section>

        )}


        {!vitals && !loading && !error && (

          <div className="family-empty">

            <div>
              ♡
            </div>

            <h2>
              No patient selected
            </h2>

            <p>
              Enter a Patient ID above to
              view the latest health status.
            </p>

          </div>

        )}

      </main>

    </div>
  );
}

export default FamilyDashboard;
