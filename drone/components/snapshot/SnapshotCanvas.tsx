"use client";

import { useEffect, useRef, useState } from "react";
import { useElementSize } from "@/hooks/useElementSize";
import { useLocale } from "@/components/console/LocaleContext";
import type { Detection, Environment } from "@/lib/types";
import { drawSnapshot, type HudMode } from "./drawSnapshot";

interface Props {
  det: Detection;
  droneCallsign: string;
  env: Environment;
  className?: string;
  /** `box` = detector box only (thumbnails); default full camera HUD */
  hud?: HudMode;
}

/** 16:9 drone frame. Re-renders only when the detection or the box size changes. */
export function SnapshotCanvas({ det, droneCallsign, env, className = "", hud = "full" }: Props) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { locale } = useLocale();
  // Loaded frame, keyed by URL so a stale image is never drawn for a different detection.
  const [loaded, setLoaded] = useState<{ url: string; img: HTMLImageElement } | null>(null);

  const url = det.snapshot.imageUrl;
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setLoaded({ url, img });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  const image = url && loaded?.url === url ? loaded.img : null;

  const height = Math.round((width * 9) / 16);
  // Environment only feeds HUD text; snapshot the values so a drifting SST doesn't repaint every tick.
  const sstKey = env.sstC.toFixed(1);
  const windKey = Math.round(env.windKts);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 40) return;
    drawSnapshot(canvas, {
      det,
      droneCallsign,
      env: { ...env, sstC: Number(sstKey), windKts: windKey },
      width,
      height,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      image,
      locale,
      hud,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [det.id, det.status, droneCallsign, width, height, image, locale, sstKey, windKey, hud]);

  return (
    <div ref={ref} className={`relative w-full overflow-hidden rounded-md bg-black ${className}`} style={{ aspectRatio: "16 / 9" }}>
      <canvas ref={canvasRef} style={{ width, height }} className="block" aria-label={`Drone snapshot ${det.id}`} />
    </div>
  );
}
