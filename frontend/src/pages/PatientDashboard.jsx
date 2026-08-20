import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PatientDashboard.css";

function PatientDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  // Synthetic vitals for now
  const [vitals, setVitals] = useState({
    heartRate: 78,
    spo2: 97,
    systolic: 120,
    diastolic: 80,
    temperature: 36.8,
  });

  const [lastUpdated, setLastUpdated] = useState(
    new Date()
  );

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

// ==========================================
// SYNTHETIC VITALS → BACKEND
// ==========================================

useEffect(() => {

  if (!user) return;

  const patientId =
    user.patientId ||
    localStorage.getItem("patientId");

  if (!patientId) return;


  const sendSyntheticVitals = async () => {

    try {

      const syntheticVitals = {
        patientId,

        heartRate:
          Math.floor(Math.random() * 10) + 73,

        spo2:
          Math.floor(Math.random() * 3) + 96,

        systolic:
          Math.floor(Math.random() * 8) + 116,

        diastolic:
          Math.floor(Math.random() * 6) + 77,

        temperature:
          Number(
            (36.5 + Math.random() * 0.6).toFixed(1)
          ),

        source: "synthetic",
      };


      const response = await fetch(
        "http://localhost:5005/api/vitals",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(
            syntheticVitals
          ),
        }
      );


      const data = await response.json();


      if (!response.ok) {

        console.error(
          "Failed to save vitals:",
          data.message
        );

        return;
      }


      // Display the values returned by backend

      if (data.vital) {

        setVitals({
          heartRate:
            data.vital.heartRate,

          spo2:
            data.vital.spo2,

          systolic:
            data.vital.systolic,

          diastolic:
            data.vital.diastolic,

          temperature:
            data.vital.temperature,
        });

        setLastUpdated(
          new Date(data.vital.createdAt)
        );

      }

    } catch (error) {

      console.error(
        "Vitals API error:",
        error
      );

    }

  };


  // Send immediately

  sendSyntheticVitals();


  // Then every 10 seconds

  const interval = setInterval(
    sendSyntheticVitals,
    10000
  );


  return () => {
    clearInterval(interval);
  };

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
                Raspberry Pi
              </strong>

              <span>
                Monitoring device connected
              </span>

            </div>

          </div>


          <div className="connection-status">

            <span className="status-dot"></span>

            Simulated monitoring active

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
            onClick={() =>
              navigate("/patient-success")
            }
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
              ● LIVE
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

                {vitals.heartRate}

                <small>
                  BPM
                </small>

              </div>

              <div className="vital-normal">
                ● Normal range
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

                {vitals.spo2}

                <small>
                  %
                </small>

              </div>

              <div className="vital-normal">
                ● Normal range
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

                {vitals.systolic}

                <small>
                  /
                </small>

                {vitals.diastolic}

                <small>
                  mmHg
                </small>

              </div>

              <div className="vital-normal">
                ● Normal range
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

                {vitals.temperature}

                <small>
                  °C
                </small>

              </div>

              <div className="vital-normal">
                ● Normal range
              </div>

            </div>

          </div>

        </section>


        {/* =====================================
            LOWER SECTION
        ===================================== */}

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

              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}

            </div>

            <p>
              Data refreshes automatically every
              10 seconds in demo mode.
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
              Stable
            </div>

            <p>
              No abnormal readings detected
              in the current demo data.
            </p>

          </div>


        </section>


        {/* DEMO NOTICE */}

        <div className="demo-notice">

          <strong>
            Demo Mode
          </strong>

          <span>
            Current readings are simulated for
            prototype demonstration. Real sensor
            data will be connected through the
            Raspberry Pi.
          </span>

        </div>


      </main>

    </div>
  );
}

export default PatientDashboard;