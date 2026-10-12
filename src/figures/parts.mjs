// Shared bench parts for every S31 figure: base plates, rulers, label plates,
// knobs and screws, all from the Anatomy kit's recipes (references/craft.md §3).
import * as k from "../../vendor/anatomy/kit/iso-kit.mjs";

export { k };

export function bench(P) {
  const at = (point) => k.iso(point, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
  const byDepth = (points) => [...points].sort((a, b) => depth(a[0], a[1], a[2] ?? 0) - depth(b[0], b[1], b[2] ?? 0));

  // Base plate on four feet with a groove, corner screws and a halo.
  function plate(plan, { h = 12, foot = 5, inset = 22, groove = 5, screws = 10, bevel = 1.6 } = {}) {
    const out = [`<path class="iso-halo" d="${k.haloOf(plan, -h - foot, h, P)}"/>`];
    for (const [x, y] of byDepth(k.corners(plan, inset))) {
      out.push(S(k.cylinder(x, y, 7, -h - foot, 1.6, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 5.4, -h - foot + 1.6, foot - 1.6, P, 28), { tone: "mid" }));
    }
    out.push(S(k.slabOf(plan, -h, h, P, 8, bevel), { tone: "mid" }));
    if (groove) out.push(L(k.planOutline(k.insetPlan(plan, groove), 0, P), { tone: "lo" }));
    if (screws) {
      const pts = k.corners(plan, screws);
      out.push(L(pts.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
      out.push(D(pts.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
    }
    return out.join("");
  }

  // A thin ruler strip with ticks rooted on its far edge (along x).
  function ruler(strip, { z = 0, step = 4, every = 5 } = {}) {
    const out = [S(k.slabOf(strip, z, 0.6, P, 3), { tone: "lo", crease: "none" })];
    const t = k.topTicks(strip.x + 4, strip.x + strip.w - 4, step, every, strip.y + 0.8, z + 0.6, [2, 3.6], P);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    out.push(D([at([strip.x + 2, strip.y + strip.d / 2, z + 0.6]), at([strip.x + strip.w - 2, strip.y + strip.d / 2, z + 0.6])], { size: 0.45 }));
    return out.join("");
  }

  // A label plate: a thin slab, an inset outline, three rule lines for printed text.
  function labelPlate(plan, { z = 0, rules = [0.8, 0.55, 0.65] } = {}) {
    const out = [S(k.slabOf(plan, z, 0.8, P, 4), { tone: "lo" })];
    out.push(L(k.planOutline(k.insetPlan(plan, 1.6), z + 0.8, P), { tone: "faint" }));
    const x0 = plan.x + 4, span = plan.w - 8;
    rules.forEach((share, i) => {
      const y = plan.y + 4 + i * ((plan.d - 8) / Math.max(1, rules.length - 1));
      out.push(L(k.lineOnTop([x0, y], [x0 + span * share, y], z + 0.8, P), { tone: "lo", free: true }));
    });
    return out.join("");
  }

  // A knurled knob standing on a face, with a pointer line on top.
  function knob(cx, cy, r, z, h, { angle = 0, tone = "mid" } = {}) {
    const out = [S(k.cylinder(cx, cy, r + 1.2, z, 1.2, P, 32), { tone: "lo" })];
    out.push(S(k.cylinder(cx, cy, r, z + 1.2, h, P, 32), { tone }));
    out.push(L(k.knurl(cx, cy, r, z + 1.2, z + 1.2 + h, Math.round(r * 6), P), { tone: "lo" }));
    const a = angle;
    out.push(L(k.lineOnTop([cx - Math.cos(a) * r * 0.45, cy - Math.sin(a) * r * 0.45], [cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8], z + 1.2 + h, P), { tone: "hi", free: true }));
    out.push(D([at([cx, cy, z + 1.2 + h])], { size: 0.5, tone: "hi" }));
    return out.join("");
  }

  // A round pilot lamp: bezel, lens. `part` names the lens for live code.
  function lamp(cx, cy, z, { r = 3, part } = {}) {
    const out = [S(k.cylinder(cx, cy, r + 1.2, z, 1.4, P, 28), { tone: "mid" })];
    const lens = S(k.cylinder(cx, cy, r, z + 1.4, 1.2, P, 24), { tone: "hi", crease: "lo" });
    out.push(part ? `<g data-part="${part}">${lens}</g>` : lens);
    return out.join("");
  }

  const screwDots = (points, z, size = 0.45) => D(points.map(([x, y]) => at([x, y, z])), { size });

  return { at, S, L, D, depth, byDepth, plate, ruler, labelPlate, knob, lamp, screwDots };
}

// The live helpers every figure's page code uses (inlined as source).
export const LIVE_HELPERS = `
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const follow = (cur, target, dt, seconds, calm) => (calm ? target : cur + (target - cur) * (1 - Math.exp(-dt / seconds)));
const stillQuery = matchMedia("(prefers-reduced-motion: reduce)");
function loop(root, tick) {
  let frame = 0, last = 0, visible = false;
  const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(step); } };
  function step(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    const keep = tick(dt, stillQuery.matches);
    frame = visible && keep !== false ? requestAnimationFrame(step) : 0;
  }
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(root);
  return run;
}
`;
