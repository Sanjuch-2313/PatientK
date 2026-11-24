import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "./Login.css";

function Login() {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  // ==========================================
  // LOGIN
  // ==========================================

  const handleLogin = async (event) => {

    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );

      return;
    }

    try {

      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/auth/login`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            email: email.trim(),
            password: password,
          }),
        }
      );


      // ==========================================
      // CHECK RESPONSE
      // ==========================================

      const contentType =
        response.headers.get("content-type");


      if (
        !contentType ||
        !contentType.includes("application/json")
      ) {

        throw new Error(
          "Backend did not return JSON. Check that the Patient K backend is running."
        );

      }


      const data = await response.json();

      console.log(
        "Login response:",
        data
      );


      if (!response.ok) {

        throw new Error(
          data.message ||
            "Invalid email or password."
        );

      }


      // ==========================================
      // SAVE USER
      // ==========================================

      if (data.user) {

        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );

        localStorage.setItem(
          "userId",
          data.user.id || data.user._id
        );

        localStorage.setItem(
          "role",
          data.user.role
        );


        if (data.user.patientId) {

          localStorage.setItem(
            "patientId",
            data.user.patientId
          );

        }

      }


      // ==========================================
      // REDIRECT
      // ==========================================

      const userRole =
        data.user?.role;

      const next = searchParams.get("next");
      if (next?.startsWith("/monitor/")) {
        navigate(next);
        return;
      }


      /*
        TEMPORARILY GO TO HOME.

        We haven't created the actual
        Patient/Doctor/Nurse/Family dashboards yet.

        Once those dashboards are created,
        we will replace these with their routes.
      */

      if (userRole === "patient") {

        navigate("/patient-dashboard");

      } else if (userRole === "doctor") {

        navigate("/doctor-dashboard");

      } else if (userRole === "nurse") {

        navigate("/nurse-dashboard");

      } else if (userRole === "family") {

        navigate("/family-dashboard");

      } else {

        navigate("/");

      }

    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      setError(
        error.message ||
          "Unable to connect to Patient K server."
      );

    } finally {

      setLoading(false);

    }

  };


  // ==========================================
  // FORGOT PASSWORD
  // ==========================================

  const handleForgotPassword = () => {

    alert(
      "Forgot password functionality will be added next."
    );

  };


  return (

    <div className="login-page">

      <div className="login-card">


        {/* BACK */}

        <button
          type="button"
          className="login-back"
          onClick={() => navigate("/")}
        >
          ← Patient K
        </button>


        {/* LOGO */}

        <div className="login-logo">
          K
        </div>


        {/* HEADER */}

        <div className="login-header">

          <div className="section-label">
            PATIENT K
          </div>

          <h1>
            Welcome back
          </h1>

          <p>
            Sign in to continue to your remote
            care platform.
          </p>

        </div>


        {/* FORM */}

        <form onSubmit={handleLogin}>


          {/* EMAIL */}

          <label htmlFor="email">
            Email address
          </label>

          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {

              setEmail(event.target.value);
              setError("");

            }}
            required
          />


          {/* PASSWORD */}

          <div className="password-row">

            <label htmlFor="password">
              Password
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
            >
              Forgot password?
            </button>

          </div>


          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => {

              setPassword(event.target.value);
              setError("");

            }}
            required
          />


          {/* ERROR */}

          {error && (

            <div className="login-error">
              {error}
            </div>

          )}


          {/* SUBMIT */}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Signing in..."
              : "Sign In"}

          </button>

        </form>


        {/* CREATE ACCOUNT */}

        <div className="login-divider">

          <span>
            New to Patient K?
          </span>

        </div>


        <button
          type="button"
          className="create-account"
          onClick={() => navigate("/register")}
        >
          Create an account
        </button>


        {/* FOOTER */}

        <p className="login-footer">
          Patient K — Connected care beyond the hospital.
        </p>

      </div>

    </div>
  );
}

export default Login;
