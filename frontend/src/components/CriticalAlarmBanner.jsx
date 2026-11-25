/**
 * CriticalAlarmBanner.jsx
 * ───────────────────────
 * Shows:
 *   • A one-time "Allow sound & notifications" request strip (if not yet granted)
 *   • A flashing red critical alert banner when vitals are outside safe range
 *
 * Drop this inside any dashboard — it is self-contained.
 * Props:
 *   isCritical      boolean
 *   criticalReasons string[]
 *   permissionState "default" | "granted" | "denied"
 *   onAllow         () => void  — called when user clicks Allow
 */
import { useState } from "react";
import "./CriticalAlarmBanner.css";

export default function CriticalAlarmBanner({
  isCritical,
  criticalReasons,
  permissionState,
  onAllow,
}) {
  const [feedback, setFeedback] = useState("");

  const handleAllow = async () => {
    setFeedback("Enabling buzzer...");
    await onAllow();
    setFeedback("Buzzer enabled for this session");
    window.setTimeout(() => setFeedback(""), 2400);
  };

  return (
    <>
      {/* ── Permission strip (shown until user decides) ── */}
      {(permissionState !== "granted" || feedback) && (
        <div className={`cab-permission-strip ${permissionState === "denied" ? "denied" : ""}`}>
          <span className="cab-perm-icon">🔔</span>
          <span className="cab-perm-text">
            {feedback || (permissionState === "denied"
              ? "Notifications are blocked. Enable them in your browser site settings; the buzzer can still be tested here."
              : <>PatientK needs permission to play <strong>buzzer alerts</strong> and show <strong>notifications</strong> when vitals are critical.</>)}
          </span>
          <button className="cab-perm-allow" onClick={handleAllow} disabled={Boolean(feedback)}>
            {permissionState === "denied" ? "Try again" : "Enable Buzzer & Notifications"}
          </button>
        </div>
      )}

      {/* ── Critical alert banner ── */}
      {isCritical && (
        <div className="cab-critical-banner" role="alert" aria-live="assertive">
          <div className="cab-critical-icon">🚨</div>
          <div className="cab-critical-body">
            <strong className="cab-critical-title">CRITICAL VITALS DETECTED</strong>
            <ul className="cab-critical-list">
              {criticalReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
          <div className="cab-critical-pulse" aria-hidden="true" />
        </div>
      )}
    </>
  );
}
