import { useNavigate } from "react-router-dom";

function PatientSelection() {
  const navigate = useNavigate();

  const patients = [
    {
      id: "PK001",
      name: "Patient K",
      surgery: "Post-Surgery Care",
      status: "Stable",
    },
  ];

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
          ← Dashboard
        </button>

      </header>

      <main className="dashboard">

        <p className="eyebrow">
          PATIENT MANAGEMENT
        </p>

        <h1>Select Patient</h1>

        <p className="page-description">
          Choose a patient to view their recovery and vital signs.
        </p>

        <div className="patients-grid">

          {patients.map((patient) => (

            <div
              className="patient-card"
              key={patient.id}
            >

              <div className="patient-info">

                <div className="patient-avatar">
                  PK
                </div>

                <div>
                  <h3>{patient.name}</h3>

                  <p>
                    ID: {patient.id}
                  </p>

                  <p>
                    {patient.surgery}
                  </p>

                  <span className="stable-badge">
                    ● {patient.status}
                  </span>
                </div>

              </div>

              <button
                className="view-btn"
                onClick={() =>
                  navigate(`/patients/${patient.id}`)
                }
              >
                Monitor →
              </button>

            </div>

          ))}

        </div>

      </main>

    </div>
  );
}

export default PatientSelection;