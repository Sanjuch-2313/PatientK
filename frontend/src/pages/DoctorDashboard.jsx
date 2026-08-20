import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DoctorDashboard.css";

function DoctorDashboard() {

  const navigate = useNavigate();

  const [patientId, setPatientId] = useState("");
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const findPatient = async () => {

    if (!patientId.trim()) {
      setError("Enter a Patient ID.");
      return;
    }

    try {

      setLoading(true);
      setError("");
      setPatient(null);
      setVitals(null);

      /*
        For now we use the patient ID directly.

        Later we will add:
        QR scanner → Patient ID → same function
      */

      const response = await fetch(
        `http://localhost:5005/api/vitals/${patientId.trim()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Patient data not found."
        );
      }

      setVitals(data.vital);

      /*
        We currently only have vital information.
        Patient profile information will be added
        through the patient API later.
      */

      setPatient({
        patientId: patientId.trim(),
      });

    } catch (error) {

      console.error(
        "Patient search error:",
        error
      );

      setError(
        error.message ||
        "Unable to find patient."
      );

    } finally {

      setLoading(false);

    }
  };


  const logout = () => {

    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");

    navigate("/login");

  };


  return (

    <div className="doctor-dashboard">

      {/* SIDEBAR */}

      <aside className="doctor-sidebar">

        <div className="doctor-brand">

          <div className="doctor-logo">
            K
          </div>

          <div>
            <h2>Patient K</h2>
            <span>Clinical Portal</span>
          </div>

        </div>


        <nav>

          <button className="doctor-nav active">
            Overview
          </button>

          <button className="doctor-nav">
            Patients
          </button>

          <button className="doctor-nav">
            Alerts
          </button>

          <button className="doctor-nav">
            History
          </button>

        </nav>


        <button
          className="doctor-logout"
          onClick={logout}
        >
          ↪ Logout
        </button>

      </aside>


      {/* MAIN */}

      <main className="doctor-main">

        <header className="doctor-header">

          <div>

            <p>DOCTOR DASHBOARD</p>

            <h1>
              Patient Monitoring
            </h1>

            <span>
              Search for a patient to view
              remote health information.
            </span>

          </div>


          <div className="doctor-profile">

            <div className="doctor-avatar">
              D
            </div>

            <span>
              Doctor
            </span>

          </div>

        </header>


        {/* SEARCH */}

        <section className="patient-search-card">

          <div>

            <p>
              PATIENT ACCESS
            </p>

            <h2>
              Find a Patient
            </h2>

            <span>
              Enter the Patient ID provided
              by the patient.
            </span>

          </div>


          <div className="patient-search">

            <input
              type="text"
              placeholder="PAT-2026-0001"
              value={patientId}
              onChange={(e) => {
                setPatientId(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  findPatient();
                }
              }}
            />

            <button
              onClick={findPatient}
              disabled={loading}
            >
              {loading
                ? "Searching..."
                : "View Patient"}
            </button>

          </div>

          {error && (
            <div className="doctor-error">
              {error}
            </div>
          )}

        </section>


        {/* PATIENT */}

        {patient && vitals && (

          <>

            <section className="doctor-patient-header">

              <div>

                <p>
                  PATIENT RECORD
                </p>

                <h2>
                  Patient
                </h2>

                <span>
                  ID: {patient.patientId}
                </span>

              </div>


              <div className="patient-stable">
                ● Stable
              </div>

            </section>


            {/* VITALS */}

            <section className="doctor-vitals">

              <div className="doctor-vital-card">

                <span>
                  HEART RATE
                </span>

                <strong>
                  {vitals.heartRate}
                  <small> BPM</small>
                </strong>

                <em>
                  Normal
                </em>

              </div>


              <div className="doctor-vital-card">

                <span>
                  SpO₂
                </span>

                <strong>
                  {vitals.spo2}
                  <small> %</small>
                </strong>

                <em>
                  Normal
                </em>

              </div>


              <div className="doctor-vital-card">

                <span>
                  BLOOD PRESSURE
                </span>

                <strong>
                  {vitals.systolic}
                  /
                  {vitals.diastolic}
                  <small> mmHg</small>
                </strong>

                <em>
                  Normal
                </em>

              </div>


              <div className="doctor-vital-card">

                <span>
                  TEMPERATURE
                </span>

                <strong>
                  {vitals.temperature}
                  <small> °C</small>
                </strong>

                <em>
                  Normal
                </em>

              </div>

            </section>


            {/* DEVICE */}

            <section className="doctor-device">

              <div>

                <span>
                  MONITORING DEVICE
                </span>

                <h3>
                  Raspberry Pi
                </h3>

              </div>

              <div className="device-connected">
                ● Connected
              </div>

            </section>


            {/* LAST READING */}

            <section className="doctor-reading">

              <div>

                <p>
                  LAST READING
                </p>

                <h3>
                  {new Date(
                    vitals.createdAt
                  ).toLocaleString()}
                </h3>

              </div>

              <span>
                Source: {vitals.source}
              </span>

            </section>

          </>

        )}


        {/* EMPTY */}

        {!patient && !loading && (

          <div className="doctor-empty">

            <div>
              K
            </div>

            <h2>
              No patient selected
            </h2>

            <p>
              Enter a Patient ID above to
              start monitoring a patient.
            </p>

          </div>

        )}

      </main>

    </div>
  );
}

export default DoctorDashboard;