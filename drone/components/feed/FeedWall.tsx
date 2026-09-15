"use client";

import { useMemo } from "react";
import type { Layout } from "@/components/console/FiltersPanel";
import type { AlertsHandle } from "@/hooks/useAlerts";
import type { Detection, SimState } from "@/lib/types";
import { AlertLog } from "./AlertLog";
import { AlertStack } from "./AlertStack";
import { DroneTile } from "./DroneTile";

interface Props {
  state: SimState;
  /** Detections that pass the operator's filters */
  detections: Detection[];
  layout: Layout;
  /** Drone shown large (focus) / outlined (grid). Always resolved by the console. */
  focusedId: string;
  selectedId: string | null;
  alerts: AlertsHandle;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  onExpand: (id: string) => void;
  onViewAlert: (id: string) => void;
}

/**
 * The centre stage: the fleet's camera frames instead of a plan display. Every
 * drone gets a tile with its latest capture; new detections float in as alerts.
 */
export function FeedWall({ state, detections, layout, focusedId, selectedId, alerts, onSelect, onFocus, onExpand, onViewAlert }: Props) {
  const { drones } = state;

  // Captures per aircraft, newest first
  const byDrone = useMemo(() => {
    const m = new Map<string, Detection[]>();
    for (const d of drones) m.set(d.id, []);
    for (const det of detections) m.get(det.droneId)?.push(det);
    for (const list of m.values()) list.sort((a, b) => b.capturedAt - a.capturedAt);
    return m;
  }, [drones, detections]);

  // A tile is "alerting" when the frame it shows still has an unacknowledged alert
  const alertingIds = useMemo(() => new Set(alerts.log.filter((a) => !a.acked).map((a) => a.id)), [alerts.log]);

  const tile = (id: string, size: "large" | "medium" | "small") => {
    const idx = drones.findIndex((d) => d.id === id);
    const drone = drones[idx];
    const captures = byDrone.get(id) ?? [];
    const latest = captures[0];
    return (
      <DroneTile
        key={id}
        drone={drone}
        index={idx + 1}
        state={state}
        captures={captures}
        selectedId={selectedId}
        focused={id === focusedId}
        alerting={!!latest && alertingIds.has(latest.id)}
        size={size}
        // the large frame takes whatever height the strip leaves
        className={size === "large" ? "flex-1" : ""}
        onSelect={onSelect}
        onFocus={() => onFocus(id)}
        onExpand={onExpand}
      />
    );
  };

  const logProps = {
    log: alerts.log,
    unacked: alerts.unacked,
    state,
    selectedId,
    onSelect,
    onAck: alerts.ack,
    onAckAll: alerts.ackAll,
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      {layout === "grid" ? (
        <div
          className="grid h-full w-full grid-cols-2 gap-2 p-2"
          style={{ gridTemplateRows: `repeat(${Math.ceil((drones.length + 1) / 2)}, minmax(0, 1fr))` }}
        >
          {drones.map((d) => tile(d.id, "medium"))}
          <AlertLog {...logProps} />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col gap-2 p-2">
          {tile(focusedId, "large")}
          <div className="grid h-[172px] shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${drones.length}, minmax(0, 1fr))` }}>
            {drones.filter((d) => d.id !== focusedId).map((d) => tile(d.id, "small"))}
            <AlertLog {...logProps} compact />
          </div>
        </div>
      )}

      <AlertStack toasts={alerts.toasts} unacked={alerts.unacked} state={state} onView={onViewAlert} onAck={alerts.ack} onAckAll={alerts.ackAll} />
    </div>
  );
}
