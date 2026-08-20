import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Register.css";

function Register() {

  const navigate = useNavigate();

  const [role, setRole] = useState("");

  const roles = [
    {
      id: "patient",
      icon: "♡",
      title: "Patient",
      description:
        "Monitor your recovery and stay connected with your care team.",
    },

    {
      id: "family",
      icon: "♧",
      title: "Family Member",
      description:
        "Stay informed about the recovery of your loved one.",
    },

    {
      id: "doctor",
      icon: "✚",
      title: "Doctor",
      description:
        "Monitor patients and review important health information.",
    },

    {
      id: "nurse",
      icon: "✚",
      title: "Nurse",
      description:
        "Track patient status and respond to care alerts.",
    },
  ];


  return (

    <div className="register-page">

      <div className="register-container">


        <button
          className="register-back"
          onClick={() => navigate("/")}
        >
          ← Back to Patient K
        </button>


        <div className="register-header">

          <div className="register-logo">
            K
          </div>

          <div className="section-label">
            GET STARTED
          </div>

          <h1>
            How will you use
            <br />
            Patient K?
          </h1>

          <p>
            Select your role to create your Patient K account.
          </p>

        </div>


        <div className="role-grid">

          {roles.map((item) => (

            <button
              key={item.id}
              className={`role-card ${
                role === item.id ? "selected" : ""
              }`}
              onClick={() => setRole(item.id)}
            >

              <div className="role-icon">
                {item.icon}
              </div>

              <div className="role-content">

                <h3>
                  {item.title}
                </h3>

                <p>
                  {item.description}
                </p>

              </div>


              <div className="role-radio">

                {role === item.id && "✓"}

              </div>

            </button>

          ))}

        </div>


        <button
          className="register-continue"
          disabled={!role}
          onClick={() => navigate("/login")}
        >
          Continue →
        </button>


        <p className="already-account">

          Already have an account?

          <button
            onClick={() => navigate("/login")}
          >
            Sign In
          </button>

        </p>

      </div>

    </div>
  );
}

export default Register;