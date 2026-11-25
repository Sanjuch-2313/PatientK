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

// ── Web Audio beep generator ─────────────────────────────────────────────────
function createBeep(ctx, freq = 880, duration = 0.18, volume = 0.6) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
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
  const [permissionState, setPermissionState] = useState("default");

  // Ask for notification permission once on mount
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setPermissionState("granted");
      return;
    }
    if (Notification.permission !== "denied") {
      Notification.requestPermission().then(result => {
        setPermissionState(result);
      });
    } else {
      setPermissionState("denied");
    }
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

    // Immediately fire first beep
    createBeep(ctx, 880, 0.18, 0.7);
    setTimeout(() => createBeep(ctx, 660, 0.14, 0.5), 220);

    // Then repeat every 1.5 seconds
    beepIntervalRef.current = setInterval(() => {
      const c = ensureAudioCtx();
      createBeep(c, 880, 0.18, 0.7);
      setTimeout(() => createBeep(c, 660, 0.14, 0.5), 220);
    }, 1500);

    // Browser notification (throttled to once per 30 s)
    const now = Date.now();
    if (now - notifCooldown.current > 30000 && Notification.permission === "granted") {
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

  return { isCritical, criticalReasons, permissionState };
}
