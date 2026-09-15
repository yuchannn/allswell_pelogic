"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { advance, createScenario, requestRescan, updateDetection, type ScenarioMeta } from "@/lib/sim/engine";
import type { Detection, SimState } from "@/lib/types";

const TICK_MS = 500;
/** Largest single integration step (sim seconds); bigger wall-clock gaps are sub-stepped. */
const MAX_STEP_S = 20;

export interface SimulationHandle {
  state: SimState;
  speed: number;
  setSpeed: (s: number) => void;
  confirmDetection: (id: string) => void;
  dismissDetection: (id: string) => void;
  resetDetection: (id: string) => void;
  requestRescan: (id: string) => void;
}

interface Store {
  state: SimState;
  meta: ScenarioMeta;
}

/**
 * Runs the scenario in the browser (the caller is loaded with `ssr: false`, so the
 * lazy initialiser never runs on the server). Until the real data link exists, this
 * hook is the single seam where the live telemetry + detection feed will be plugged in.
 */
export function useSimulation(seed: number): SimulationHandle {
  const [store, setStore] = useState<Store>(() => createScenario(seed, Date.now()));
  const [speed, setSpeed] = useState(1);
  const lastWallRef = useRef<number>(0);

  useEffect(() => {
    lastWallRef.current = performance.now();
    const id = setInterval(() => {
      const wall = performance.now();
      const elapsedS = Math.min((wall - lastWallRef.current) / 1000, 120);
      lastWallRef.current = wall;
      const total = elapsedS * speed;
      setStore((prev) => {
        let next = prev.state;
        let dt = total;
        while (dt > 0) {
          const step = Math.min(dt, MAX_STEP_S);
          next = advance(next, step, prev.meta);
          dt -= step;
        }
        return { ...prev, state: next };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [speed]);

  const patch = useCallback((id: string, p: Partial<Detection>) => {
    setStore((prev) => ({ ...prev, state: updateDetection(prev.state, id, p) }));
  }, []);

  return {
    state: store.state,
    speed,
    setSpeed,
    confirmDetection: useCallback((id: string) => patch(id, { status: "confirmed" }), [patch]),
    dismissDetection: useCallback((id: string) => patch(id, { status: "dismissed" }), [patch]),
    resetDetection: useCallback((id: string) => patch(id, { status: "new" }), [patch]),
    requestRescan: useCallback(
      (id: string) => setStore((prev) => ({ ...prev, state: requestRescan(prev.state, id) })),
      [],
    ),
  };
}
