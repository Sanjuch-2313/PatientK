import { useNavigate, useParams } from "react-router-dom";

function PatientDetails() {
  const navigate = useNavigate();
  const { patientId } = useParams();

  // Temporary simulated data
  const vitals = {
    heartRate: 78,
    spo2: 97,
    temperature: 37.1,
    systolic: 120,
    diastolic: 80,
  };

  return (
    <div className="app-page">

      <header className="navbar">

        <div className="logo">
          Patient K
        </div>

        <button
          className="back-btn"
          onClick={() => navigate("/dashboard")}
        >
          ← Back
        </button>

      </header>

      <main className="patient-dashboard">

        {/* Patient Header */}

        <section className="patient-header">

          <div>

            <p className="eyebrow">
              PATIENT MONITORING
            </p>

            <h1>
              Patient K
            </h1>

            <p>
              Patient ID: {patientId}
            </p>

            <p>
              Post-Surgery Care • Day 3
            </p>

          </div>

          <div className="patient-status">
            <span>●</span>
            Stable
          </div>

        </section>

        {/* Connection Status */}

        <div className="connection-bar">

          <span className="connected-dot">
            ●
          </span>

          <span>
            Monitoring active
          </span>

          <span className="last-updated">
            Last updated: Just now
          </span>

        </div>

        {/* Vital Cards */}

        <section className="vitals-grid">

          <div className="vital-card">

            <div className="vital-icon">
              ❤️
            </div>

            <p>Heart Rate</p>

            <h2>
              {vitals.heartRate}
              <small> BPM</small>
            </h2>

            <span className="normal">
              Normal
            </span>

          </div>

          <div className="vital-card">

            <div className="vital-icon">
              🫁
            </div>

            <p>Oxygen Saturation</p>

            <h2>
              {vitals.spo2}
              <small> %</small>
            </h2>

            <span className="normal">
              Normal
            </span>

          </div>

          <div className="vital-card">

            <div className="vital-icon">
              🌡️
            </div>

            <p>Temperature</p>

            <h2>
              {vitals.temperature}
              <small> °C</small>
            </h2>

            <span className="normal">
              Normal
            </span>

          </div>

          <div className="vital-card">

            <div className="vital-icon">
              🩺
            </div>

            <p>Blood Pressure</p>

            <h2>
              {vitals.systolic}/{vitals.diastolic}
            </h2>

            <span className="normal">
              Normal
            </span>

          </div>

        </section>

        {/* Trends */}

        <section className="monitor-section">

          <div className="section-title">

            <div>
              <h2>Vital Trends</h2>

              <p>
                Recent patient measurements
              </p>
            </div>

            <select>
              <option>Last 24 hours</option>
              <option>Last 7 days</option>
              <option>Last 30 days</option>
            </select>

          </div>

          <div className="chart-placeholder">

            <div className="chart-line">
              Vital history graph will appear here
            </div>

            <p>
              We will connect this to MongoDB after
              the backend API is ready.
            </p>

          </div>

        </section>

        {/* Alerts */}

        <section className="monitor-section">

          <div className="section-title">

            <div>
              <h2>Alerts</h2>

              <p>
                Patient safety notifications
              </p>
            </div>

          </div>

          <div className="no-alerts">

            <div className="check-icon">
              ✓
            </div>

            <div>
              <strong>
                No active alerts
              </strong>

              <p>
                All monitored vital signs are currently
                within the configured range.
              </p>
            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default PatientDetails;