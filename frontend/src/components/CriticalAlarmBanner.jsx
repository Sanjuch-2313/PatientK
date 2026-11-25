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
import "./CriticalAlarmBanner.css";

export default function CriticalAlarmBanner({
  isCritical,
  criticalReasons,
  permissionState,
  onAllow,
}) {
  return (
    <>
      {/* ── Permission strip (shown until user decides) ── */}
      {permissionState === "default" && (
        <div className="cab-permission-strip">
          <span className="cab-perm-icon">🔔</span>
          <span className="cab-perm-text">
            PatientK needs permission to play <strong>alert sounds</strong> and
            show <strong>notifications</strong> when vitals are critical.
          </span>
          <button className="cab-perm-allow" onClick={onAllow}>
            Allow Sound &amp; Notifications
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
