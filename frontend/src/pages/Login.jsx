import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");


  const handleLogin = (event) => {

    event.preventDefault();

    console.log("Email:", email);
    console.log("Password:", password);

    // Backend authentication will be connected later.
  };


  return (

    <div className="login-page">

      <div className="login-card">


        <button
          className="login-back"
          onClick={() => navigate("/")}
        >
          ← Patient K
        </button>


        <div className="login-logo">
          K
        </div>


        <div className="login-header">

          <div className="section-label">
            PATIENT K
          </div>

          <h1>
            Welcome back
          </h1>

          <p>
            Sign in to continue to your remote care platform.
          </p>

        </div>


        <form onSubmit={handleLogin}>

          <label>
            Email address
          </label>

          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />


          <div className="password-row">

            <label>
              Password
            </label>

            <button type="button">
              Forgot password?
            </button>

          </div>


          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />


          <button
            className="login-submit"
            type="submit"
          >
            Sign In
          </button>

        </form>


        <div className="login-divider">

          <span>
            New to Patient K?
          </span>

        </div>


        <button
          className="create-account"
          onClick={() => navigate("/register")}
        >
          Create an account
        </button>


        <p className="login-footer">
          Patient K — Connected care beyond the hospital.
        </p>

      </div>

    </div>
  );
}

export default Login;