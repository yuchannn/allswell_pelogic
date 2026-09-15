"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeedWall } from "@/components/feed/FeedWall";
import { SnapshotViewer } from "@/components/snapshot/SnapshotViewer";
import { useAlerts, type Alert } from "@/hooks/useAlerts";
import { useSimulation } from "@/hooks/useSimulation";
import { AGE } from "@/lib/age";
import type { Locale } from "@/lib/format";
import { rangeBearing } from "@/lib/geo";
import { DetailPanel } from "./DetailPanel";
import { DEFAULT_VIEW, FiltersPanel, type ViewSettings } from "./FiltersPanel";
import { FleetPanel } from "./FleetPanel";
import { Header } from "./Header";
import { LocaleContext, makeLocaleCtx, useLocale } from "./LocaleContext";
import { StatusBar } from "./StatusBar";
import { TargetList, type ListRow, type SortKey } from "./TargetList";
import { VesselCard } from "./VesselCard";

/** Fixed seed → the same opening scene every load (and the same scene as the plan-display console). */
const SCENARIO_SEED = 0x57696e46; // "WinF"

export function Console() {
  const sim = useSimulation(SCENARIO_SEED);
  const [locale, setLocale] = useState<Locale>("zh-TW");
  const [view, setView] = useState<ViewSettings>(DEFAULT_VIEW);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** Operator's explicit choice of drone for the big frame, stamped so a later school alert can outrank it */
  const [pick, setPick] = useState<{ id: string; at: number } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const localeCtx = useMemo(() => makeLocaleCtx(locale), [locale]);
  const state = sim.state;

  const patchView = useCallback((p: Partial<ViewSettings>) => setView((v) => ({ ...v, ...p })), []);

  const filtered = useMemo(() => {
    const maxAge = view.maxAgeMin * 60_000;
    return state.detections.filter(
      (d) =>
        view.kinds[d.kind] &&
        state.now - d.capturedAt <= maxAge &&
        d.confidence >= view.minConfidence &&
        (view.showDismissed || d.status !== "dismissed"),
    );
  }, [state, view]);

  // Alerts follow the operator's kind / confidence filters; age and dismissal are moot for a brand-new photo.
  const acceptAlert = useCallback((a: Alert) => view.kinds[a.kind] && a.confidence >= view.minConfidence, [view.kinds, view.minConfidence]);
  const alerts = useAlerts(sim.alerts, acceptAlert, sim.ackAlert, sim.ackAllAlerts);

  const rows = useMemo<ListRow[]>(() => {
    const list = filtered.map((det) => {
      const rb = rangeBearing(state.vessel.position, det.position);
      return { det, rangeNm: rb.rangeNm, bearingDeg: rb.bearingDeg, ageMs: state.now - det.capturedAt, inRange: rb.rangeNm <= view.rangeNm };
    });
    const cmp: Record<SortKey, (a: ListRow, b: ListRow) => number> = {
      newest: (a, b) => a.ageMs - b.ageMs,
      nearest: (a, b) => a.rangeNm - b.rangeNm,
      largest: (a, b) => b.det.radiusM - a.det.radiusM || b.det.birdCount - a.det.birdCount,
      confidence: (a, b) => b.det.confidence - a.det.confidence,
    };
    return list.sort(cmp[sort]);
  }, [filtered, state, sort, view.rangeNm]);

  // Derived: if the selected detection ages out of the feed, the panel simply closes.
  const selected = useMemo(() => state.detections.find((d) => d.id === selectedId) ?? null, [state, selectedId]);

  // Which drone owns the big frame: whichever happened last — the operator's pick or, with
  // auto-focus on, a school alert — else the first aircraft in the air.
  const latestSchool = view.autoFocus ? alerts.log.find((a) => a.kind === "school") : undefined;
  const focusedId =
    (latestSchool && (!pick || latestSchool.raisedAt > pick.at) ? latestSchool.droneId : null) ??
    (pick && state.drones.some((d) => d.id === pick.id) ? pick.id : null) ??
    state.drones.find((d) => d.status === "airborne")?.id ??
    state.drones.find((d) => d.status !== "deck")?.id ??
    state.drones[0].id;
  const focusDrone = useCallback((id: string) => setPick({ id, at: Date.now() }), []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!rows.length) return;
      const i = rows.findIndex((r) => r.det.id === selectedId);
      const next = i < 0 ? (dir > 0 ? 0 : rows.length - 1) : (i + dir + rows.length) % rows.length;
      setSelectedId(rows[next].det.id);
    },
    [rows, selectedId],
  );

  const viewAlert = useCallback(
    (id: string) => {
      const det = state.detections.find((d) => d.id === id);
      setSelectedId(id);
      if (det) focusDrone(det.droneId);
      alerts.ack(id);
    },
    [state.detections, alerts, focusDrone],
  );

  const expand = useCallback((id: string) => {
    setSelectedId(id);
    setViewerOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        // Esc peels back one layer: viewer first, then the selection
        if (viewerOpen) setViewerOpen(false);
        else setSelectedId(null);
      } else if (e.key === "ArrowDown" || e.key === "j" || (viewerOpen && e.key === "ArrowRight")) {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp" || e.key === "k" || (viewerOpen && e.key === "ArrowLeft")) {
        e.preventDefault();
        step(-1);
      } else if (e.key === "f" || e.key === "F") {
        if (selectedId) setViewerOpen((v) => !v);
      } else if (!viewerOpen && /^[1-9]$/.test(e.key)) {
        const d = state.drones[Number(e.key) - 1];
        if (d) focusDrone(d.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, viewerOpen, selectedId, state.drones, focusDrone]);

  const schoolsInRange = rows.filter((r) => r.det.kind === "school" && r.inRange && r.det.status !== "dismissed").length;
  const fresh = state.detections.filter(
    (d) => d.kind === "school" && d.status !== "dismissed" && state.now - d.capturedAt < AGE.freshMs,
  ).length;
  const airborne = state.drones.filter((d) => d.status === "airborne" || d.status === "returning");
  const link = airborne.length ? Math.min(...airborne.map((d) => d.link)) : 1;
  const shipTz = Math.round(state.vessel.position.lon / 15);

  return (
    <LocaleContext.Provider value={localeCtx}>
      <div className="flex h-full flex-col bg-bg text-text">
        <Header now={state.now} shipTzOffset={shipTz} freshCount={fresh} onLocale={setLocale} />

        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_408px]">
          <aside className="min-h-0 overflow-y-auto border-r border-line bg-panel">
            <VesselCard vessel={state.vessel} env={state.env} />
            <FleetPanel state={state} focusedId={focusedId} onFocus={focusDrone} />
            <FiltersPanel view={view} onChange={patchView} />
          </aside>

          <main className="relative min-h-0 min-w-0">
            <FeedWall
              state={state}
              detections={filtered}
              layout={view.layout}
              focusedId={focusedId}
              selectedId={selectedId}
              alerts={alerts}
              onSelect={setSelectedId}
              onFocus={focusDrone}
              onExpand={expand}
              onViewAlert={viewAlert}
            />
          </main>

          <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-line bg-panel">
            {selected ? (
              <DetailPanel
                det={selected}
                state={state}
                onConfirm={sim.confirmDetection}
                onDismiss={sim.dismissDetection}
                onReset={sim.resetDetection}
                onRescan={sim.requestRescan}
                onClose={() => setSelectedId(null)}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                onExpand={() => setViewerOpen(true)}
              />
            ) : (
              <SelectHint />
            )}
            <TargetList
              rows={rows}
              sort={sort}
              onSort={setSort}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              inRangeCount={rows.filter((r) => r.inRange).length}
            />
          </aside>
        </div>

        <StatusBar
          now={state.now}
          schools={schoolsInRange}
          fresh={fresh}
          linkQuality={link}
          alerts={alerts.unacked}
          speed={sim.speed}
          onSpeed={sim.setSpeed}
        />

        {viewerOpen && selected && (
          <SnapshotViewer
            det={selected}
            state={state}
            onClose={() => setViewerOpen(false)}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onConfirm={sim.confirmDetection}
            onDismiss={sim.dismissDetection}
            onReset={sim.resetDetection}
            onRescan={sim.requestRescan}
          />
        )}
      </div>
    </LocaleContext.Provider>
  );
}

function SelectHint() {
  const { t } = useLocale();
  return (
    <div className="border-b border-line p-4">
      <div className="flex items-start gap-3 rounded-md border border-dashed border-line-2 bg-panel-2 p-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-target/40 bg-target/10">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-target" />
        </div>
        <div>
          <div className="text-[12.5px] font-semibold text-text">{t("snapshot")}</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{t("selectHint")}</p>
          <p className="mt-1 text-[10.5px] text-dim">{t("feedHint")}</p>
        </div>
      </div>
    </div>
  );
}
