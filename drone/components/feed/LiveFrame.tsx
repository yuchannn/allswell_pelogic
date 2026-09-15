"use client";

import { useEffect, useRef, useState } from "react";
import { useElementSize } from "@/hooks/useElementSize";
import { drawLiveFrame, drawNoSignal } from "@/components/snapshot/drawSnapshot";
import { hashSeed } from "@/lib/sim/rng";
import type { Drone, Environment } from "@/lib/types";

/** Wall-clock cadence at which a new "frame" arrives from the aircraft */
const FRAME_MS = 3000;

interface Props {
  drone: Drone;
  env: Environment;
  now: number;
  /** `live` = camera on, searching; `nosignal` = camera off (on deck) */
  mode: "live" | "nosignal";
  /** HUD line under the timestamp, e.g. SEARCHING / CLIMBING / RETURNING */
  statusLine: string;
  className?: string;
}

/**
 * 16:9 stand-in for the drone's video downlink when there is no capture to show.
 * Width-driven like SnapshotCanvas so the tile can size it by setting the wrapper width.
 */
export function LiveFrame({ drone, env, now, mode, statusLine, className = "" }: Props) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameNo, setFrameNo] = useState(0);
  const height = Math.round((width * 9) / 16);

  useEffect(() => {
    const id = setInterval(() => setFrameNo((n) => n + 1), FRAME_MS);
    return () => clearInterval(id);
  }, []);

  // Per-aircraft frame counter offset so the two feeds never show the same FRM number.
  const frameBase = hashSeed(drone.id) % 900_000;
  // Round telemetry so the HUD repaints on meaningful change, not on every 0.1 m of altitude.
  const altKey = Math.round(drone.altitudeM);
  const hdgKey = Math.round(drone.headingDeg);
  const latKey = drone.position.lat.toFixed(4);
  const lonKey = drone.position.lon.toFixed(4);
  const timeKey = Math.floor(now / 1000);
  const sstKey = env.sstC.toFixed(1);
  const windKey = Math.round(env.windKts);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 40) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (mode === "nosignal") {
      drawNoSignal(canvas, { seed: drone.id, frameNo, width, height, dpr });
      return;
    }
    drawLiveFrame(canvas, {
      drone: { ...drone, altitudeM: altKey, headingDeg: hdgKey, position: { lat: Number(latKey), lon: Number(lonKey) } },
      env: { ...env, sstC: Number(sstKey), windKts: windKey },
      now: timeKey * 1000,
      frameNo: frameBase + frameNo,
      statusLine,
      width,
      height,
      dpr,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, drone.id, drone.callsign, frameNo, frameBase, width, height, statusLine, altKey, hdgKey, latKey, lonKey, timeKey, sstKey, windKey]);

  return (
    <div ref={ref} className={`relative w-full overflow-hidden rounded-md bg-black ${className}`} style={{ aspectRatio: "16 / 9" }}>
      <canvas ref={canvasRef} style={{ width, height }} className="block" aria-label={`${drone.callsign} ${mode === "live" ? "live feed" : "no signal"}`} />
    </div>
  );
}
