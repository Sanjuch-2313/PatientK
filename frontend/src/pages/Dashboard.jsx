import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
      });
    }
  };

  const getCardStyle = (index) => {
    const sectionHeight = window.innerHeight * 0.9;

    const progress = Math.min(
      Math.max(
        (scrollY - index * sectionHeight) / sectionHeight,
        0
      ),
      1
    );

    return {
      transform: `
        translateY(${-progress * 45}px)
        scale(${1 - progress * 0.035})
        rotateX(${progress * 1.5}deg)
      `,
      opacity: 1 - progress * 0.12,
    };
  };

  return (
    <div className="dashboard-page">

      {/* ================= NAVBAR ================= */}

      <nav className="navbar">

        <div
          className="navbar-brand"
          onClick={() => navigate("/")}
        >
          <div className="brand-logo">K</div>

          <div className="brand-text">
            <h2>Patient K</h2>
            <span>Remote Patient Care</span>
          </div>
        </div>

        <div className="navbar-links">

          <button onClick={() => scrollToSection("about")}>
            About
          </button>

          <button onClick={() => scrollToSection("how-it-works")}>
            How It Works
          </button>

          <button onClick={() => scrollToSection("technology")}>
            Technology
          </button>

          <button
            className="signin-button"
            onClick={() => navigate("/login")}
          >
            Sign In
          </button>

          <button
            className="signup-button"
            onClick={() => navigate("/register")}
          >
            Get Started
          </button>

        </div>
      </nav>


      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="stack-wrapper">

        <div
          className="peel-card hero-card"
          style={getCardStyle(0)}
        >

          <div className="hero-content">

            <div className="hero-badge">
              ● REMOTE POST-SURGERY CARE
            </div>

            <h1>
              Better recovery.
              <br />
              <span>Closer care.</span>
            </h1>

            <p>
              Patient K helps doctors, nurses, and families
              remotely monitor patients during post-surgery
              recovery using connected health devices and
              intelligent monitoring.
            </p>

            <div className="hero-buttons">

              <button
                className="primary-button"
                onClick={() => navigate("/register")}
              >
                Start Monitoring →
              </button>

              <button
                className="secondary-button"
                onClick={() => scrollToSection("about")}
              >
                Learn More
              </button>

            </div>

            <div className="hero-features">
              <span>✓ Real-time monitoring</span>
              <span>✓ Remote access</span>
              <span>✓ Intelligent alerts</span>
            </div>

          </div>


          {/* MONITOR CARD */}

          <div className="hero-monitor">

            <div className="monitor-card">

              <div className="monitor-top">

                <div>
                  <small>PATIENT MONITOR</small>

                  <h3>Patient K</h3>

                  <p>Post-Surgery · Day 3</p>
                </div>

                <div className="stable">
                  ● Stable
                </div>

              </div>


              <div className="vitals">

                <div className="vital">
                  <div className="vital-icon">♥</div>

                  <small>Heart Rate</small>

                  <strong>
                    78 <span>BPM</span>
                  </strong>
                </div>


                <div className="vital">
                  <div className="vital-icon">O₂</div>

                  <small>SpO₂</small>

                  <strong>
                    97 <span>%</span>
                  </strong>
                </div>


                <div className="vital">
                  <div className="vital-icon">°C</div>

                  <small>Temperature</small>

                  <strong>
                    37.1 <span>°C</span>
                  </strong>
                </div>


                <div className="vital">
                  <div className="vital-icon">BP</div>

                  <small>Blood Pressure</small>

                  <strong>120/80</strong>
                </div>

              </div>


              <div className="monitor-status">

                <div className="status-circle">
                  ●
                </div>

                <div>
                  <strong>Monitoring Active</strong>

                  <span>
                    Patient data received recently
                  </span>
                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          ABOUT
      ===================================================== */}

      <section
        id="about"
        className="stack-wrapper"
      >

        <div
          className="peel-card about-card-section"
          style={getCardStyle(1)}
        >

          <div className="section-label">
            ABOUT PATIENT K
          </div>

          <h2>
            Healthcare doesn't stop
            <br />
            when the patient leaves the hospital.
          </h2>

          <p className="section-description">
            Patient K extends post-surgery care beyond the
            hospital by connecting patients with doctors,
            nurses and family members remotely.
          </p>


          <div className="about-cards">

            <div className="about-feature-card">

              <div className="about-icon">
                ◉
              </div>

              <h3>Continuous Monitoring</h3>

              <p>
                Health measurements can be collected from
                connected monitoring devices and displayed
                remotely.
              </p>

            </div>


            <div className="about-feature-card">

              <div className="about-icon">
                !
              </div>

              <h3>Intelligent Alerts</h3>

              <p>
                The system can identify unusual changes in
                patient data and alert authorized caregivers.
              </p>

            </div>


            <div className="about-feature-card">

              <div className="about-icon">
                ♡
              </div>

              <h3>Connected Care</h3>

              <p>
                Doctors, nurses and authorized family members
                can access patient information remotely.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          HOW IT WORKS
      ===================================================== */}

      <section
        id="how-it-works"
        className="stack-wrapper"
      >

        <div
          className="peel-card how-card"
          style={getCardStyle(2)}
        >

          <div className="section-label">
            HOW IT WORKS
          </div>

          <h2>
            From patient
            <br />
            to care team.
          </h2>

          <p className="section-description">
            Patient K connects patient monitoring with a
            remote healthcare platform.
          </p>


          <div className="steps">

            <div className="step">

              <div className="step-number">
                01
              </div>

              <h3>Monitor</h3>

              <p>
                Patient health measurements are collected
                using connected monitoring devices.
              </p>

            </div>


            <div className="step-line" />


            <div className="step">

              <div className="step-number">
                02
              </div>

              <h3>Connect</h3>

              <p>
                Data is transferred to the Patient K
                platform for processing and storage.
              </p>

            </div>


            <div className="step-line" />


            <div className="step">

              <div className="step-number">
                03
              </div>

              <h3>Respond</h3>

              <p>
                Authorized caregivers can view patient
                status and respond to alerts remotely.
              </p>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          TECHNOLOGY
      ===================================================== */}

      <section
        id="technology"
        className="stack-wrapper"
      >

        <div
          className="peel-card technology-card"
          style={getCardStyle(3)}
        >

          {/* LEFT SIDE */}

          <div className="technology-heading">

            <div className="section-label">
              PATIENT K TECHNOLOGY
            </div>

            <h2>
              Hardware.
              <br />
              IoT.
              <br />
              AI.
            </h2>

            <p>
              Patient K combines Raspberry Pi based IoT
              monitoring, connected health sensors, cloud
              infrastructure and AI/ML based anomaly detection.
            </p>

          </div>


          {/* RIGHT SIDE */}

          <div className="technology-content">


            {/* RASPBERRY PI */}

            <div className="tech-block">

              <div className="tech-number">
                01
              </div>

              <div>

                <h3>Raspberry Pi</h3>

                <span className="tech-type">
                  EDGE COMPUTING / IoT
                </span>

                <p>
                  Acts as the local IoT controller. It
                  collects readings from connected sensors,
                  performs initial processing and sends
                  patient data to the backend through the
                  internet.
                </p>

              </div>

            </div>


            {/* SENSORS */}

            <div className="tech-block">

              <div className="tech-number">
                02
              </div>

              <div className="sensor-area">

                <h3>Patient Monitoring Sensors</h3>

                <span className="tech-type">
                  VITAL PARAMETERS
                </span>


                <div className="sensor-grid">


                  <div className="sensor-card">

                    <div className="sensor-symbol">
                      ♥
                    </div>

                    <div>

                      <strong>MAX30102</strong>

                      <span>Heart Rate</span>

                      <small>BPM</small>

                    </div>

                  </div>


                  <div className="sensor-card">

                    <div className="sensor-symbol">
                      O₂
                    </div>

                    <div>

                      <strong>MAX30102</strong>

                      <span>SpO₂</span>

                      <small>Oxygen Saturation %</small>

                    </div>

                  </div>


                  <div className="sensor-card">

                    <div className="sensor-symbol">
                      °C
                    </div>

                    <div>

                      <strong>DS18B20</strong>

                      <span>Temperature</span>

                      <small>°C</small>

                    </div>

                  </div>


                  <div className="sensor-card">

                    <div className="sensor-symbol">
                      BP
                    </div>

                    <div>

                      <strong>BP Monitor</strong>

                      <span>Blood Pressure</span>

                      <small>SYS / DIA mmHg</small>

                    </div>

                  </div>

                </div>

              </div>

            </div>


            {/* DATA PIPELINE */}

            <div className="tech-block">

              <div className="tech-number">
                03
              </div>

              <div>

                <h3>Data Pipeline</h3>

                <span className="tech-type">
                  IoT → CLOUD → WEB
                </span>


                <div className="data-flow">

                  <div>
                    <b>Sensors</b>
                    <span>Vital readings</span>
                  </div>

                  <div className="flow-arrow">
                    →
                  </div>

                  <div>
                    <b>Raspberry Pi</b>
                    <span>Collect + process</span>
                  </div>

                  <div className="flow-arrow">
                    →
                  </div>

                  <div>
                    <b>Cloud / API</b>
                    <span>Store + transmit</span>
                  </div>

                  <div className="flow-arrow">
                    →
                  </div>

                  <div>
                    <b>Dashboard</b>
                    <span>Monitor + alert</span>
                  </div>

                </div>

              </div>

            </div>


            {/* AI / ML */}

            <div className="tech-block ai-block">

              <div className="tech-number">
                04
              </div>

              <div>

                <h3>AI / ML Anomaly Detection</h3>

                <span className="tech-type">
                  INTELLIGENT MONITORING
                </span>

                <p>
                  The system analyzes patient vital trends
                  and identifies unusual patterns. When a
                  significant abnormality is detected, the
                  platform can generate an alert for the
                  authorized care team.
                </p>


                <div className="ai-tags">

                  <span>Heart Rate</span>

                  <span>SpO₂</span>

                  <span>Temperature</span>

                  <span>Blood Pressure</span>

                  <span>Trend Analysis</span>

                  <span>Anomaly Detection</span>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          CTA
      ===================================================== */}

      <section className="stack-wrapper">

        <div
          className="peel-card cta-card"
          style={getCardStyle(4)}
        >

          <div>

            <div className="section-label">
              GET STARTED
            </div>

            <h2>
              Stay connected to
              <br />
              the people who need care.
            </h2>

            <p>
              Create your Patient K account and start building
              a connected remote care experience.
            </p>

          </div>


          <button
            className="cta-button"
            onClick={() => navigate("/register")}
          >
            Create Account →
          </button>

        </div>

      </section>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="footer">

        <div className="footer-brand">

          <div className="brand-logo">
            K
          </div>

          <div>

            <strong>Patient K</strong>

            <span>
              Remote Patient Care
            </span>

          </div>

        </div>

        <p>
          © 2026 Patient K. Connected care beyond the hospital.
        </p>

      </footer>

    </div>
  );
}

export default Dashboard;