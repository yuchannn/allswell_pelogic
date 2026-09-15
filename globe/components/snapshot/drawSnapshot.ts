/**
 * Procedural rendering of a drone EO camera frame for a detection.
 *
 * Until real frames are streamed from the aircraft, this synthesises a plausible
 * nadir shot of the sea surface from the detection's own metadata — school radius,
 * surface sign, working birds, altitude — and overlays the same camera HUD +
 * detector bounding box the production frame viewer will draw over real imagery.
 * When `det.snapshot.imageUrl` is set, the photo is drawn and only the HUD is synthetic.
 */
import { Rng, hashSeed } from "@/lib/sim/rng";
import { SPECIES } from "@/lib/species";
import { formatDateUTC, formatLat, formatLon, formatTimeUTC } from "@/lib/format";
import type { Detection, Environment } from "@/lib/types";

export interface DrawOptions {
  det: Detection;
  droneCallsign: string;
  env: Environment;
  /** CSS pixel size of the canvas */
  width: number;
  height: number;
  dpr: number;
  image?: HTMLImageElement | null;
  locale: "zh-TW" | "en";
}

const TAU = Math.PI * 2;

/** Feature scale: 1 at side-panel width (~400 px), ~4 when shown full-screen. */
function featureScale(W: number): number {
  return Math.max(0.6, W / 400);
}

