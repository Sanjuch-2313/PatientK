import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import EcgWaveform from "../components/EcgWaveform";
import { API_BASE_URL } from "../config";
import { celsiusToFahrenheit } from "../utils/temperature";
import "./PatientDashboard.css";

function PatientDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const emptyVitals = { heartRate: null, spo2: null, systolic: null, diastolic: null, temperature: null };
  const [vitals, setVitals] = useState(emptyVitals);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sensorStatus, setSensorStatus] = useState("Waiting for sensor data");
  const [showQr, setShowQr] = useState(false);

  // ==========================================
  // LOAD LOGGED-IN USER
  // ==========================================

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      navigate("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      setUser(parsedUser);

    } catch (error) {
      console.error(
        "Unable to read user:",
        error
      );

      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    const patientId = user.patientId || localStorage.getItem("patientId");
    if (!patientId) return;
    let disposed = false;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/vitals/${encodeURIComponent(patientId)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.vital) throw new Error("No recent sensor data");
        if (!disposed) {
          setVitals(data.vital);
          setLastUpdated(new Date(data.vital.measuredAt));
          setSensorStatus("Recent sensor data received");
        }
      } catch {
        if (!disposed) {
          setVitals({ heartRate: null, spo2: null, systolic: null, diastolic: null, temperature: null });
          setLastUpdated(null);
          setSensorStatus("Sensor data unavailable or stale");
        }
      }
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => { disposed = true; controller.abort(); clearInterval(interval); };
  }, [user]);

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {

    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    localStorage.removeItem("patientId");

    navigate("/login");
  };


  if (!user) {
    return (
      <div className="patient-loading">
        Loading Patient K...
      </div>
    );
  }


  return (

    <div className="patient-dashboard">

      {/* =====================================
          SIDEBAR
      ===================================== */}

      <aside className="patient-sidebar">

        <div className="patient-brand">

          <div className="patient-brand-logo">
            K
          </div>

          <div>
            <h2>Patient K</h2>

            <span>
              Connected Care
            </span>
          </div>

        </div>


        <nav className="patient-navigation">

          <button className="nav-item active">
            <span>⌂</span>
            Overview
          </button>

          <button className="nav-item">
            <span>♡</span>
            My Health
          </button>

          <button className="nav-item">
            <span>◷</span>
            History
          </button>

          <button className="nav-item">
            <span>⚙</span>
            Settings
          </button>

        </nav>


        <div className="sidebar-bottom">

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            ↪ Logout
          </button>

        </div>

      </aside>


      {/* =====================================
          MAIN
      ===================================== */}

      <main className="patient-main">


        {/* HEADER */}

        <header className="patient-header">

          <div>

            <p className="dashboard-label">
              PATIENT DASHBOARD
            </p>

            <h1>
              Good evening,{" "}
              {user.name?.split(" ")[0] || "Patient"}
            </h1>

            <p className="dashboard-subtitle">
              Here's your current health overview.
            </p>

          </div>


          <div className="patient-profile">

            <div className="profile-avatar">
              {user.name
                ? user.name.charAt(0).toUpperCase()
                : "P"}
            </div>

            <div>

              <strong>
                {user.name}
              </strong>

              <span>
                {user.patientId ||
                  localStorage.getItem("patientId") ||
                  "Patient"}
              </span>

            </div>

          </div>

        </header>


        {/* =====================================
            CONNECTION STATUS
        ===================================== */}

        <section className="device-status">

          <div className="device-status-left">

            <div className="connection-icon">
              ●
            </div>

            <div>

              <strong>
                ESP32
              </strong>

              <span>
                {sensorStatus}
              </span>

            </div>

          </div>


          <div className="connection-status">

            <span className="status-dot"></span>

            {sensorStatus}

          </div>

        </section>


        {/* =====================================
            PATIENT ID
        ===================================== */}

        <section className="patient-id-card">

          <div>

            <p>
              YOUR PATIENT ID
            </p>

            <h2>
              {user.patientId ||
                localStorage.getItem("patientId") ||
                "PATIENT ID"}
            </h2>

          </div>

          <button
            onClick={() => setShowQr(true)}
          >
            View QR →
          </button>

        </section>


        {/* =====================================
            VITALS
        ===================================== */}

        <section className="vitals-section">

          <div className="section-heading">

            <div>

              <p>
                LIVE MONITORING
              </p>

              <h2>
                Current Vitals
              </h2>

            </div>

            <span className="live-indicator">
              {lastUpdated ? "● RECENT DATA" : "WAITING"}
            </span>

          </div>


          <div className="vitals-grid">


            {/* HEART RATE */}

            <div className="vital-card">

              <div className="vital-top">

                <div className="vital-icon heart">
                  ♡
                </div>

                <span>
                  HEART RATE
                </span>

              </div>

              <div className="vital-value">

                {vitals.heartRate ?? "—"}

                <small>
                  BPM
                </small>

              </div>

              <div className="vital-normal">
                Measurement only; no clinical assessment
              </div>

            </div>


            {/* SPO2 */}

            <div className="vital-card">

              <div className="vital-top">

                <div className="vital-icon oxygen">
                  O₂
                </div>

                <span>
                  BLOOD OXYGEN
                </span>

              </div>

              <div className="vital-value">

                {vitals.spo2 ?? "—"}

                <small>
                  %
                </small>

              </div>

              <div className="vital-normal">
                Measurement only; no clinical assessment
              </div>

            </div>


            {/* BLOOD PRESSURE */}

            <div className="vital-card">

              <div className="vital-top">

                <div className="vital-icon pressure">
                  BP
                </div>

                <span>
                  BLOOD PRESSURE
                </span>

              </div>

              <div className="vital-value">

                {vitals.systolic ?? "—"}

                <small>
                  /
                </small>

                {vitals.diastolic ?? "—"}

                <small>
                  mmHg
                </small>

              </div>

              <div className="vital-normal">
                Measurement only; no clinical assessment
              </div>

            </div>


            {/* TEMPERATURE */}

            <div className="vital-card">

              <div className="vital-top">

                <div className="vital-icon temperature">
                  °
                </div>

                <span>
                  TEMPERATURE
                </span>

              </div>

              <div className="vital-value">

                {celsiusToFahrenheit(vitals.temperature) ?? "—"}

                <small>
                  °F
                </small>

              </div>

              <div className="vital-normal">
                Measurement only; no clinical assessment
              </div>

            </div>

          </div>

        </section>


        {/* =====================================
            LOWER SECTION
        ===================================== */}

        <EcgWaveform patientId={user.patientId || localStorage.getItem("patientId")} />

        <section className="patient-bottom-grid">


          {/* LAST UPDATE */}

          <div className="info-card">

            <div className="info-card-header">

              <div>

                <p>
                  MONITORING
                </p>

                <h3>
                  Last Updated
                </h3>

              </div>

              <span className="info-icon">
                ◷
              </span>

            </div>

            <div className="last-update">

              {lastUpdated?.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }) ?? "No recent reading"}

            </div>

            <p>
              Checks for sensor data every 3 seconds.
            </p>

          </div>


          {/* HEALTH STATUS */}

          <div className="info-card">

            <div className="info-card-header">

              <div>

                <p>
                  OVERALL STATUS
                </p>

                <h3>
                  Health Status
                </h3>

              </div>

              <span className="health-check">
                ✓
              </span>

            </div>

            <div className="health-status">
              Not assessed
            </div>

            <p>
              Missing readings are shown as unavailable.
            </p>

          </div>


        </section>


        {/* DEMO NOTICE */}

        <div className="demo-notice">

          <strong>
            Hardware monitoring
          </strong>

          <span>
            ESP32 sensor readings only. Blood pressure is unavailable with this hardware. Temperature requires a calibrated contact thermistor.
          </span>

        </div>


      </main>

      {showQr && (
        <div className="qr-modal-backdrop" role="presentation" onClick={() => setShowQr(false)}>
          <section
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="qr-modal-close"
              type="button"
              aria-label="Close QR code"
              onClick={() => setShowQr(false)}
            >
              ×
            </button>
            <p>SHARE MONITORING</p>
            <h2 id="qr-modal-title">Your Patient QR</h2>
            <QRCodeCanvas
              value={`${window.location.origin}/monitor/${encodeURIComponent(user.patientId || localStorage.getItem("patientId"))}`}
              size={220}
              bgColor="#ffffff"
              fgColor="#111827"
              level="H"
              includeMargin
            />
            <strong>{user.patientId || localStorage.getItem("patientId")}</strong>
            <span>Doctor or family members scan this code, then log in to view monitoring.</span>
          </section>
        </div>
      )}

    </div>
  );
}

export default PatientDashboard;
