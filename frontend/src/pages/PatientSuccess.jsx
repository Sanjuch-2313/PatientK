import { useNavigate, useLocation } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "./PatientSuccess.css";

function PatientSuccess() {
  const navigate = useNavigate();
  const location = useLocation();

  const patientId = location.state?.patientId;
  const patientName = location.state?.name;
  const monitoringUrl = patientId
    ? `${window.location.origin}/monitor/${encodeURIComponent(patientId)}`
    : "";

  if (!patientId) {
    return (
      <div className="patient-success-page">
        <div className="success-card">
          <h2>Patient information not found</h2>

          <button
            onClick={() => navigate("/register")}
            className="success-button"
          >
            Back to Registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-success-page">

      <div className="success-card">

        {/* Logo */}
        <div className="success-logo">
          K
        </div>

        {/* Success */}
        <div className="success-check">
          ✓
        </div>

        <div className="success-label">
          REGISTRATION COMPLETE
        </div>

        <h1>
          Welcome to Patient K
          {patientName ? `, ${patientName}` : ""}
        </h1>

        <p className="success-description">
          Your Patient K account has been created successfully.
          Keep your Patient ID safe. Your doctor can use it to
          connect with your care profile.
        </p>

        {/* Patient ID */}
        <div className="patient-id-box">

          <span className="patient-id-label">
            YOUR PATIENT ID
          </span>

          <strong>
            {patientId}
          </strong>

          <button
            className="copy-button"
            onClick={() =>
              navigator.clipboard.writeText(patientId)
            }
          >
            Copy ID
          </button>

        </div>

        {/* QR */}
        <div className="qr-section">

          <h3>
            Your Patient QR
          </h3>

          <p>
            A doctor or authorised family member can scan this QR
            to open your live monitoring page after they log in.
          </p>

          <div className="qr-wrapper">

            <QRCodeCanvas
              value={monitoringUrl}
              size={210}
              bgColor="#ffffff"
              fgColor="#111827"
              level="H"
              includeMargin={true}
            />

          </div>

          <p className="qr-note">
            This QR opens monitoring for:
            <br />
            <strong>{patientId}</strong>
          </p>

        </div>

        {/* Continue */}
        <button
  className="success-button"
  onClick={() => navigate("/login")}
>
  Continue to Login →
</button>

        <button
          className="secondary-button"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>

      </div>

    </div>
  );
}

export default PatientSuccess;
