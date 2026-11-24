import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  const [role, setRole] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!role) {
      setError("Please select your role.");
      return;
    }

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/register`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name: formData.name.trim(),
            email: formData.email.trim(),
            password: formData.password,
            role: role,
          }),
        }
      );

      const data = await response.json();

      console.log("Registration response:", data);

      if (!response.ok) {
        throw new Error(
          data.message || "Registration failed."
        );
      }

      // ==========================================
      // PATIENT
      // ==========================================

      if (role === "patient") {
        if (!data.user?.patientId) {
          setError(
            "Registration succeeded, but Patient ID was not received."
          );

          return;
        }

        console.log(
          "Patient ID:",
          data.user.patientId
        );

        navigate("/patient-success", {
          state: {
            patientId: data.user.patientId,
            name: data.user.name,
            deviceId: data.device?.deviceId || null,
            apiToken: data.apiToken || null,
          },
        });

        return;
      }

      // ==========================================
      // DOCTOR / NURSE / FAMILY
      // ==========================================

      setSuccess(
        "Registration successful! Redirecting to login..."
      );

      setTimeout(() => {
        navigate("/login");
      }, 1500);

    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      setError(
        error.message ||
          "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">

      <div className="register-container">

        <button
          type="button"
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
            Create your
            <br />
            Patient K account
          </h1>

          <p>
            Enter your details and select how you will
            use Patient K.
          </p>

        </div>

        <form
          className="register-form"
          onSubmit={handleRegister}
        >

          {/* NAME */}

          <div className="form-group">

            <label htmlFor="name">
              Full Name
            </label>

            <input
              id="name"
              name="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
              required
            />

          </div>


          {/* EMAIL */}

          <div className="form-group">

            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />

          </div>


          {/* PASSWORD */}

          <div className="form-group">

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="Create a password"
              value={formData.password}
              onChange={handleChange}
              required
            />

          </div>


          {/* CONFIRM PASSWORD */}

          <div className="form-group">

            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />

          </div>


          {/* ROLE */}

          <div className="role-section">

            <label className="role-label">
              Register as
            </label>

            <div className="role-grid">

              {roles.map((item) => (

                <button
                  type="button"
                  key={item.id}
                  className={`role-card ${
                    role === item.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => {
                    setRole(item.id);
                    setError("");
                  }}
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

          </div>


          {/* ERROR */}

          {error && (
            <div className="register-error">
              {error}
            </div>
          )}


          {/* SUCCESS */}

          {success && (
            <div className="register-success">
              {success}
            </div>
          )}


          {/* SUBMIT */}

          <button
            type="submit"
            className="register-continue"
            disabled={loading}
          >
            {loading
              ? "Creating Account..."
              : "Create Account →"}
          </button>

        </form>


        <p className="already-account">

          Already have an account?

          <button
            type="button"
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