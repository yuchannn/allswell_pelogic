"use client";

import dynamic from "next/dynamic";
import { DeltaMark } from "./Logo";

/**
 * The console is client-only by nature: its clock is the browser's wall clock, it
 * measures its container with ResizeObserver and paints snapshots on <canvas>.
 * Skipping SSR avoids a hydration mismatch and lets state initialise lazily.
 */
const Console = dynamic(() => import("./Console").then((m) => m.Console), {
  ssr: false,
  loading: () => <Connecting />,
});

export function ConsoleLoader() {
  return <Console />;
}

function Connecting() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg">
      <DeltaMark className="h-10 w-10 opacity-80" />
      <div className="readout text-[12px] tracking-wider text-muted">正在連線至船舶資料匯流排… · Connecting to vessel data bus…</div>
    </div>
  );
}