function drawOcean(ctx: CanvasRenderingContext2D, rng: Rng, W: number, H: number, env: Environment) {
  const s = featureScale(W);
  // base water
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
  g.addColorStop(0, "#0f4a80");
  g.addColorStop(0.5, "#0c3a6a");
  g.addColorStop(1, "#092c55");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // broad swell bands — wavelength scales with the frame so the count stays constant
  const swellDir = ((env.windDirDeg + rng.range(-25, 25)) * Math.PI) / 180;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(swellDir);
  const span = Math.hypot(W, H);
  const wavelength = rng.range(70, 120) * s;
  for (let d = -span / 2; d < span / 2; d += wavelength) {
    const lg = ctx.createLinearGradient(0, d, 0, d + wavelength);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.45, "rgba(180,220,255,0.05)");
    lg.addColorStop(0.6, "rgba(0,10,40,0.07)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(-span / 2, d, span, wavelength);
  }
  ctx.restore();

  // wind-driven capillary texture — fine detail grows with √scale so it stays a texture
  const f = Math.sqrt(s);
  const windDir = (env.windDirDeg * Math.PI) / 180 + Math.PI / 2;
  const n = Math.round((W * H) / (220 * f));
  for (let i = 0; i < n; i++) {
    const x = rng.next() * W;
    const y = rng.next() * H;
    const len = rng.range(3, 14) * f;
    const a = windDir + rng.gauss(0, 0.25);
    const light = rng.chance(0.55);
    ctx.strokeStyle = light ? `rgba(190,225,255,${rng.range(0.04, 0.14)})` : `rgba(3,18,45,${rng.range(0.05, 0.16)})`;
    ctx.lineWidth = rng.range(0.6, 1.4) * Math.sqrt(f);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }

  // sun glint field
  const gx = W * rng.range(0.15, 0.85);
  const gy = H * rng.range(0.1, 0.9);
  const gr = rng.range(0.25, 0.5) * W;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  glow.addColorStop(0, "rgba(160,215,255,0.16)");
  glow.addColorStop(1, "rgba(160,215,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const sparkles = Math.round(gr * 6);
  for (let i = 0; i < sparkles; i++) {
    const r = Math.abs(rng.gauss(0, gr * 0.42));
    const a = rng.next() * TAU;
    const x = gx + Math.cos(a) * r;
    const y = gy + Math.sin(a) * r * 0.7;
    const sz = rng.range(0.6, 1.8) * Math.sqrt(s);
    ctx.fillStyle = `rgba(230,245,255,${rng.range(0.25, 0.85)})`;
    ctx.fillRect(x, y, sz, sz * 0.7);
  }

  // cloud shadows
  if (rng.chance(env.cloud + 0.2)) {
    const count = rng.int(1, 2);
    for (let i = 0; i < count; i++) {
      const x = W * rng.next();
      const y = H * rng.next();
      const r = rng.range(0.3, 0.7) * W;
      const sh = ctx.createRadialGradient(x, y, 0, x, y, r);
      sh.addColorStop(0, "rgba(2,10,30,0.28)");
      sh.addColorStop(0.7, "rgba(2,10,30,0.12)");
      sh.addColorStop(1, "rgba(2,10,30,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function ellipsePoint(rng: Rng, cx: number, cy: number, a: number, b: number, theta: number, spread = 1) {
  const t = rng.next() * TAU;
  const rr = Math.sqrt(rng.next()) * spread;
  const ex = Math.cos(t) * a * rr;
  const ey = Math.sin(t) * b * rr;
  return { x: cx + ex * Math.cos(theta) - ey * Math.sin(theta), y: cy + ex * Math.sin(theta) + ey * Math.cos(theta) };
}

function drawSchool(ctx: CanvasRenderingContext2D, rng: Rng, box: Box, det: Detection, W: number) {
  // fine features (glints, foam, splashes) grow with √scale; counts scale with area/s²
  const s = Math.sqrt(featureScale(W));
  const s2 = s * s;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const a = (box.w / 2) * 0.86;
  const b = (box.h / 2) * 0.86;
  const theta = rng.range(-0.4, 0.4);
  const area = Math.PI * a * b;

  // dark sub-surface mass: many soft overlapping discs, ragged edge
  const density = det.activity === "shadow" ? 1.35 : 1;
  const n = Math.round((area / 55) * density) + 60;
  for (let i = 0; i < n; i++) {
    const p = ellipsePoint(rng, cx, cy, a, b, theta, 1.08);
    const r = rng.range(3, Math.max(5, Math.min(a, b) * 0.28));
    ctx.fillStyle = `rgba(4,14,34,${rng.range(0.08, 0.2)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  }
  // core
  for (let i = 0; i < n / 3; i++) {
    const p = ellipsePoint(rng, cx, cy, a * 0.6, b * 0.6, theta);
    const r = rng.range(3, Math.max(4, Math.min(a, b) * 0.22));
    ctx.fillStyle = `rgba(6,10,28,${rng.range(0.12, 0.26)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  }
  // individual fish glints near the surface
  const fish = Math.round(area / (90 * s2));
  for (let i = 0; i < fish; i++) {
    const p = ellipsePoint(rng, cx, cy, a * 0.9, b * 0.9, theta);
    ctx.strokeStyle = `rgba(150,190,230,${rng.range(0.15, 0.45)})`;
    ctx.lineWidth = 0.8 * Math.sqrt(s);
    const ang = theta + rng.gauss(0, 0.5);
    const l = rng.range(1.5, 3.5) * s;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(ang) * l, p.y + Math.sin(ang) * l);
    ctx.stroke();
  }

  switch (det.activity) {
    case "breezer": {
      // fine ripple over the mass
      const k = Math.round(area / (40 * s2));
      for (let i = 0; i < k; i++) {
        const p = ellipsePoint(rng, cx, cy, a, b, theta);
        ctx.strokeStyle = `rgba(200,230,255,${rng.range(0.08, 0.22)})`;
        ctx.lineWidth = 0.8 * Math.sqrt(s);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rng.range(2, 6) * s, rng.next() * TAU, rng.range(0.6, 1.6));
        ctx.stroke();
      }
      break;
    }
    case "boiler": {
      const k = Math.round(area / (26 * s2));
      for (let i = 0; i < k; i++) {
        const p = ellipsePoint(rng, cx, cy, a * 0.85, b * 0.85, theta);
        ctx.fillStyle = `rgba(225,242,255,${rng.range(0.18, 0.55)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rng.range(0.8, 2.2) * s, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < k / 4; i++) {
        const p = ellipsePoint(rng, cx, cy, a * 0.8, b * 0.8, theta);
        ctx.strokeStyle = `rgba(235,248,255,${rng.range(0.2, 0.5)})`;
        ctx.lineWidth = 1 * Math.sqrt(s);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rng.range(3, 9) * s, rng.next() * TAU, rng.range(1, 3));
        ctx.stroke();
      }
      break;
    }
    case "foamer": {
      // heavy white water, biased to one (downwind) end
      const bias = rng.chance(0.5) ? 1 : -1;
      const k = Math.round(area / (16 * s2));
      for (let i = 0; i < k; i++) {
        const p = ellipsePoint(rng, cx + bias * a * 0.25 * Math.cos(theta), cy + bias * a * 0.25 * Math.sin(theta), a * 0.75, b * 0.8, theta);
        const r = rng.range(1, 4) * s;
        ctx.fillStyle = `rgba(240,250,255,${rng.range(0.2, 0.7)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "jumper": {
      const k = Math.max(4, Math.round(area / (900 * s2)));
      for (let i = 0; i < k; i++) {
        const p = ellipsePoint(rng, cx, cy, a, b, theta);
        // splash: white burst + tiny dark body
        for (let j = 0; j < 7; j++) {
          const ang = rng.next() * TAU;
          const l = rng.range(2, 7) * s;
          ctx.strokeStyle = `rgba(240,250,255,${rng.range(0.45, 0.9)})`;
          ctx.lineWidth = rng.range(0.8, 1.6) * Math.sqrt(s);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(ang) * l, p.y + Math.sin(ang) * l);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(10,20,40,0.9)";
        ctx.beginPath();
        ctx.ellipse(p.x + 2 * s, p.y - 2 * s, 2.6 * s, 1 * s, rng.next() * Math.PI, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "shadow":
    default:
      break;
  }
}

function drawBird(ctx: CanvasRenderingContext2D, rng: Rng, x: number, y: number, span: number) {
  const white = rng.chance(0.6);
  ctx.strokeStyle = white ? "rgba(245,250,255,0.95)" : "rgba(20,28,40,0.95)";
  ctx.lineWidth = Math.max(0.9, span * 0.22);
  ctx.lineCap = "round";
  const dir = rng.next() * TAU;
  const flap = rng.range(0.25, 0.8);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  ctx.beginPath();
  ctx.moveTo(-span / 2, flap * span * 0.5);
  ctx.quadraticCurveTo(-span / 5, -flap * span * 0.2, 0, 0);
  ctx.quadraticCurveTo(span / 5, -flap * span * 0.2, span / 2, flap * span * 0.5);
  ctx.stroke();
  ctx.restore();
  // shadow on water
  ctx.fillStyle = "rgba(0,8,25,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + span * 0.6, y + span * 0.7, span * 0.35, span * 0.12, dir, 0, TAU);
  ctx.fill();
}

function drawBirds(ctx: CanvasRenderingContext2D, rng: Rng, box: Box, count: number, dense: boolean, W: number) {
  // birds are tiny at 400 m; grow only gently with the frame so they stay bird-sized
  const s = Math.sqrt(featureScale(W));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const a = (box.w / 2) * (dense ? 0.95 : 1.6);
  const b = (box.h / 2) * (dense ? 0.95 : 1.6);
  const n = Math.min(count, dense ? 140 : 60);
  for (let i = 0; i < n; i++) {
    const p = ellipsePoint(rng, cx, cy, a, b, 0, 1.15);
    drawBird(ctx, rng, p.x, p.y, rng.range(4, 8) * s);
  }
  if (dense) {
    // diving birds → white plunge splashes
    for (let i = 0; i < n / 6; i++) {
      const p = ellipsePoint(rng, cx, cy, a * 0.7, b * 0.7, 0);
      ctx.fillStyle = `rgba(240,250,255,${rng.range(0.5, 0.9)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rng.range(1.5, 3.5) * s, 0, TAU);
      ctx.fill();
    }
  }
}

function drawFloating(ctx: CanvasRenderingContext2D, rng: Rng, box: Box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const L = box.w * 0.7;
  const T = Math.max(4, box.h * 0.16);
  const ang = rng.range(-0.6, 0.6);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // log
  ctx.fillStyle = "rgba(60,40,22,0.95)";
  ctx.beginPath();
  ctx.roundRect(-L / 2, -T / 2, L, T, T / 2);
  ctx.fill();
  ctx.fillStyle = "rgba(120,88,52,0.6)";
  ctx.beginPath();
  ctx.roundRect(-L / 2, -T / 2, L, T * 0.4, T / 2);
  ctx.fill();
  // foam line on the up-current side
  ctx.strokeStyle = "rgba(230,245,255,0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-L / 2, T * 0.8);
  ctx.lineTo(L / 2, T * 0.9);
  ctx.stroke();
  ctx.restore();
  // aggregated fish shadows underneath
  const k = rng.int(12, 40);
  for (let i = 0; i < k; i++) {
    const p = ellipsePoint(rng, cx, cy, L * 0.7, box.h * 0.5, ang, 1.2);
    ctx.fillStyle = `rgba(4,12,30,${rng.range(0.2, 0.45)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rng.range(1.5, 3), rng.range(0.6, 1.2), rng.next() * Math.PI, 0, TAU);
    ctx.fill();
  }
  // occasional radio buoy
  if (rng.chance(0.5)) {
    ctx.fillStyle = "rgba(255,120,40,0.95)";
    ctx.beginPath();
    ctx.arc(cx + L * 0.45 * Math.cos(ang), cy + L * 0.45 * Math.sin(ang), 2.2, 0, TAU);
    ctx.fill();
  }
}

function drawGrain(ctx: CanvasRenderingContext2D, rng: Rng, W: number, H: number) {
  const n = Math.round((W * H) / 260);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rng.chance(0.5) ? `rgba(255,255,255,${rng.range(0.02, 0.07)})` : `rgba(0,0,0,${rng.range(0.03, 0.09)})`;
    ctx.fillRect(rng.next() * W, rng.next() * H, 1, 1);
  }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function hudText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { align?: CanvasTextAlign; color?: string; size?: number; weight?: number } = {},
) {
  const size = opts.size ?? 10.5;
  ctx.font = `${opts.weight ?? 500} ${size}px ui-monospace, Menlo, "SF Mono", monospace`;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.lineWidth = Math.max(3, size * 0.3);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = opts.color ?? "rgba(235,245,255,0.92)";
  ctx.fillText(text, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, o: DrawOptions, W: number, H: number, box: Box) {
  const { det } = o;
  const hud = "rgba(235,245,255,0.85)";
  // Everything in the HUD scales with the frame: ~10 px type in the side panel,
  // ~16 px when the capture is shown full-screen.
  const fs = Math.max(9.5, Math.min(16, W / 72));
  const k = fs / 10.5;
  const lineH = fs * 1.25;
  ctx.lineWidth = 1.2 * k;
  ctx.strokeStyle = hud;

  // corner brackets
  const m = 10 * k;
  const L = 18 * k;
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const x = sx > 0 ? m : W - m;
    const y = sy > 0 ? m : H - m;
    ctx.beginPath();
    ctx.moveTo(x, y + sy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * L, y);
    ctx.stroke();
  }
  // centre reticle
  ctx.strokeStyle = "rgba(235,245,255,0.55)";
  ctx.beginPath();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.moveTo(W / 2 + dx * 6 * k, H / 2 + dy * 6 * k);
    ctx.lineTo(W / 2 + dx * 16 * k, H / 2 + dy * 16 * k);
  }
  ctx.stroke();

  // detector bounding box
  const isSchool = det.kind === "school";
  const boxColor = isSchool ? "#ff4d4d" : det.kind === "birds" ? "#ffb020" : "#e7f1fb";
  ctx.save();
  ctx.strokeStyle = boxColor;
  ctx.lineWidth = 1.5 * k;
  ctx.setLineDash([6 * k, 4 * k]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.restore();
  // bracket accents
  ctx.strokeStyle = boxColor;
  ctx.lineWidth = 2.2 * k;
  const bl = Math.min(12 * k, box.w / 4);
  for (const [sx, sy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    const x = sx > 0 ? box.x : box.x + box.w;
    const y = sy > 0 ? box.y : box.y + box.h;
    ctx.beginPath();
    ctx.moveTo(x, y + sy * bl);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * bl, y);
    ctx.stroke();
  }
  // label tab
  const code = isSchool ? SPECIES[det.species].code : det.kind === "birds" ? "BIRDS" : "FAD/LOG";
  const label = `${code} ${det.confidence.toFixed(2)}`;
  ctx.font = `700 ${fs}px ui-monospace, Menlo, monospace`;
  const tabH = fs * 1.35;
  const tw = ctx.measureText(label).width + fs;
  const above = box.y - tabH - 2 * k >= lineH * 2 + m;
  const ty = above ? box.y - tabH - 2 * k : box.y + box.h + 2 * k;
  ctx.fillStyle = boxColor;
  ctx.fillRect(box.x, ty, tw, tabH);
  ctx.fillStyle = "#04070d";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, box.x + fs / 2, ty + tabH / 2);
  if (isSchool) {
    const size = `r≈${det.radiusM}m  ~${det.estTonnes}t`;
    const sizeW = ctx.measureText(size).width;
    // small boxes: drop the size readout on the opposite edge instead of colliding with the label tab
    const fits = box.w - tw - fs >= sizeW;
    const sy = fits ? ty + tabH / 2 : above ? box.y + box.h + tabH / 2 + 2 * k : box.y - tabH / 2 - 2 * k;
    hudText(ctx, size, box.x + box.w, sy, { align: "right", color: boxColor, weight: 700, size: fs });
  }

  const dim = "rgba(200,220,240,0.7)";
  const x0 = 34 * k;
  const y1 = 16 * k;
  const y2 = y1 + lineH;
  const yb2 = H - 16 * k;
  const yb1 = yb2 - lineH;
  // top-left: aircraft + camera
  hudText(ctx, `${o.droneCallsign}  EO  1.0×`, x0, y1, { weight: 700, size: fs });
  hudText(ctx, `FRM ${det.id.slice(1).padStart(6, "0")}`, x0, y2, { color: dim, size: fs });
  // top-right: time
  hudText(ctx, `${formatDateUTC(det.capturedAt)} ${formatTimeUTC(det.capturedAt)}`, W - x0, y1, { align: "right", weight: 700, size: fs });
  hudText(ctx, det.rescanOf ? `RE-SIGHT ${det.rescanOf}` : "AUTO-CAPTURE", W - x0, y2, { align: "right", color: dim, size: fs });
  // bottom-left: position, then camera state
  hudText(ctx, `${formatLat(det.position.lat, 2)} ${formatLon(det.position.lon, 2)}`, x0, yb1, { size: fs });
  hudText(ctx, `ALT ${det.snapshot.altitudeM}m  HDG ${det.snapshot.cameraHeadingDeg.toString().padStart(3, "0")}°`, x0, yb2, {
    color: dim,
    size: fs,
  });
  // bottom-right: classifier, then sea state
  const clsName = isSchool ? SPECIES[det.species].en.toUpperCase() : det.kind === "birds" ? "WORKING BIRDS" : "FLOATING OBJECT";
  hudText(ctx, `AI ${clsName} ${Math.round(det.confidence * 100)}%`, W - x0, yb1, { align: "right", color: boxColor, weight: 700, size: fs });
  hudText(ctx, `SST ${o.env.sstC.toFixed(1)}°C  WND ${Math.round(o.env.windKts)}kn`, W - x0, yb2, { align: "right", color: dim, size: fs });

  // scale bar — 50 m, centred between the two text columns
  const pxPerM = W / (o.det.snapshot.width * o.det.snapshot.gsdM);
  const barPx = 50 * pxPerM;
  const bx = W / 2 - barPx / 2;
  const by = (yb1 + yb2) / 2;
  ctx.strokeStyle = hud;
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + barPx, by);
  ctx.moveTo(bx, by - 4 * k);
  ctx.lineTo(bx, by + 4 * k);
  ctx.moveTo(bx + barPx, by - 4 * k);
  ctx.lineTo(bx + barPx, by + 4 * k);
  ctx.stroke();
  hudText(ctx, "50 m", W / 2, by - fs * 0.9, { align: "center", size: fs * 0.9 });
}

export function drawSnapshot(canvas: HTMLCanvasElement, o: DrawOptions) {
  const { det, width: W, height: H, dpr } = o;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const rng = new Rng(hashSeed(det.id));
  const box: Box = {
    x: det.snapshot.bbox.x * W,
    y: det.snapshot.bbox.y * H,
    w: det.snapshot.bbox.w * W,
    h: det.snapshot.bbox.h * H,
  };

  if (o.image) {
    ctx.drawImage(o.image, 0, 0, W, H);
  } else {
    drawOcean(ctx, rng, W, H, o.env);
    if (det.kind === "school") {
      drawSchool(ctx, rng, box, det, W);
      if (det.birdCount > 0) drawBirds(ctx, rng, box, det.birdCount, false, W);
    } else if (det.kind === "birds") {
      drawBirds(ctx, rng, box, det.birdCount, true, W);
    } else {
      drawFloating(ctx, rng, box);
    }
    drawGrain(ctx, rng, W, H);
  }
  drawHud(ctx, o, W, H, box);
}
