"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AGE } from "@/lib/age";
import { advance, createScenario, requestRescan, updateDetection, type ScenarioMeta } from "@/lib/sim/engine";
import type { Detection, DetectionKind, SimState } from "@/lib/types";

const TICK_MS = 500;
/** Largest single integration step (sim seconds); bigger wall-clock gaps are sub-stepped. */
const MAX_STEP_S = 20;
/** Alert history kept for the log */
const MAX_ALERTS = 40;

/** One operator alert per detection, raised the tick the photo arrives. */
export interface Alert {
  /** One alert per detection, so the detection id doubles as the alert id */
  id: string;
  droneId: string;
  kind: DetectionKind;
  confidence: number;
  /** Simulation clock of the photo */
  capturedAt: number;
  /** Wall clock (ms) when the console raised it — drives toast expiry and "who won" against operator picks */
  raisedAt: number;
  acked: boolean;
}

export interface SimulationHandle {
  state: SimState;
  /** Newest first */
  alerts: Alert[];
  speed: number;
  setSpeed: (s: number) => void;
  confirmDetection: (id: string) => void;
  dismissDetection: (id: string) => void;
  resetDetection: (id: string) => void;
  requestRescan: (id: string) => void;
  ackAlert: (id: string) => void;
  ackAllAlerts: () => void;
}

interface Store {
  state: SimState;
  meta: ScenarioMeta;
  alerts: Alert[];
}

function toAlert(d: Detection, raisedAt: number): Alert {
  return { id: d.id, droneId: d.droneId, kind: d.kind, confidence: d.confidence, capturedAt: d.capturedAt, raisedAt, acked: false };
}

function ackIn(alerts: Alert[], id: string): Alert[] {
  return alerts.some((a) => a.id === id && !a.acked) ? alerts.map((a) => (a.id === id ? { ...a, acked: true } : a)) : alerts;
}

/**
 * Runs the scenario in the browser (the caller is loaded with `ssr: false`, so the
 * lazy initialiser never runs on the server). Until the real data link exists, this
 * hook is the single seam where the live telemetry + detection feed will be plugged in.
 *
 * Alerts are raised here, in the same update that appends the detection, so the
 * feed wall and the alert stack can never disagree about what is new. On load the
 * replayed history is swallowed silently — only photos still inside the NEW-tag
 * window alert, so the screen opens with the fresh school flagged, not a backlog.
 */
export function useSimulation(seed: number): SimulationHandle {
  const [store, setStore] = useState<Store>(() => {
    const { state, meta } = createScenario(seed, Date.now());
    const wall = Date.now();
    const alerts = state.detections
      .filter((d) => state.now - d.capturedAt < AGE.newTagMs)
      .map((d) => toAlert(d, wall))
      .sort((a, b) => b.capturedAt - a.capturedAt);
    return { state, meta, alerts };
  });
  const [speed, setSpeed] = useState(1);
  const lastWallRef = useRef<number>(0);

  useEffect(() => {
    lastWallRef.current = performance.now();
    const id = setInterval(() => {
      const wall = performance.now();
      const elapsedS = Math.min((wall - lastWallRef.current) / 1000, 120);
      lastWallRef.current = wall;
      const total = elapsedS * speed;
      const raisedAt = Date.now();
      setStore((prev) => {
        let next = prev.state;
        let dt = total;
        while (dt > 0) {
          const step = Math.min(dt, MAX_STEP_S);
          next = advance(next, step, prev.meta);
          dt -= step;
        }
        // Anything the engine appended this tick is a new alert (ids are never reused).
        const known = new Set(prev.state.detections.map((d) => d.id));
        const fresh = next.detections
          .filter((d) => !known.has(d.id))
          .map((d) => toAlert(d, raisedAt))
          .sort((a, b) => b.capturedAt - a.capturedAt);
        const alerts = fresh.length ? [...fresh, ...prev.alerts].slice(0, MAX_ALERTS) : prev.alerts;
        return { ...prev, state: next, alerts };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [speed]);

  // Acting on a detection (confirm / dismiss) acknowledges its alert implicitly.
  const patch = useCallback((id: string, p: Partial<Detection>) => {
    setStore((prev) => ({
      ...prev,
      state: updateDetection(prev.state, id, p),
      alerts: p.status && p.status !== "new" ? ackIn(prev.alerts, id) : prev.alerts,
    }));
  }, []);

  return {
    state: store.state,
    alerts: store.alerts,
    speed,
    setSpeed,
    confirmDetection: useCallback((id: string) => patch(id, { status: "confirmed" }), [patch]),
    dismissDetection: useCallback((id: string) => patch(id, { status: "dismissed" }), [patch]),
    resetDetection: useCallback((id: string) => patch(id, { status: "new" }), [patch]),
    requestRescan: useCallback(
      (id: string) => setStore((prev) => ({ ...prev, state: requestRescan(prev.state, id) })),
      [],
    ),
    ackAlert: useCallback((id: string) => setStore((prev) => ({ ...prev, alerts: ackIn(prev.alerts, id) })), []),
    ackAllAlerts: useCallback(
      () =>
        setStore((prev) =>
          prev.alerts.some((a) => !a.acked) ? { ...prev, alerts: prev.alerts.map((a) => (a.acked ? a : { ...a, acked: true })) } : prev,
        ),
      [],
    ),
  };
}
