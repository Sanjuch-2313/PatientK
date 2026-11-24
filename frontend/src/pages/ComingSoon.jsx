import { useEffect, useState } from "react";
import "./ComingSoon.css";

const ComingSoon = () => {
  // 6-month countdown
  const [targetDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 6);
    return date;
  });

  const [timeLeft, setTimeLeft] = useState({
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeLeft({
          months: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        });
        return;
      }

      const totalSeconds = Math.floor(difference / 1000);

      const seconds = totalSeconds % 60;
      const minutes = Math.floor(totalSeconds / 60) % 60;
      const hours = Math.floor(totalSeconds / 3600) % 24;
      const totalDays = Math.floor(totalSeconds / 86400);

      const months = Math.floor(totalDays / 30.4375);
      const days = Math.floor(
        totalDays - months * 30.4375
      );

      setTimeLeft({
        months,
        days,
        hours,
        minutes,
        seconds,
      });
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="patient-page">

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-container">

          <a href="/" className="logo">
            <div className="logo-mark">
              <svg viewBox="0 0 40 40" fill="none">
                <path
                  d="M20 34S6 25.5 6 15.8C6 10.3 10 7 14.5 7C17.3 7 19.2 8.4 20 10.7C20.8 8.4 22.7 7 25.5 7C30 7 34 10.3 34 15.8C34 25.5 20 34 20 34Z"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />

                <path
                  d="M9 19H14L17 14L20 24L23 12L26 19H31"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <span>PATIENT K</span>
          </a>

          <div className="nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#families">For Families</a>
            <a href="#hospitals">For Hospitals</a>
          </div>

          <button className="nav-button">
            Get Early Access
          </button>

        </div>
      </nav>

      {/* HERO */}
      <main className="hero-section">

        <div className="hero-container">

          {/* LEFT */}
          <section className="hero-content">

            <div className="coming-tag">
              <span></span>
              COMING SOON
            </div>

            <h1>
              Stay close to the ones
              <br />
              <span>who need you most.</span>
            </h1>

            <p className="hero-description">
              Patient K keeps families connected to their loved one's
              ICU care with timely, verified updates — even when
              they can't be there every day.
            </p>

            <div className="hero-actions">

              <button className="primary-button">
                Get Early Access
                <span>→</span>
              </button>

              <a
                href="#how-it-works"
                className="secondary-button"
              >
                Learn how it works
                <span>↓</span>
              </a>

            </div>

            <div className="trust-row">

              <div className="trust-item">

                <div className="trust-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Verified Updates
                  </strong>

                  <small>
                    From trusted caregivers
                  </small>
                </div>

              </div>

              <div className="trust-item">

                <div className="trust-icon">
                  ⌁
                </div>

                <div>
                  <strong>
                    Real-Time
                  </strong>

                  <small>
                    Stay informed instantly
                  </small>
                </div>

              </div>

            </div>

          </section>

          {/* RIGHT */}
          <section className="hero-visual">

            <div className="visual-glow"></div>

            <div className="phone-card">

              <div className="phone-top">

                <span>
                  Patient K
                </span>

                <div className="online">
                  <i></i>
                  Demo preview
                </div>

              </div>

              <div className="patient-card">

                <div className="patient-avatar">

                  <svg viewBox="0 0 64 64">

                    <circle
                      cx="32"
                      cy="23"
                      r="11"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    />

                    <path
                      d="M13 53C14 40 22 34 32 34C42 34 50 40 51 53"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    />

                  </svg>

                </div>

                <div>

                  <small>
                    Following
                  </small>

                  <h3>
                    My Father
                  </h3>

                  <p>
                    ICU · Ward 4
                  </p>

                </div>

                <span className="stable">
                  Stable
                </span>

              </div>

              <div className="update-title">

                Latest updates

                <span>
                  Today
                </span>

              </div>

              <div className="update">

                <div className="update-dot"></div>

                <div className="update-content">

                  <strong>
                    Doctor's Update
                  </strong>

                  <p>
                    Condition remains stable. Doctor
                    will review again this evening.
                  </p>

                  <small>
                    10 minutes ago
                  </small>

                </div>

              </div>

              <div className="update">

                <div className="update-dot meal"></div>

                <div className="update-content">

                  <strong>
                    Medication administered
                  </strong>

                  <p>
                    Morning medication given as prescribed.
                  </p>

                  <small>
                    1 hour ago
                  </small>

                </div>

              </div>

              <div className="update">

                <div className="update-dot food"></div>

                <div className="update-content">

                  <strong>
                    Meal update
                  </strong>

                  <p>
                    Breakfast served according to diet plan.
                  </p>

                  <small>
                    2 hours ago
                  </small>

                </div>

              </div>

              <div className="notification">

                <div className="notification-icon">
                  ✓
                </div>

                <div>

                  <strong>
                    Family updated
                  </strong>

                  <span>
                    Everyone is informed
                  </span>

                </div>

              </div>

            </div>

          </section>

        </div>

      </main>

      {/* BOTTOM STRIP */}
      <section className="bottom-strip">

        <div>
          <span>
            01
          </span>

          <p>
            Select your loved one
          </p>
        </div>

        <div>
          <span>
            02
          </span>

          <p>
            Receive verified updates
          </p>
        </div>

        <div>
          <span>
            03
          </span>

          <p>
            Stay connected
          </p>
        </div>

      </section>

      {/* SIMPLE FOOTER */}
      <footer>

        <div>

          <strong>
            PATIENT K
          </strong>

          <span>
            © 2026 Patient K. All rights reserved.
          </span>

        </div>

        <p>
          Compassionate care, connected families.
        </p>

      </footer>


      {/* =========================================
          BLUR THE EXISTING PAGE
      ========================================= */}

      <div className="coming-soon-blur"></div>


      {/* =========================================
          COMING SOON TIMER
      ========================================= */}

      <div className="coming-soon-timer">

        <div className="timer-card">

          <div className="timer-logo">
            <svg viewBox="0 0 40 40" fill="none">

              <path
                d="M20 34S6 25.5 6 15.8C6 10.3 10 7 14.5 7C17.3 7 19.2 8.4 20 10.7C20.8 8.4 22.7 7 25.5 7C30 7 34 10.3 34 15.8C34 25.5 20 34 20 34Z"
                stroke="currentColor"
                strokeWidth="2.5"
              />

              <path
                d="M9 19H14L17 14L20 24L23 12L26 19H31"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

            </svg>
          </div>

          <div className="timer-badge">
            <span></span>
            COMING SOON
          </div>

          <h2>
            Patient K is coming soon
          </h2>

          <p>
            We are building something meaningful
            to keep families connected.
          </p>

          <div className="timer">

            <div className="timer-unit">
              <strong>
                {String(timeLeft.months).padStart(2, "0")}
              </strong>
              <span>MONTHS</span>
            </div>

            <div className="timer-separator">
              :
            </div>

            <div className="timer-unit">
              <strong>
                {String(timeLeft.days).padStart(2, "0")}
              </strong>
              <span>DAYS</span>
            </div>

            <div className="timer-separator">
              :
            </div>

            <div className="timer-unit">
              <strong>
                {String(timeLeft.hours).padStart(2, "0")}
              </strong>
              <span>HOURS</span>
            </div>

            <div className="timer-separator">
              :
            </div>

            <div className="timer-unit">
              <strong>
                {String(timeLeft.minutes).padStart(2, "0")}
              </strong>
              <span>MIN</span>
            </div>

            <div className="timer-separator">
              :
            </div>

            <div className="timer-unit">
              <strong>
                {String(timeLeft.seconds).padStart(2, "0")}
              </strong>
              <span>SEC</span>
            </div>

          </div>

          <div className="timer-message">
            <span></span>
            We're preparing Patient K for you.
          </div>

        </div>

      </div>

    </div>
  );
};

export default ComingSoon;