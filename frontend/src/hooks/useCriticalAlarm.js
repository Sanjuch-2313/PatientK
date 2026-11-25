/**
 * useCriticalAlarm.js
 * ───────────────────
 * Shared hook used by PatientDashboard, CareWorkspace (Doctor/Nurse),
 * and FamilyDashboard.
 *
 * On first mount it asks the browser for Notification permission.
 * When vitals become critical it:
 *   1. Plays a repeating beep through the Web Audio API (no file needed)
 *   2. Shows a browser Notification with the specific reading that triggered
 *   3. Stops automatically when vitals return to normal
 *
 * Usage:
 *   const { isCritical, criticalReasons } = useCriticalAlarm(vitals);
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ── Thresholds (mirror the ESP32 firmware values) ────────────────────────────
const THRESHOLDS = {
  HR_HIGH:    140,   // BPM
  HR_LOW:     40,    // BPM
  SPO2_LOW:   90,    // %
  TEMP_HIGH:  39.5,  // °C
  TEMP_LOW:   35.0,  // °C
};

// ── Web Audio buzzer generator ──────────────────────────────────────────────
// A square wave gives a sharper, hardware-buzzer-like alarm than a soft sine tone.
function createBuzzerPulse(ctx, freq = 1250, duration = 0.14, volume = 0.38) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.008);
  gain.gain.setValueAtTime(volume, ctx.currentTime + Math.max(0.01, duration - 0.025));
  gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playBuzzer(ctx) {
  createBuzzerPulse(ctx, 1250, 0.13, 0.36);
  window.setTimeout(() => createBuzzerPulse(ctx, 900, 0.13, 0.3), 180);
}

// ── Evaluate vitals against thresholds ──────────────────────────────────────
function evaluate(vitals) {
  if (!vitals) return { critical: false, reasons: [] };
  const reasons = [];
  const hr   = vitals.heartRate ?? vitals.bpm ?? null;
  const spo2 = vitals.spo2     ?? vitals.oxygenLevel ?? null;
  const temp = vitals.temperature ?? null;      // always °C from backend

  if (hr   !== null && hr   > THRESHOLDS.HR_HIGH)   reasons.push(`⚠️ Heart rate HIGH: ${hr} BPM`);
  if (hr   !== null && hr   < THRESHOLDS.HR_LOW)    reasons.push(`⚠️ Heart rate LOW: ${hr} BPM`);
  if (spo2 !== null && spo2 < THRESHOLDS.SPO2_LOW)  reasons.push(`⚠️ SpO₂ LOW: ${spo2}%`);
  if (temp !== null && temp > THRESHOLDS.TEMP_HIGH)  reasons.push(`🌡️ Temperature HIGH: ${(temp * 1.8 + 32).toFixed(1)}°F`);
  if (temp !== null && temp < THRESHOLDS.TEMP_LOW)   reasons.push(`🌡️ Temperature LOW: ${(temp * 1.8 + 32).toFixed(1)}°F`);

  return { critical: reasons.length > 0, reasons };
}

// ── Main hook ────────────────────────────────────────────────────────────────
export function useCriticalAlarm(vitals) {
  const audioCtxRef    = useRef(null);
  const beepIntervalRef = useRef(null);
  const notifCooldown  = useRef(0);
  const [isCritical, setIsCritical]       = useState(false);
  const [criticalReasons, setCriticalReasons] = useState([]);
  // Keep the strip visible until this page load receives a user gesture. A
  // notification permission may already be granted while mobile audio is still locked.
  const [permissionState, setPermissionState] = useState("default");

  // Read the existing state on mount. Permission requests themselves must happen
  // from a user gesture on mobile browsers, so the banner button handles the request.
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "denied") setPermissionState("denied");
  }, []);

  // Lazy-create AudioContext on first user gesture (browser policy)
  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (autoplay policy)
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const startAlarm = useCallback((reasons) => {
    if (beepIntervalRef.current) return;   // already running
    const ctx = ensureAudioCtx();

    // Immediately fire the first buzzer pulse.
    playBuzzer(ctx);

    // Then repeat every 1.5 seconds
    beepIntervalRef.current = setInterval(() => {
      const c = ensureAudioCtx();
      playBuzzer(c);
    }, 1500);

    // Browser notification (throttled to once per 30 s)
    const now = Date.now();
    if ("Notification" in window && now - notifCooldown.current > 30000 && Notification.permission === "granted") {
      notifCooldown.current = now;
      try {
        new Notification("🚨 PatientK — Critical Alert", {
          body: reasons.join("\n"),
          icon: "/favicon.ico",
          tag:  "patientk-critical",   // replaces previous, no spam
          requireInteraction: true,     // stays until user dismisses
        });
      } catch (_) {}
    }
  }, [ensureAudioCtx]);

  const requestAlarmPermissions = useCallback(async () => {
    try {
      const ctx = ensureAudioCtx();
      if (ctx.state === "suspended") await ctx.resume();
      // Audible confirmation proves the mobile browser accepted the gesture.
      playBuzzer(ctx);
    } catch (_) {
      // Keep the banner usable even when a browser has no Web Audio support.
    }

    if ("Notification" in window && Notification.permission !== "granted") {
      try {
        const result = await Notification.requestPermission();
        setPermissionState(result);
        return result;
      } catch (_) {
        setPermissionState("denied");
        return "denied";
      }
    }

    setPermissionState("granted");
    return "granted";
  }, [ensureAudioCtx]);

  const stopAlarm = useCallback(() => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  }, []);

  // Watch vitals changes
  useEffect(() => {
    const { critical, reasons } = evaluate(vitals);
    setIsCritical(critical);
    setCriticalReasons(reasons);

    if (critical) {
      startAlarm(reasons);
    } else {
      stopAlarm();
    }
  }, [
    // Stringify only the values that matter to avoid stale closures
    vitals?.heartRate,
    vitals?.bpm,
    vitals?.spo2,
    vitals?.oxygenLevel,
    vitals?.temperature,
    startAlarm,
    stopAlarm,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAlarm();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [stopAlarm]);

  return { isCritical, criticalReasons, permissionState, requestAlarmPermissions };
}
