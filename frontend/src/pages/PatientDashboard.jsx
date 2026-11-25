import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import EcgWaveform from "../components/EcgWaveform";
import AnatomicalHeart from "../components/AnatomicalHeart";
import { API_BASE_URL } from "../config";
import { celsiusToFahrenheit } from "../utils/temperature";
import { useCriticalAlarm } from "../hooks/useCriticalAlarm";
import CriticalAlarmBanner from "../components/CriticalAlarmBanner";
import "./PatientDashboard.css";

function PatientDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  const emptyVitals = { heartRate: null, spo2: null, systolic: null, diastolic: null, temperature: null };
  const [vitals, setVitals] = useState(emptyVitals);
  const [history, setHistory] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sensorStatus, setSensorStatus] = useState("Waiting for sensor data");
  const [showQr, setShowQr] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [tempUnit, setTempUnit] = useState(() => localStorage.getItem("pk_temp_unit") || "F");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date().toDateString());

  // ── Critical alarm (browser beep + notification) ──────────
  const { isCritical, criticalReasons, permissionState } = useCriticalAlarm(vitals);
  function handleAllowAlarm() {
    Notification.requestPermission();
    // Also unlock AudioContext on user gesture
    try { new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }

  // ==========================================
  // LOAD LOGGED-IN USER
  // ==========================================

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      navigate("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);

      setUser(parsedUser);

    } catch (error) {
      console.error(
        "Unable to read user:",
        error
      );

      localStorage.clear();
      navigate("/login");
    }
  }, [navigate]);

  // Testing flow: request camera permission once when the patient dashboard opens.
  // The stream is immediately stopped; the clinician opens the live stream later.
  useEffect(() => {
    if (!user || localStorage.getItem("pk_camera_permission_requested") === "true") return undefined;
    let stream;
    const requestCameraPermission = async () => {
      localStorage.setItem("pk_camera_permission_requested", "true");
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // The clinician can still try the camera later after browser permission is changed.
      }
    };
    requestCameraPermission();
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const patientId = user.patientId || localStorage.getItem("patientId");
    if (!patientId) return;
    let disposed = false;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const [latestRes, historyRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/vitals/${encodeURIComponent(patientId)}`, { signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/vitals/${encodeURIComponent(patientId)}/history`, { signal: controller.signal }),
        ]);

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (!disposed && Array.isArray(historyData.vitals)) {
            setHistory(historyData.vitals);
          }
        }

        const data = await latestRes.json();
        if (!latestRes.ok || !data.vital) throw new Error("No recent sensor data");
        if (!disposed) {
          setVitals(data.vital);
          setLastUpdated(new Date(data.vital.measuredAt));
          setSensorStatus("Recent sensor data received");
        }
      } catch {
        if (!disposed) {
          setVitals({ heartRate: null, spo2: null, systolic: null, diastolic: null, temperature: null });
          setLastUpdated(null);
          setSensorStatus("Sensor data unavailable or stale");
        }
      }
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => { disposed = true; controller.abort(); clearInterval(interval); };
  }, [user]);

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {

    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    localStorage.removeItem("patientId");

    navigate("/login");
  };

  if (!user) {
    return (
      <div className="patient-loading">
        Loading PatientK...
      </div>
    );
  }

  const patientId = user.patientId || localStorage.getItem("patientId") || "PATIENT ID";
  const formatTemp = (celsius) => {
    if (celsius == null) return null;
    return tempUnit === "F" ? celsiusToFahrenheit(celsius) : Number(celsius.toFixed(1));
  };
  const tempDisplay = formatTemp(vitals.temperature);
  const formattedTime = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "Waiting";
  const isLive = Boolean(lastUpdated);

  // Visual-only derived percentage for the status gauge card
  const activeMetricsCount = [vitals.heartRate, vitals.spo2, vitals.temperature].filter((v) => v != null).length;
  const healthGaugePct = isLive ? Math.max(65, Math.min(98, 60 + activeMetricsCount * 12)) : 0;

  // 7-day strip centered on today
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + (i - 3));
    return {
      date: d.getDate(),
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      isToday: i === 3,
      dateStr: d.toDateString(),
    };
  });

  // Report summary stats from history
  const calcStats = (values) => {
    const valid = values.filter((v) => typeof v === "number" && Number.isFinite(v));
    if (!valid.length) return { min: "—", max: "—", avg: "—" };
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const avg = (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
    return { min, max, avg };
  };

  const hrStats = calcStats(history.map((r) => r.heartRate));
  const spo2Stats = calcStats(history.map((r) => r.spo2));
  const tempStats = calcStats(history.map((r) => formatTemp(r.temperature)));

  const handleExportCsv = () => {
    const headers = ["Date", "Time", "Heart Rate (BPM)", "SpO2 (%)", `Temperature (°${tempUnit})`, "ECG Leads"];
    const rows = history.map((item) => {
      const dt = new Date(item.measuredAt || item.createdAt);
      return [
        dt.toLocaleDateString(),
        dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        item.heartRate ?? "",
        item.spo2 ?? "",
        formatTemp(item.temperature) ?? "",
        item.leadsOff === false ? "Attached" : item.leadsOff === true ? "Leads Off" : "N/A",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${patientId}-vitals-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleTempUnitChange = (unit) => {
    setTempUnit(unit);
    localStorage.setItem("pk_temp_unit", unit);
  };

  // Full calendar grid helpers
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const recordedDates = new Set(
    history.map((item) => new Date(item.measuredAt || item.createdAt).toDateString())
  );
  const selectedDayRecordings = history.filter(
    (item) => new Date(item.measuredAt || item.createdAt).toDateString() === selectedDay
  );

  const navTabs = ["Dashboard", "Vitals", "Reports", "Calendar", "Settings"];

  return (
    <div className="pk-shell-bg">
      <CriticalAlarmBanner
        isCritical={isCritical}
        criticalReasons={criticalReasons}
        permissionState={permissionState}
        onAllow={handleAllowAlarm}
      />
      <div className="pk-dashboard-frame">
        {/* =====================================
            TOP NAVIGATION BAR
        ===================================== */}
        <header className="pk-topbar">
          <div className="pk-brand">
            <div className="pk-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                <path d="M7 12h2l1.5 -3l2 6l1.5 -3h3" />
              </svg>
            </div>
            <span className="pk-brand-name">PatientK</span>
          </div>

          <nav className="pk-nav-pills" aria-label="Patient navigation">
            {navTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`pk-nav-pill ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="pk-topbar-actions">
            <button
              type="button"
              className="pk-search-pill"
              onClick={() => setShowQr(true)}
              title="View Patient QR"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span>{patientId}</span>
            </button>

            <button
              type="button"
              className="pk-icon-btn"
              title={sensorStatus}
              aria-label={sensorStatus}
              onClick={() => setActiveTab("Vitals")}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className={`pk-bell-dot ${isLive ? "live" : ""}`} />
            </button>

            <button
              type="button"
              className="pk-avatar-btn"
              onClick={() => setActiveTab("Settings")}
              title={`Logged in as ${user.name}`}
            >
              <span>{user.name ? user.name.charAt(0).toUpperCase() : "P"}</span>
            </button>
          </div>
        </header>

        {/* =====================================
            TAB 1: DASHBOARD OVERVIEW
        ===================================== */}
        {activeTab === "Dashboard" && (
          <main className="pk-bento-grid">
            {/* LEFT COLUMN */}
            <div className="pk-col-left">
              <div className="pk-kpi-row">
                <div className="pk-kpi-card" onClick={() => setActiveTab("Vitals")} role="button" tabIndex={0}>
                  <div className="pk-kpi-head">
                    <div className="pk-kpi-icon blue">♡</div>
                    <div>
                      <div className="pk-kpi-title">Heart Rate</div>
                      <div className="pk-kpi-sub">Normal Range</div>
                    </div>
                  </div>
                  <div className="pk-kpi-foot">
                    <div className="pk-kpi-val">
                      {vitals.heartRate ?? "—"} <small>BPM</small>
                    </div>
                    <span className="pk-kpi-time">{formattedTime}</span>
                  </div>
                </div>

                <div className="pk-kpi-card" onClick={() => setActiveTab("Vitals")} role="button" tabIndex={0}>
                  <div className="pk-kpi-head">
                    <div className="pk-kpi-icon coral">BP</div>
                    <div>
                      <div className="pk-kpi-title">Blood Pressure</div>
                      <div className="pk-kpi-sub">Normal Range</div>
                    </div>
                  </div>
                  <div className="pk-kpi-foot">
                    <div className="pk-kpi-val">
                      {vitals.systolic ?? "—"}/{vitals.diastolic ?? "—"}
                    </div>
                    <span className="pk-kpi-time">{formattedTime}</span>
                  </div>
                </div>

                <div className="pk-kpi-card" onClick={() => setActiveTab("Vitals")} role="button" tabIndex={0}>
                  <div className="pk-kpi-head">
                    <div className="pk-kpi-icon green">O₂</div>
                    <div>
                      <div className="pk-kpi-title">SpO2</div>
                      <div className="pk-kpi-sub">Normal Range</div>
                    </div>
                  </div>
                  <div className="pk-kpi-foot">
                    <div className="pk-kpi-val">
                      {vitals.spo2 ?? "—"}
                      <small>%</small>
                    </div>
                    <span className="pk-kpi-time">{formattedTime}</span>
                  </div>
                </div>
              </div>

              <section className="pk-hero-card">
                <div className="pk-hero-header">
                  <div>
                    <span className="pk-eyebrow">Check Your</span>
                    <h2>Overall Health Status</h2>
                  </div>
                  <div className="pk-hero-status">
                    <span className={`pk-status-pill ${isLive ? "active" : "waiting"}`}>
                      {isLive ? "Active" : "Waiting"}
                    </span>
                    <div className="pk-hero-pct">{isLive ? `${healthGaugePct}%` : "—"}</div>
                  </div>
                </div>

                <div className="pk-heart-stage">
                  <AnatomicalHeart active={isLive} heartRate={vitals.heartRate} />

                  <div className="pk-float-card pk-float-spo2">
                    <span className="pk-float-dot" />
                    <span className="pk-float-label">Oxygen Saturation</span>
                    <strong>{vitals.spo2 != null ? `${vitals.spo2}%` : "—"}</strong>
                    <small>SpO2</small>
                  </div>

                  <div className="pk-float-card pk-float-bp">
                    <span className="pk-float-dot" />
                    <span className="pk-float-label">Blood Pressure</span>
                    <strong>{vitals.systolic != null && vitals.diastolic != null ? `${vitals.systolic}/${vitals.diastolic}` : "—/—"}</strong>
                    <small>mmHg</small>
                  </div>

                  <div className="pk-float-card pk-float-temp">
                    <span className="pk-float-dot" />
                    <span className="pk-float-label">Temperature</span>
                    <strong>{tempDisplay != null ? `${tempDisplay}°${tempUnit}` : "—"}</strong>
                    <small>Body Temp</small>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="pk-col-right">
              <div className="pk-right-row-2">
                <div className="pk-card pk-ecg-card">
                  <div className="pk-card-top">
                    <div className="pk-mini-icon">♡</div>
                    <div>
                      <span className="pk-card-label">Heart Rate · Live ECG</span>
                      <div className="pk-card-big">
                        {vitals.heartRate ?? "—"} <small>BPM</small>
                      </div>
                    </div>
                  </div>
                  <div className="pk-ecg-embed">
                    <EcgWaveform patientId={patientId} compact />
                  </div>
                </div>

                <div className="pk-card pk-meter-card">
                  <div className="pk-card-top">
                    <div className="pk-mini-icon">◉</div>
                    <div>
                      <span className="pk-card-label">ESP32 Status</span>
                      <div className="pk-card-big">
                        {isLive ? "Online" : "Waiting"}
                      </div>
                    </div>
                  </div>
                  <div className="pk-tick-meter">
                    <div className="pk-ticks" aria-hidden="true">
                      {Array.from({ length: 14 }, (_, idx) => (
                        <span
                          key={idx}
                          className={`pk-tick ${idx === 7 && isLive ? "highlight" : ""} ${idx % 3 === 0 ? "tall" : ""}`}
                        />
                      ))}
                    </div>
                    <div className="pk-meter-badge">
                      <strong>{vitals.heartRate ?? "—"}</strong>
                      <span>/{vitals.spo2 ?? "—"}</span>
                    </div>
                  </div>
                  <div className="pk-meter-caption">{sensorStatus}</div>
                </div>
              </div>

              <div className="pk-right-row-2">
                <div className="pk-card pk-matrix-card">
                  <div className="pk-card-top">
                    <div className="pk-mini-icon">°{tempUnit}</div>
                    <div>
                      <span className="pk-card-label">Body Temperature</span>
                      <div className="pk-card-big">
                        {tempDisplay != null ? `${tempDisplay}` : "—"} <small>°{tempUnit}</small>
                      </div>
                    </div>
                  </div>
                  <div className="pk-dot-matrix" aria-hidden="true">
                    {Array.from({ length: 44 }, (_, idx) => {
                      const activeDots = isLive ? Math.round((healthGaugePct / 100) * 44) : 12;
                      return (
                        <span
                          key={idx}
                          className={`pk-matrix-dot ${idx < activeDots ? "filled" : ""}`}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="pk-card pk-efficiency-card" onClick={() => setActiveTab("Reports")} role="button" tabIndex={0}>
                  <div className="pk-card-head-between">
                    <span className="pk-card-title">Heart Function Efficiency</span>
                    <span className="pk-arrow-icon">↗</span>
                  </div>
                  <div className="pk-eff-value">
                    <strong>{isLive ? `${healthGaugePct}%` : "—"}</strong>
                    <span>{isLive ? "Monitoring Active" : "Waiting for sensor"}</span>
                  </div>
                  <div className="pk-progress-track">
                    <div
                      className="pk-progress-fill"
                      style={{ width: `${isLive ? healthGaugePct : 8}%` }}
                    />
                  </div>
                  <div className="pk-progress-labels">
                    <span>0</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <div className="pk-card pk-schedule-card" onClick={() => setActiveTab("Calendar")} role="button" tabIndex={0}>
                <div className="pk-card-head-between">
                  <h3>Monitoring Schedule</h3>
                  <span className="pk-arrow-icon">↗</span>
                </div>
                <div className="pk-calendar-strip">
                  <span className="pk-cal-nav">‹</span>
                  {weekDays.map((d) => (
                    <div
                      key={`${d.day}-${d.date}`}
                      className={`pk-cal-day ${d.isToday ? "active" : ""}`}
                    >
                      <strong>{d.date}</strong>
                      <span>{d.day}</span>
                    </div>
                  ))}
                  <span className="pk-cal-nav">›</span>
                </div>
              </div>

              <div className="pk-card pk-details-card">
                <div className="pk-card-head-between">
                  <h3>Patient Details</h3>
                  <span className="pk-arrow-icon" onClick={() => setActiveTab("Settings")} role="button" tabIndex={0}>↗</span>
                </div>
                <div className="pk-details-body">
                  <div className="pk-patient-ident">
                    <div className="pk-patient-avatar">
                      {user.name ? user.name.charAt(0).toUpperCase() : "P"}
                    </div>
                    <div>
                      <strong>{user.name}</strong>
                      <span>ID: {patientId}</span>
                    </div>
                  </div>
                  <div className="pk-details-time">
                    <strong>{formattedTime}</strong>
                    <span>Checks every 3 seconds</span>
                  </div>
                  <div className="pk-details-actions">
                    <button
                      type="button"
                      className="pk-action-circle"
                      onClick={() => setShowQr(true)}
                      title="Show Patient QR"
                    >
                      QR
                    </button>
                    <button
                      type="button"
                      className="pk-action-circle outline"
                      onClick={handleLogout}
                      title="Logout"
                    >
                      ↪
                    </button>
                  </div>
                </div>
              </div>

              <div className="pk-bottom-row-3">
                <div className="pk-mini-card" onClick={() => setActiveTab("Vitals")} role="button" tabIndex={0}>
                  <div className="pk-mini-head">
                    <span className="pk-mini-badge">◷</span>
                    <span>Last Sync</span>
                  </div>
                  <strong>{formattedTime}</strong>
                  <small>Auto-refresh 3s</small>
                </div>

                <div className="pk-mini-card">
                  <div className="pk-mini-head">
                    <span className="pk-mini-badge">✓</span>
                    <span>Health Status</span>
                  </div>
                  <strong>{isLive ? "Live Sensor" : "Not assessed"}</strong>
                  <small>Measurement only</small>
                </div>

                <div className="pk-mini-card">
                  <div className="pk-mini-head">
                    <span className="pk-mini-badge">♥</span>
                    <span>Recordings</span>
                  </div>
                  <strong>{history.length} saved</strong>
                  <small>View in Vitals</small>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* =====================================
            TAB 2: VITALS (LIVE + 3-SEC HISTORY LOG)
        ===================================== */}
        {activeTab === "Vitals" && (
          <section className="pk-subpage">
            <div className="pk-subpage-header">
              <div>
                <span className="pk-eyebrow">AUTO-REFRESHING EVERY 3 SECONDS</span>
                <h2>Live & Previous Vitals Recordings</h2>
              </div>
              <span className={`pk-status-pill ${isLive ? "active" : "waiting"}`}>
                {isLive ? "● Live Sync Active" : "Waiting for Sensor"}
              </span>
            </div>

            <div className="pk-kpi-row pk-vitals-summary">
              <div className="pk-kpi-card">
                <div className="pk-kpi-head">
                  <div className="pk-kpi-icon blue">♡</div>
                  <div>
                    <div className="pk-kpi-title">Current Heart Rate</div>
                    <div className="pk-kpi-sub">Updated {formattedTime}</div>
                  </div>
                </div>
                <div className="pk-kpi-val">{vitals.heartRate ?? "—"} <small>BPM</small></div>
              </div>

              <div className="pk-kpi-card">
                <div className="pk-kpi-head">
                  <div className="pk-kpi-icon green">O₂</div>
                  <div>
                    <div className="pk-kpi-title">Current SpO2</div>
                    <div className="pk-kpi-sub">Updated {formattedTime}</div>
                  </div>
                </div>
                <div className="pk-kpi-val">{vitals.spo2 ?? "—"}<small>%</small></div>
              </div>

              <div className="pk-kpi-card">
                <div className="pk-kpi-head">
                  <div className="pk-kpi-icon coral">°{tempUnit}</div>
                  <div>
                    <div className="pk-kpi-title">Current Temperature</div>
                    <div className="pk-kpi-sub">Updated {formattedTime}</div>
                  </div>
                </div>
                <div className="pk-kpi-val">{tempDisplay ?? "—"} <small>°{tempUnit}</small></div>
              </div>
            </div>

            <div className="pk-card pk-history-card">
              <div className="pk-card-head-between">
                <h3>Previous Recordings ({history.length})</h3>
                <span className="pk-card-label">Polls every 3s · Patient {patientId}</span>
              </div>

              {history.length === 0 ? (
                <div className="pk-empty-state">
                  No sensor recordings saved yet. Connect your ESP32 to start recording vitals.
                </div>
              ) : (
                <div className="pk-table-wrap">
                  <table className="pk-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Heart Rate</th>
                        <th>SpO2</th>
                        <th>Temperature</th>
                        <th>ECG Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item, idx) => {
                        const dt = new Date(item.measuredAt || item.createdAt);
                        const itemTemp = formatTemp(item.temperature);
                        return (
                          <tr key={item._id || idx}>
                            <td>{dt.toLocaleDateString()}</td>
                            <td className="pk-mono">{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                            <td><strong>{item.heartRate != null ? `${item.heartRate} BPM` : "—"}</strong></td>
                            <td><strong>{item.spo2 != null ? `${item.spo2}%` : "—"}</strong></td>
                            <td><strong>{itemTemp != null ? `${itemTemp} °${tempUnit}` : "—"}</strong></td>
                            <td>
                              <span className={`pk-lead-badge ${item.leadsOff === false ? "ok" : "off"}`}>
                                {item.leadsOff === false ? "Attached" : item.leadsOff === true ? "Leads Off" : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* =====================================
            TAB 3: REPORTS
        ===================================== */}
        {activeTab === "Reports" && (
          <section className="pk-subpage">
            <div className="pk-subpage-header">
              <div>
                <span className="pk-eyebrow">SENSOR ANALYTICS & EXPORT</span>
                <h2>Patient Health Reports</h2>
              </div>
              <div className="pk-report-actions">
                <button type="button" className="pk-btn-primary" onClick={handleExportCsv} disabled={!history.length}>
                  Download CSV
                </button>
                <button type="button" className="pk-btn-secondary" onClick={() => window.print()}>
                  Print Report
                </button>
              </div>
            </div>

            <div className="pk-kpi-row">
              <div className="pk-card">
                <span className="pk-card-label">Heart Rate Summary (BPM)</span>
                <div className="pk-stat-grid">
                  <div><small>Min</small><strong>{hrStats.min}</strong></div>
                  <div><small>Avg</small><strong>{hrStats.avg}</strong></div>
                  <div><small>Max</small><strong>{hrStats.max}</strong></div>
                </div>
              </div>

              <div className="pk-card">
                <span className="pk-card-label">Blood Oxygen Summary (SpO2 %)</span>
                <div className="pk-stat-grid">
                  <div><small>Min</small><strong>{spo2Stats.min}</strong></div>
                  <div><small>Avg</small><strong>{spo2Stats.avg}</strong></div>
                  <div><small>Max</small><strong>{spo2Stats.max}</strong></div>
                </div>
              </div>

              <div className="pk-card">
                <span className="pk-card-label">Temperature Summary (°{tempUnit})</span>
                <div className="pk-stat-grid">
                  <div><small>Min</small><strong>{tempStats.min}</strong></div>
                  <div><small>Avg</small><strong>{tempStats.avg}</strong></div>
                  <div><small>Max</small><strong>{tempStats.max}</strong></div>
                </div>
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head-between">
                <h3>Live ECG Trace Snapshot</h3>
                <span className="pk-card-label">100 Hz AD8232 Signal</span>
              </div>
              <div className="pk-ecg-embed pk-ecg-tall">
                <EcgWaveform patientId={patientId} />
              </div>
            </div>
          </section>
        )}

        {/* =====================================
            TAB 4: CALENDAR
        ===================================== */}
        {activeTab === "Calendar" && (
          <section className="pk-subpage">
            <div className="pk-subpage-header">
              <div>
                <span className="pk-eyebrow">MONITORING LOGS BY DATE</span>
                <h2>Monitoring Calendar</h2>
              </div>
              <div className="pk-report-actions">
                <button
                  type="button"
                  className="pk-btn-secondary"
                  onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                >
                  ‹ Prev
                </button>
                <span className="pk-month-label">
                  {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </span>
                <button
                  type="button"
                  className="pk-btn-secondary"
                  onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                >
                  Next ›
                </button>
              </div>
            </div>

            <div className="pk-calendar-layout">
              <div className="pk-card">
                <div className="pk-cal-weekdays">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
                    <span key={wd}>{wd}</span>
                  ))}
                </div>
                <div className="pk-cal-grid">
                  {Array.from({ length: firstDayOfMonth }, (_, i) => (
                    <div key={`empty-${i}`} className="pk-cal-cell empty" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dayNum = i + 1;
                    const cellDate = new Date(year, month, dayNum).toDateString();
                    const isSelected = cellDate === selectedDay;
                    const hasData = recordedDates.has(cellDate);
                    const isTodayCell = cellDate === today.toDateString();
                    return (
                      <button
                        key={dayNum}
                        type="button"
                        className={`pk-cal-cell ${isSelected ? "selected" : ""} ${isTodayCell ? "today" : ""}`}
                        onClick={() => setSelectedDay(cellDate)}
                      >
                        <span>{dayNum}</span>
                        {hasData && <i className="pk-cal-dot" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pk-card">
                <div className="pk-card-head-between">
                  <h3>Recordings on {selectedDay}</h3>
                  <span className="pk-card-label">{selectedDayRecordings.length} entries</span>
                </div>
                {selectedDayRecordings.length === 0 ? (
                  <div className="pk-empty-state">No recordings found on this date.</div>
                ) : (
                  <div className="pk-day-list">
                    {selectedDayRecordings.slice(0, 12).map((item, idx) => {
                      const dt = new Date(item.measuredAt || item.createdAt);
                      const itemTemp = formatTemp(item.temperature);
                      return (
                        <div key={item._id || idx} className="pk-day-item">
                          <span className="pk-mono">
                            {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                          <span>HR: <strong>{item.heartRate ?? "—"}</strong></span>
                          <span>SpO2: <strong>{item.spo2 != null ? `${item.spo2}%` : "—"}</strong></span>
                          <span>Temp: <strong>{itemTemp != null ? `${itemTemp}°${tempUnit}` : "—"}</strong></span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* =====================================
            TAB 5: SETTINGS
        ===================================== */}
        {activeTab === "Settings" && (
          <section className="pk-subpage">
            <div className="pk-subpage-header">
              <div>
                <span className="pk-eyebrow">PREFERENCES & ACCOUNT</span>
                <h2>PatientK Settings</h2>
              </div>
            </div>

            <div className="pk-right-row-2">
              <div className="pk-card pk-settings-card">
                <h3>Patient Profile</h3>
                <div className="pk-setting-row">
                  <span>Full Name</span>
                  <strong>{user.name}</strong>
                </div>
                <div className="pk-setting-row">
                  <span>Email</span>
                  <strong>{user.email}</strong>
                </div>
                <div className="pk-setting-row">
                  <span>Patient ID</span>
                  <strong>{patientId}</strong>
                </div>
                <div className="pk-setting-row">
                  <span>Hardware Status</span>
                  <strong>{sensorStatus}</strong>
                </div>
                <div className="pk-settings-btns">
                  <button type="button" className="pk-btn-primary" onClick={() => setShowQr(true)}>
                    Show Monitoring QR Code
                  </button>
                  <button type="button" className="pk-btn-secondary" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              </div>

              <div className="pk-card pk-settings-card">
                <h3>Display Preferences</h3>
                <div className="pk-setting-row">
                  <span>Temperature Unit</span>
                  <div className="pk-unit-toggle">
                    <button
                      type="button"
                      className={tempUnit === "F" ? "active" : ""}
                      onClick={() => handleTempUnitChange("F")}
                    >
                      Fahrenheit (°F)
                    </button>
                    <button
                      type="button"
                      className={tempUnit === "C" ? "active" : ""}
                      onClick={() => handleTempUnitChange("C")}
                    >
                      Celsius (°C)
                    </button>
                  </div>
                </div>
                <div className="pk-setting-row">
                  <span>Live Sync Interval</span>
                  <strong>Every 3 seconds</strong>
                </div>
                <div className="pk-setting-row">
                  <span>Hardware Notice</span>
                  <small>ESP32 sensor readings only. Measurement only; not a medical diagnosis.</small>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {showQr && (
        <div className="qr-modal-backdrop" role="presentation" onClick={() => setShowQr(false)}>
          <section
            className="qr-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="qr-modal-close"
              type="button"
              aria-label="Close QR code"
              onClick={() => setShowQr(false)}
            >
              ×
            </button>
            <p>SHARE MONITORING</p>
            <h2 id="qr-modal-title">Your Patient QR</h2>
            <QRCodeCanvas
              value={`${window.location.origin}/monitor/${encodeURIComponent(patientId)}`}
              size={220}
              bgColor="#ffffff"
              fgColor="#111827"
              level="H"
              includeMargin
            />
            <strong>{patientId}</strong>
            <span>Doctor or family members scan this code, then log in to view monitoring.</span>
          </section>
        </div>
      )}
    </div>
  );
}

export default PatientDashboard;
