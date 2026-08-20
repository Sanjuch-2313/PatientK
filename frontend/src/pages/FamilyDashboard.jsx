import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FamilyDashboard.css";

function FamilyDashboard() {

  const navigate = useNavigate();

  const [patientId, setPatientId] = useState("");
  const [vitals, setVitals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const viewPatient = async () => {

    if (!patientId.trim()) {
      setError("Enter the Patient ID.");
      return;
    }

    try {

      setLoading(true);
      setError("");

      const response = await fetch(
        `http://localhost:5005/api/vitals/${patientId.trim()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Patient not found."
        );
      }

      setVitals(data.vital);

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
                ● Stable
              </span>

            </div>


            <div className="family-vitals">


              <div className="family-vital">

                <span>
                  Heart Rate
                </span>

                <strong>
                  {vitals.heartRate}
                  <small> BPM</small>
                </strong>

              </div>


              <div className="family-vital">

                <span>
                  Blood Oxygen
                </span>

                <strong>
                  {vitals.spo2}
                  <small> %</small>
                </strong>

              </div>


              <div className="family-vital">

                <span>
                  Blood Pressure
                </span>

                <strong>
                  {vitals.systolic}/
                  {vitals.diastolic}
                  <small> mmHg</small>
                </strong>

              </div>


              <div className="family-vital">

                <span>
                  Temperature
                </span>

                <strong>
                  {vitals.temperature}
                  <small> °C</small>
                </strong>

              </div>

            </div>


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