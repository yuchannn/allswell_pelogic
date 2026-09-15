"use client";

import { useEffect, useMemo, useState } from "react";
import type { Alert } from "./useSimulation";

export type { Alert } from "./useSimulation";

export const ALERT = {
  /** Wall-clock lifetime of a toast before it survives only in the log */
  toastMs: 45_000,
  maxToasts: 4,
} as const;

export interface AlertsHandle {
  /** Alerts that pass the operator's filters, newest first */
  log: Alert[];
  /** Unacknowledged + young enough to still float over the feed wall */
  toasts: Alert[];
  unacked: number;
  /** The alert raised most recently (drives "jump to drone" in focus layout) */
  latest: Alert | null;
  ack: (id: string) => void;
  ackAll: () => void;
}

/** Coarse wall clock so time-based UI (toast expiry) re-renders without touching the sim. */
function useWallClock(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Operator's view of the alert log kept by `useSimulation`: applies the kind /
 * confidence filters and decides which alerts are still floating as toasts.
 */
export function useAlerts(all: Alert[], accept: (a: Alert) => boolean, ack: (id: string) => void, ackAll: () => void): AlertsHandle {
  const wallNow = useWallClock(1000);
  const log = useMemo(() => all.filter(accept), [all, accept]);
  const toasts = useMemo(
    () => log.filter((a) => !a.acked && wallNow - a.raisedAt < ALERT.toastMs).slice(0, ALERT.maxToasts),
    [log, wallNow],
  );
  const unacked = useMemo(() => log.reduce((n, a) => n + (a.acked ? 0 : 1), 0), [log]);
  return useMemo(() => ({ log, toasts, unacked, latest: log[0] ?? null, ack, ackAll }), [log, toasts, unacked, ack, ackAll]);
}
