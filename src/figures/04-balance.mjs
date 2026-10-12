// Fig 4 · LogUp wire consistency: an assay balance.
// Every wire address has its own token. Writes (m tokens per address) sit on the
// left pan, reads on the right. The beam is a picture of the LogUp field sum:
// honest wiring pairs every token off and the sum is exactly 0, so the beam
// rests level. Forging one read leaves two unpaired tuples, the sum is a
// nonzero M31 element, and the beam tips. The sum is computed here, in M31,
// with an illustrative fixed challenge (real Stwo draws QM31 challenges after
// the trace commitment).
import { k, bench, LIVE_HELPERS } from "./parts.mjs";
import MODEL, { add, sub, mul, inv, pow } from "../model/s31.mjs";

const WIDTH = 600;
const HEIGHT = 380;

// ------------------------------------------------------------- the sum
// Tuples are (GATE, address, lane0..lane3). H(t) = t0 + α·t1 + … + α⁵·t5 − z
// (the sign convention of the S31 AIR guide).
const GATE = 0x47415445; // "GATE": an illustrative relation tag
const ALPHA = pow(7, 1 << 20); // illustrative fixed M31 challenge α = 7^(2^20)
const ZED = pow(11, 1 << 20); // illustrative fixed M31 challenge z = 11^(2^20)
const H = (address, lanes) => {
  let acc = GATE, a = ALPHA;
  for (const v of [address, ...lanes]) {
    acc = add(acc, mul(a, v));
    a = mul(a, ALPHA);
  }
  return sub(acc, ZED);
};
const wires = MODEL.poly.wires;
const wireAt = (address) => wires.find((w) => w.address === address);
// Gate terms from the model, plus the input/constant producers and the public
// output binding, so the honest relation closes exactly.
const TERMS = [
  ...MODEL.poly.logup,
  ...wires.filter((w) => w.kind !== "gate").map((w) => ({ sign: -w.mult, address: w.address, lanes: w.lanes, by: w.name, role: `produce (${w.kind})` })),
  ...(() => {
    const out = wires.find((w) => w.name === MODEL.poly.gates.at(-1).out);
    return [{ sign: +1, address: out.address, lanes: out.lanes, by: "public output", role: "use (binding)" }];
  })(),
];
const sumOf = (terms) =>
  terms.reduce((s, t) => {
    const f = inv(H(t.address, t.lanes));
    return t.sign > 0 ? add(s, mul(t.sign, f)) : sub(s, mul(-t.sign, f));
  }, 0);

// The forgery: x⁴ = x²·x² reads x² with one lane changed.
const SQ = MODEL.poly.gates[0]; // x² = x·x
const QUAD = MODEL.poly.gates.find((g) => g.in0 === SQ.out && g.in1 === SQ.out); // x⁴ = x²·x²
const FORGE_LANE = wireAt(SQ.address.out).lanes.findIndex((v, j, all) => v > 1 && all.indexOf(v) === j);
const HONEST_VALUE = wireAt(SQ.address.out).lanes[FORGE_LANE];
const FORGED_VALUE = add(HONEST_VALUE, 1);
const FORGED_INDEX = TERMS.findIndex((t) => t.by === QUAD.name && t.role === "use in1");
const FORGED_TERMS = TERMS.map((t, i) => (i === FORGED_INDEX ? { ...t, lanes: t.lanes.map((v, j) => (j === FORGE_LANE ? FORGED_VALUE : v)) } : t));
const SUM_HONEST = sumOf(TERMS);
const SUM_FORGED = sumOf(FORGED_TERMS);
if (SUM_HONEST !== 0) throw new Error("fig-balance: honest LogUp sum is not zero");
if (SUM_FORGED === 0) throw new Error("fig-balance: forged LogUp sum is zero");

// Per-address token counts, from the terms.
const ADDRS = [...new Set(TERMS.map((t) => t.address))].sort((a, b) => a - b);
const COUNT = Object.fromEntries(ADDRS.map((a) => [a, { reads: 0, writes: 0 }]));
for (const t of TERMS) t.sign > 0 ? (COUNT[t.address].reads += t.sign) : (COUNT[t.address].writes += -t.sign);
for (const a of ADDRS) if (COUNT[a].reads !== COUNT[a].writes) throw new Error(`fig-balance: address ${a} does not close`);
const FORGED_ADDR = TERMS[FORGED_INDEX].address;
const PRETTY = { x: "x", c3: "c3", "c−7": "c−7", result: "result" };
MODEL.poly.gates.forEach((g, i) => {
  const pretty = { 0: "x²", 1: "x⁴", 2: "x⁵", 3: "3x", 4: "x⁵+3x" }[i];
  if (pretty && !PRETTY[g.out]) PRETTY[g.out] = pretty;
});
const notchesOf = (address) => ADDRS.indexOf(address) + 1;

// -------------------------------------------------------------- world
const BASE = { x: -122, y: -36, w: 244, d: 102, r: 8 };
const PIV = 84; // knife-edge height
const L = 74; // half-beam
const BEAM_D = 1.8;
const COL_R = 4.5;
const PAN_R = 27, PAN_Z = 26, PAN_H = 2;
const PAN_TOP = PAN_Z + PAN_H;
const HOOK = [L - 1.5, 2.2]; // hanger point on the beam end (x, z above pivot)
const RING_DROP = 14;
const TOKEN_R = 3.8, TOKEN_H = 1.9, GRID = 10.5;
const TIP_R = 56; // needle tip radius from the pivot
const PLATE_R0 = 54.5, PLATE_R1 = 64, PLATE_PHI = (14 * Math.PI) / 180;
const PLATE_Y = [5.2, 6.2];
const NEEDLE_Y = [6.8, 7.6];
const THETA_F = (6 * Math.PI) / 180; // tipped rest angle
const FRAME_Y = -30, FRAME_X = 110, FRAME_TOP = 106;

// A convex profile in the x–z plane, extruded along y, turned by θ about a
// pivot (right side down for θ > 0). Shared by the build and the live code.
const PRISM_SRC = String.raw`
function prismPaths(profile, y0, y1, piv, th, P) {
  const c = Math.cos(th), s = Math.sin(th);
  let pts = profile.map(([x, z]) => [piv[0] + x * c + z * s, piv[1] - x * s + z * c]);
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  if (area < 0) pts = pts.reverse();
  const n = pts.length;
  const A = ((P.azimuth ?? 45) * Math.PI) / 180, E = ((P.elevation ?? 30) * Math.PI) / 180;
  const V = [Math.cos(A) * Math.cos(E), Math.sin(A) * Math.cos(E), Math.sin(E)];
  const LX = -Math.sin(A), LY = Math.cos(A);
  const f = (v) => (Math.round(v * 10) / 10).toString();
  const path = (list, close) => list.map(([x, y], i) => (i ? "L" : "M") + f(x) + " " + f(y)).join("") + (close ? "Z" : "");
  const back = pts.map(([x, z]) => iso([x, y0, z], P));
  const front = pts.map(([x, z]) => iso([x, y1, z], P));
  const shades = [[], [], [], []], tops = [], crease = [];
  const bucket = (hx, hy) => Math.min(3, Math.max(0, Math.floor(((hx * LX + hy * LY + 1) / 2) * 4)));
  if (V[1] > 1e-9) { shades[bucket(0, 1)].push(path(front, true)); crease.push(path(front, true)); }
  if (V[1] < -1e-9) { shades[bucket(0, -1)].push(path(back, true)); crease.push(path(back, true)); }
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
    const nx = dz / len, nz = -dx / len;
    if (nx * V[0] + nz * V[2] <= 1e-9) continue;
    const quad = path([back[i], back[(i + 1) % n], front[(i + 1) % n], front[i]], true);
    if (nz > 0.55) tops.push(quad);
    else shades[bucket(Math.sign(nx), 0)].push(quad);
    crease.push(quad);
  }
  const all = [...back, ...front].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of all) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = all.length - 1; i >= 0; i--) { const p = all[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const hull = path([...lo.slice(0, -1), ...hi.slice(0, -1)], true);
  return { fill: hull, outline: hull, crease: crease.join(""), top: tops.join(""), shades: shades.map((list) => list.join("")) };
}`;
const prismPaths = new Function("iso", `${PRISM_SRC}; return prismPaths;`)(k.iso);

// Moving profiles (relative to the knife edge).
const BEAM = [[-L, 4], [0, 1.6], [L, 4], [L, 7], [0, 9.5], [-L, 7]];
const KNIFE = [[-2.4, 2], [0, 0], [2.4, 2]];
const END = (side) => (side > 0 ? [[L - 4, 2.2], [L + 1, 2.2], [L + 1, 8.2], [L - 4, 8.2]] : [[-L - 1, 2.2], [-L + 4, 2.2], [-L + 4, 8.2], [-L - 1, 8.2]]);
const CARRIER = [[-1.6, 1.4], [1.6, 1.4], [1.6, 7], [-1.6, 7]];
const NEEDLE = [[-0.9, 5.4], [0.9, 5.4], [0.28, -TIP_R], [-0.28, -TIP_R]];
const DYN = [
  { name: "knife", profile: KNIFE, y: [-3, 3], tone: "mid" },
  { name: "beam", profile: BEAM, y: [-BEAM_D, BEAM_D], tone: "mid" },
  { name: "endL", profile: END(-1), y: [-2.6, 2.6], tone: "mid" },
  { name: "endR", profile: END(1), y: [-2.6, 2.6], tone: "mid" },
];
const DYN_FRONT = [
  { name: "carrier", profile: CARRIER, y: [BEAM_D, NEEDLE_Y[0]], tone: "mid" },
  { name: "needle", profile: NEEDLE, y: NEEDLE_Y, tone: "hi" },
];

export default function figure() {
  const P = k.fitProjection(
    [...k.boxCorners(BASE, -18, 0), [-FRAME_X, FRAME_Y, FRAME_TOP + 5], [FRAME_X, FRAME_Y, FRAME_TOP + 5], [-L - PAN_R, 0, PAN_Z - 9], [L + PAN_R, 0, PAN_Z - 9]],
    WIDTH,
    HEIGHT,
    { pad: 20, azimuth: 70, elevation: 30 },
  );
  const B = bench(P);
  const { S, L: Ln, D, at } = B;
  const solidOf = (paths, style) => S(paths, style);
  const dynSvg = (spec, theta = 0) => {
    const p = prismPaths(spec.profile, spec.y[0], spec.y[1], [0, PIV], theta, P);
    return `<g class="iso-solid" data-dyn="${spec.name}"><path class="iso-fill" d="${p.fill}"/>${p.shades.map((d, i) => `<path class="iso-shade" data-shade="${i}" d="${d}"/>`).join("")}<path class="iso-top" d="${p.top}"/><path class="iso-line iso-crease" data-tone="faint" d="${p.crease}"/><path class="iso-line iso-edge" data-tone="${spec.tone}" d="${p.outline}"/></g>`;
  };

  // ------------------------------------------------------------ base
  function base() {
    const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -18, 10, P)}"/>`];
    // Levelling feet: pad, threaded stem, knurled thumb wheel.
    for (const [x, y] of B.byDepth(k.corners(BASE, 16))) {
      out.push(S(k.cylinder(x, y, 6.4, -18, 1.4, P, 28), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 1.8, -16.6, 2, P, 14), { tone: "mid", crease: "none" }));
      out.push(S(k.cylinder(x, y, 5, -14.6, 2.6, P, 28), { tone: "mid" }));
      out.push(Ln(k.knurl(x, y, 5, -14.6, -12, 26, P), { tone: "lo" }));
      out.push(S(k.cylinder(x, y, 2.6, -12, 2, P, 16), { tone: "mid", crease: "none" }));
    }
    out.push(S(k.slabOf(BASE, -10, 10, P, 8, 1.6), { tone: "mid" }));
    out.push(Ln(k.sideSeam(BASE, -4, P, 8), { tone: "faint" }));
    out.push(Ln(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }));
    const pts = k.corners(BASE, 10);
    out.push(Ln(pts.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
    out.push(D(pts.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
    return out.join("");
  }

  // The rear frame: two posts on collars and a top rail with screws.
  function frame() {
    const out = [];
    for (const x of [-FRAME_X, FRAME_X]) {
      out.push(S(k.cylinder(x, FRAME_Y, 5.6, 0, 3, P, 28), { tone: "mid" }));
      out.push(S(k.cylinder(x, FRAME_Y, 3, 3, FRAME_TOP - 3, P, 24), { tone: "mid", crease: "none" }));
      out.push(Ln([30, 70, 110].map((z) => k.sideArc(x, FRAME_Y, 3, z, P, 18)).join(""), { tone: "faint" }));
    }
    const rail = { x: -FRAME_X - 5, y: FRAME_Y - 4, w: FRAME_X * 2 + 10, d: 8, r: 1.6 };
    out.push(S(k.slabOf(rail, FRAME_TOP, 5, P, 3, 0.6), { tone: "mid" }));
    out.push(Ln(k.planOutline(k.insetPlan(rail, 1.8), FRAME_TOP + 5, P, 3), { tone: "faint" }));
    out.push(B.screwDots([[-FRAME_X, FRAME_Y], [FRAME_X, FRAME_Y], [0, FRAME_Y]], FRAME_TOP + 5, 0.5));
    return out.join("");
  }

  // Pan rests: a pad on a post under each pan.
  function panRest(x) {
    const top = PAN_Z - 1.6 - L * Math.sin(THETA_F) - 1.6; // clears the pan at full tip
    return [
      S(k.cylinder(x, 0, 5.4, 0, 1.4, P, 28), { tone: "mid" }),
      S(k.cylinder(x, 0, 1.6, 1.4, top - 2.8, P, 16), { tone: "mid", crease: "none" }),
      Ln(k.sideArc(x, 0, 1.6, 6, P, 12), { tone: "faint" }),
      S(k.cylinder(x, 0, 5, top - 1.4, 1.4, P, 28), { tone: "mid" }),
      Ln(k.ring(x, 0, 3.2, top, P, 24), { tone: "faint" }),
    ].join("");
  }

  // ---------------------------------------------------------- column
  function column() {
    const out = [];
    out.push(S(k.cylinder(0, 0, 16, 0, 3, P, 48, 0.6), { tone: "mid" }));
    out.push(S(k.cylinder(0, 0, 11, 3, 3, P, 40, 0.5), { tone: "mid" }));
    out.push(B.screwDots([[-13.5, 0], [13.5, 0], [0, 13.5], [0, -13.5]], 3, 0.45));
    out.push(S(k.cylinder(0, 0, 6.2, 6, 4, P, 32), { tone: "mid" }));
    out.push(Ln(k.knurl(0, 0, 6.2, 6.6, 9.4, 26, P), { tone: "lo" }));
    out.push(S(k.cylinder(0, 0, COL_R, 10, PIV - 16, P, 32), { tone: "mid", crease: "none" }));
    out.push(Ln([30, 52, 74].map((z) => k.sideArc(0, 0, COL_R, z, P, 20)).join(""), { tone: "faint" }));
    // head: collar and the agate bearing block the knife rests on
    out.push(S(k.cylinder(0, 0, 7, PIV - 6, 3, P, 32, 0.4), { tone: "mid" }));
    const block = { x: -4.4, y: -4, w: 8.8, d: 8, r: 0.8 };
    out.push(S(k.slabOf(block, PIV - 3, 3, P, 2, 0.4), { tone: "mid" }));
    out.push(Ln(k.lineOnTop([-4.4, 0], [4.4, 0], PIV, P), { tone: "faint" }));
    return out.join("");
  }

  // Scale plate on a bracket, with ticks hanging from its top chord.
  function scale() {
    const out = [];
    const zMid = PIV - (PLATE_R0 + PLATE_R1) / 2;
    out.push(S(k.slabOf({ x: -2.6, y: 2, w: 5.2, d: PLATE_Y[0] - 2, r: 0.5 }, zMid - 3, 6, P, 2, 0.3), { tone: "mid" }));
    const arc = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const phi = PLATE_PHI - (2 * PLATE_PHI * i) / n;
      arc.push([PLATE_R1 * Math.sin(phi), -PLATE_R1 * Math.cos(phi)]);
    }
    const top = PLATE_R0;
    const profile = [[-top * Math.tan(PLATE_PHI), -top], ...arc.reverse(), [top * Math.tan(PLATE_PHI), -top]];
    // keep it convex: the chord ends sit on the side radii
    out.push(S(prismPaths(profile, PLATE_Y[0], PLATE_Y[1], [0, PIV], 0, P), { tone: "mid" }));
    const yF = PLATE_Y[1];
    const minor = [], major = [];
    let zero = "";
    for (let deg = -12; deg <= 12; deg += 2) {
      const phi = (deg * Math.PI) / 180;
      const t0 = top / Math.cos(phi);
      const len = deg === 0 ? 5.2 : deg % 6 === 0 ? 4 : 2.4;
      const a = [t0 * Math.sin(phi), yF, PIV - t0 * Math.cos(phi)];
      const b = [(t0 + len) * Math.sin(phi), yF, PIV - (t0 + len) * Math.cos(phi)];
      const d = k.segment(a, b, P);
      if (deg === 0) zero = d;
      else (deg % 6 === 0 ? major : minor).push(d);
    }
    out.push(Ln(minor.join(""), { tone: "lo" }), Ln(major.join(""), { tone: "mid" }), Ln(zero, { tone: "hi" }));
    out.push(D([at([0, yF, PIV - top - 5.2])], { size: 0.6, tone: "hi" }));
    out.push(D([at([-top * Math.tan(PLATE_PHI) + 2.6, yF, PIV - top - 6.4]), at([top * Math.tan(PLATE_PHI) - 2.6, yF, PIV - top - 6.4])], { size: 0.45 }));
    return out.join("");
  }

  // The boss over the knife on the beam's front face: round, so it doesn't change as the beam turns.
  function boss() {
    const ring = Array.from({ length: 40 }, (_, i) => [5.2 * Math.cos((i / 40) * 2 * Math.PI), 5.2 * Math.sin((i / 40) * 2 * Math.PI) + 4.8]);
    return [
      S(prismPaths(ring, BEAM_D, BEAM_D + 1.4, [0, PIV], 0, P), { tone: "mid" }),
      D([at([0, BEAM_D + 1.4, PIV + 4.8])], { size: 0.6, tone: "hi" }),
    ].join("");
  }

  // ------------------------------------------------------------ pans
  const ringZ = PIV + HOOK[1] - RING_DROP;
  const lugAngles = [Math.PI / 2 + 0.25, Math.PI / 2 + 0.25 + (2 * Math.PI) / 3, Math.PI / 2 + 0.25 + (4 * Math.PI) / 3];
  const V = k.towardViewer(P);
  function hookRod(side) {
    const cx = side * HOOK[0];
    return S(k.cylinder(cx, 0, 0.6, ringZ + 1.2, PIV + HOOK[1] - ringZ - 1.2, P, 12), { tone: "mid", crease: "none" });
  }
  const stackAt = (i) => [((i % 3) - 1) * GRID, (Math.floor(i / 3) - 1) * GRID];
  function token(cx, cy, z, address, { top = false, forged = false } = {}) {
    const out = [];
    const style = { tone: "hi", crease: "lo" };
    let solid = S(k.cylinder(cx, cy, TOKEN_R, z, TOKEN_H, P, 28, 0.3), style);
    if (forged) solid = solid.replace('class="iso-line iso-edge" data-tone="hi"', 'class="iso-line iso-edge" data-tone="red"');
    out.push(solid);
    out.push(Ln(k.sideArc(cx, cy, TOKEN_R, z + TOKEN_H * 0.45, P, 20), { tone: forged ? "red" : "lo" }));
    if (top) {
      const zt = z + TOKEN_H;
      const n = notchesOf(address);
      const ticks = Array.from({ length: n }, (_, j) => {
        const a = -Math.PI / 2 + (j * 2 * Math.PI) / n;
        return k.lineOnTop([cx + Math.cos(a) * 1.7, cy + Math.sin(a) * 1.7], [cx + Math.cos(a) * TOKEN_R, cy + Math.sin(a) * TOKEN_R], zt, P);
      }).join("");
      out.push(Ln(k.ring(cx, cy, 1.7, zt, P, 20), { tone: forged ? "red" : "mid" }));
      out.push(Ln(ticks, { tone: forged ? "red" : "mid" }));
      if (forged) out.push(D([at([cx, cy, zt])], { size: 0.6, tone: "hi" }));
    }
    return out.join("");
  }
  function pan(side) {
    const cx = side * HOOK[0];
    const reads = side > 0;
    const out = [];
    const lug = (a) => [cx + Math.cos(a) * (PAN_R - 1.6), Math.sin(a) * (PAN_R - 1.6)];
    const ringPt = (a) => [cx + Math.cos(a) * 1.6, Math.sin(a) * 1.6];
    const wire = (a) => k.wireSvg(at([...lug(a), PAN_TOP]), at([...ringPt(a), ringZ]), { tone: "mid", ends: "from", size: 0.8 });
    const facing = (a) => Math.cos(a) * V[0] + Math.sin(a) * V[1] > 0;
    // back wires, then the ring
    for (const a of lugAngles) if (!facing(a)) out.push(wire(a));
    out.push(S(k.cylinder(cx, 0, 2.4, ringZ, 1.2, P, 20), { tone: "mid" }));
    // pan: boss, dish, lip
    out.push(S(k.cylinder(cx, 0, 6, PAN_Z - 1.6, 1.6, P, 28), { tone: "mid" }));
    out.push(S(k.cylinder(cx, 0, PAN_R, PAN_Z, PAN_H, P, 72, 0.8), { tone: "mid" }));
    out.push(Ln(k.ring(cx, 0, PAN_R - 3.2, PAN_TOP, P, 64), { tone: "faint" }));
    // tokens, far stacks first
    const order = ADDRS.map((address, i) => ({ address, i, pos: stackAt(i) })).sort((a, b) => B.depth(cx + a.pos[0], a.pos[1]) - B.depth(cx + b.pos[0], b.pos[1]));
    for (const { address, pos } of order) {
      const n = reads ? COUNT[address].reads : COUNT[address].writes;
      const [x, y] = [cx + pos[0], pos[1]];
      for (let j = 0; j < n; j++) {
        const top = j === n - 1;
        const swap = reads && address === FORGED_ADDR && top;
        const body = token(x, y, PAN_TOP + j * TOKEN_H, address, { top });
        out.push(`<g data-token="${address}"${swap ? ' data-honest=""' : ""}>${body}</g>`);
        if (swap) out.push(`<g data-forged="" opacity="0" style="display:none"><g data-drop="">${token(x, y, PAN_TOP + j * TOKEN_H, address, { top: true, forged: true })}</g></g>`);
      }
    }
    for (const a of lugAngles) if (facing(a)) out.push(wire(a));
    return out.join("");
  }

  // ------------------------------------------------------- weight box
  const CASE = { x: -64, y: 12, w: 38, d: 24, r: 1.6 };
  const PULL = 24;
  function weightBox() {
    const out = [];
    out.push(S(k.slabOf(CASE, 0, 13, P, 3, 0.6), { tone: "mid" }));
    out.push(Ln(k.sideSeam(CASE, 10.4, P, 3), { tone: "faint" }));
    out.push(Ln(k.planOutline(k.insetPlan(CASE, 2.2), 13, P, 3), { tone: "faint" }));
    // hinge knuckles on the lid's back edge
    for (const x of [CASE.x + 8, CASE.x + CASE.w - 8]) out.push(S(k.cylinder(x, CASE.y + 1.2, 1.3, 13, 1.6, P, 14), { tone: "mid" }));
    // the drawer, pulled out
    const y0 = CASE.y + CASE.d, y1 = y0 + PULL;
    const x0 = CASE.x + 3, x1 = CASE.x + CASE.w - 3;
    const zf = 2, zw = 6.4;
    out.push(S(k.slabOf({ x: x0, y: y0, w: x1 - x0, d: PULL, r: 0.4 }, zf, 1, P, 2), { tone: "lo" }));
    out.push(S(k.slabOf({ x: x0, y: y0, w: 1.4, d: PULL, r: 0.3 }, zf, zw - zf, P, 2, 0.3), { tone: "mid" }));
    // fitted sockets with spare tokens
    const sockets = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) sockets.push([x0 + 6.4 + c * 10, y0 + 4.2 + r * 7.8, r * 3 + c]);
    const fz = zf + 1;
    out.push(Ln(sockets.map(([x, y]) => k.ring(x, y, 3.7, fz, P, 24)).join(""), { tone: "lo" }));
    for (const [x, y, i] of B.byDepth(sockets)) {
      if (i === 4) continue; // one socket is empty
      const address = ADDRS[i];
      out.push(S(k.cylinder(x, y, 3.1, fz, 1.4, P, 24, 0.3), { tone: "hi", crease: "lo" }));
      const n = notchesOf(address);
      out.push(Ln(k.ring(x, y, 1.5, fz + 1.4, P, 16), { tone: "mid" }));
      out.push(Ln(Array.from({ length: n }, (_, j) => {
        const a = -Math.PI / 2 + (j * 2 * Math.PI) / n;
        return k.lineOnTop([x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5], [x + Math.cos(a) * 3.1, y + Math.sin(a) * 3.1], fz + 1.4, P);
      }).join(""), { tone: "mid" }));
    }
    out.push(S(k.slabOf({ x: x1 - 1.4, y: y0, w: 1.4, d: PULL, r: 0.3 }, zf, zw - zf, P, 2, 0.3), { tone: "mid" }));
    const front = { x: x0 - 1.4, y: y1, w: x1 - x0 + 2.8, d: 1.8, r: 0.5 };
    out.push(S(k.slabOf(front, 1.2, 6.4, P, 2, 0.4), { tone: "mid" }));
    // pull: two posts and a bar
    const cx = (x0 + x1) / 2;
    out.push(S(k.slabOf({ x: cx - 6, y: y1 + 1.8, w: 12, d: 2, r: 0.8 }, 5, 1.8, P, 2, 0.3), { tone: "mid" }));
    out.push(B.screwDots([[cx - 4.4, y1 + 2.8], [cx + 4.4, y1 + 2.8]], 6.8, 0.35));
    return out.join("");
  }

  // --------------------------------------------------- arrest knob
  function arrest() {
    return [
      S(k.slabOf({ x: -3, y: 16, w: 6, d: 12, r: 1 }, 0, 2.4, P, 2, 0.3), { tone: "mid" }),
      B.knob(0, 30, 4.2, 0, 3.6, { angle: 0.5 }),
    ].join("");
  }

  // ----------------------------------------------------------- console
  const CON = { x: 28, y: 28, w: 66, d: 22, r: 2.4 };
  const CON_H = 9;
  const WIN = { x: CON.x + 6, y: CON.y + 6, w: 38, d: 10, r: 1 };
  function consoleBox() {
    const out = [S(k.slabOf(CON, 0, CON_H, P, 4, 0.8), { tone: "mid" })];
    out.push(Ln(k.sideSeam(CON, 2.6, P, 4), { tone: "faint" }));
    out.push(S(k.slabOf(WIN, CON_H, 0.6, P, 3), { tone: "lo", crease: "none" }));
    out.push(Ln(k.planOutline(k.insetPlan(WIN, 1), CON_H + 0.6, P, 3), { tone: "faint" }));
    const size = 5;
    const winPts = k.ringOf(k.insetPlan(WIN, 1), 3).map(([x, y]) => at([x, y, CON_H + 0.6]));
    out.push(`<defs><clipPath id="bal-win"><path d="M${winPts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L")}Z"/></clipPath></defs>`);
    out.push(`<g clip-path="url(#bal-win)" data-part="sum">${k.faceTextSvg(k.topMatrix([WIN.x + WIN.w - 2.6, WIN.y + WIN.d / 2 + size * 0.36], CON_H + 0.6, P, "x"), "0", { size, tone: "hi", anchor: "end" })}</g>`);
    // alarm lamp and a spirit level vial
    out.push(`<g class="bal-alarm" data-part="alarm">${B.lamp(CON.x + 52, CON.y + 7.4, CON_H, { r: 2.6 })}</g>`);
    const vial = { x: CON.x + 46, y: CON.y + 14, w: 14, d: 4, r: 1.8 };
    out.push(S(k.slabOf(vial, CON_H, 1.6, P, 4, 0.3), { tone: "mid" }));
    out.push(Ln(k.planOutline({ x: vial.x + 5.4, y: vial.y + 0.9, w: 3.2, d: 2.2, r: 1.1 }, CON_H + 1.6, P, 4), { tone: "mid" }));
    out.push(Ln([k.lineOnTop([vial.x + 4.6, vial.y], [vial.x + 4.6, vial.y + vial.d], CON_H + 1.6, P), k.lineOnTop([vial.x + 9.4, vial.y], [vial.x + 9.4, vial.y + vial.d], CON_H + 1.6, P)].join(""), { tone: "lo" }));
    out.push(B.screwDots(k.corners(CON, 2.4), CON_H, 0.4));
    return out.join("");
  }

  const style = `<style>
#fig-balance .bal-alarm[data-on] [data-part] .iso-top,#fig-balance .bal-alarm[data-on] .iso-solid:last-child .iso-top{fill:var(--anatomy-red);fill-opacity:.85}
#fig-balance .bal-alarm[data-on] .iso-solid:last-child .iso-edge{stroke:var(--anatomy-red)}
#fig-balance .bal-alarm[data-on] .iso-solid:last-child .iso-shade{fill:var(--anatomy-red);fill-opacity:.5}
#fig-balance [data-part="sum"][data-bad] .iso-face-text{fill:var(--anatomy-red)}
@media (max-width:560px){#fig-balance .iso-stage{overflow:hidden}#fig-balance .iso-stage>svg{width:116%;max-width:none;margin-left:-8%}}
</style>`;

  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label:
      "An assay balance on a levelled base. Each wire address has its own turned token with a notch count. Write tokens, a stack of m per address, sit on the left pan; read tokens sit on the right. Honest wiring pairs every token, the LogUp sum is zero and the beam rests level. Forging one read leaves two unpaired tuples and the beam tips.",
    body: [
      style,
      base(),
      frame(),
      panRest(-HOOK[0]),
      panRest(HOOK[0]),
      column(),
      scale(),
      `<g data-part="rodL">${hookRod(-1)}</g>`,
      `<g data-part="rodR">${hookRod(1)}</g>`,
      ...DYN.map((d) => dynSvg(d)),
      boss(),
      ...DYN_FRONT.map((d) => dynSvg(d)),
      `<g data-part="panL">${pan(-1)}</g>`,
      `<g data-part="panR">${pan(1)}</g>`,
      weightBox(),
      arrest(),
      consoleBox(),
    ],
  });

  // ------------------------------------------------------------ live
  const info = ADDRS.map((address) => {
    const w = wireAt(address);
    return { address, name: w.name, pretty: PRETTY[w.name] ?? w.name, reads: COUNT[address].reads, writes: COUNT[address].writes };
  });
  const forgedSel = ADDRS.indexOf(FORGED_ADDR);
  const tour = [
    ...info.map((_, i) => ({ sel: i, forged: false, dwell: 2.2 })),
    { sel: forgedSel, forged: true, dwell: 6.5 },
    { sel: forgedSel, forged: false, dwell: 3.5 },
  ];
  // Full text for wide cards, a compact one for phones (the corner has ~50 characters there).
  const readoutOf = (i, forged, short = false) => {
    const a = info[i];
    const hit = forged && a.address === FORGED_ADDR;
    const sum = forged ? SUM_FORGED : SUM_HONEST;
    if (short) return `addr ${a.address} ${a.pretty} · w ×${a.writes} · r ×${hit ? `${a.reads - 1}+forged` : a.reads} · Σ = ${sum}`;
    return `addr ${a.address} · ${a.pretty} · written ×${a.writes} · read ×${hit ? `${a.reads - 1} + forged` : a.reads} · Σ = ${sum}`;
  };

  const live = `function (root, bus, chapter) {
${LIVE_HELPERS}
${PRISM_SRC}
const P = ${JSON.stringify(P)};
const PIV = ${PIV}, HOOK = ${JSON.stringify(HOOK)}, THETA_F = ${THETA_F};
const DYN = ${JSON.stringify([...DYN, ...DYN_FRONT])};
const INFO = ${JSON.stringify(info)};
const TOUR = ${JSON.stringify(tour)};
const FORGED_ADDR = ${FORGED_ADDR};
const SUM = { honest: "${SUM_HONEST}", forged: "${SUM_FORGED}" };
const READ = { honest: ${JSON.stringify(info.map((_, i) => readoutOf(i, false)))}, forged: ${JSON.stringify(info.map((_, i) => readoutOf(i, true)))} };
const SHORT = { honest: ${JSON.stringify(info.map((_, i) => readoutOf(i, false, true)))}, forged: ${JSON.stringify(info.map((_, i) => readoutOf(i, true, true)))} };
const stage = root.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const button = root.querySelector("[data-forge]");
const dyn = DYN.map((d) => {
  const g = svg.querySelector('[data-dyn="' + d.name + '"]');
  return { d, fill: g.querySelector(".iso-fill"), shades: [...g.querySelectorAll(".iso-shade")], top: g.querySelector(".iso-top"), crease: g.querySelector(".iso-crease"), edge: g.querySelector(".iso-edge") };
});
const pans = [-1, 1].map((side) => ({ side, groups: [svg.querySelector('[data-part="' + (side < 0 ? "rodL" : "rodR") + '"]'), svg.querySelector('[data-part="' + (side < 0 ? "panL" : "panR") + '"]')] }));
const tokens = [...svg.querySelectorAll("[data-token]")];
const honest = svg.querySelector("[data-honest]");
const forgedEl = svg.querySelector("[data-forged]");
const drop = svg.querySelector("[data-drop]");
const alarm = svg.querySelector('[data-part="alarm"]');
const sumBox = svg.querySelector('[data-part="sum"]');
const sumText = sumBox.querySelector("text");
const W = 2 * Math.PI / 1.9, ZETA = 0.14;
let theta = 0, rate = 0, drawn = NaN, mix = 0;
let sel = 0, forged = false, touring = !stillQuery.matches, idle = 0, step = 0, t = 0;
function drawBeam() {
  if (Math.abs(theta - drawn) < 1e-5) return;
  drawn = theta;
  for (const x of dyn) {
    const p = prismPaths(x.d.profile, x.d.y[0], x.d.y[1], [0, PIV], theta, P);
    x.fill.setAttribute("d", p.fill);
    x.shades.forEach((el, i) => el.setAttribute("d", p.shades[i]));
    x.top.setAttribute("d", p.top);
    x.crease.setAttribute("d", p.crease);
    x.edge.setAttribute("d", p.outline);
  }
  const c = Math.cos(theta), s = Math.sin(theta);
  for (const pan of pans) {
    const hx = pan.side * HOOK[0], hz = HOOK[1];
    const dx = hx * c + hz * s - hx, dz = -hx * s + hz * c - hz;
    const tr = translateAlong(P, [dx, 0, dz]);
    pan.groups.forEach((g) => g.setAttribute("transform", tr));
  }
}
let lastSel = -1, lastForged = null;
function show() {
  if (sel !== lastSel) {
    tokens.forEach((g) => {
      const on = Number(g.dataset.token) === INFO[sel].address;
      g.querySelectorAll(".iso-solid").forEach((el) => (on ? el.setAttribute("data-lit", "") : el.removeAttribute("data-lit")));
    });
    lastSel = sel;
    bus.emit("focus", { chapter, refs: ["tuple:" + INFO[sel].address, "wire:" + INFO[sel].name] });
  }
  const bad = mix > 0.5;
  if (bad !== lastForged) {
    lastForged = bad;
    sumText.textContent = bad ? SUM.forged : SUM.honest;
    bad ? sumBox.setAttribute("data-bad", "") : sumBox.removeAttribute("data-bad");
    bad ? alarm.setAttribute("data-on", "") : alarm.removeAttribute("data-on");
  }
  forgedEl.style.display = mix > 0.001 ? "" : "none";
  forgedEl.setAttribute("opacity", mix.toFixed(3));
  honest.setAttribute("opacity", (1 - mix).toFixed(3));
  drop.setAttribute("transform", translateAlong(P, [0, 0, (1 - mix) * 7]));
  const set = root.clientWidth < 560 ? SHORT : READ;
  const text = (bad ? set.forged : set.honest)[sel];
  if (readout.textContent !== text) readout.textContent = text;
  if (button) { button.setAttribute("aria-pressed", forged ? "true" : "false"); button.textContent = forged ? "Restore the read" : "Forge one read"; }
}
const run = loop(root, (dt, calm) => {
  if (touring) {
    t += dt;
    if (t >= TOUR[step].dwell) { t = 0; step = (step + 1) % TOUR.length; }
    sel = TOUR[step].sel; forged = TOUR[step].forged;
  } else if (!calm) {
    idle += dt;
    if (idle > 6) { touring = true; t = 0; step = TOUR.findIndex((s) => s.sel === sel && !s.forged); if (step < 0) step = 0; }
  }
  const target = forged ? THETA_F : 0;
  if (calm) { theta = target; rate = 0; mix = forged ? 1 : 0; }
  else {
    const n = 4, h = dt / n;
    for (let i = 0; i < n; i++) { rate += (-W * W * (theta - target) - 2 * ZETA * W * rate) * h; theta += rate * h; }
    if (Math.abs(theta - target) < 2e-5 && Math.abs(rate) < 2e-5) { theta = target; rate = 0; }
    mix = follow(mix, forged ? 1 : 0, dt, 0.28, false);
    if (Math.abs(mix - (forged ? 1 : 0)) < 1e-3) mix = forged ? 1 : 0;
  }
  drawBeam();
  show();
  return touring || rate !== 0 || theta !== target || mix !== (forged ? 1 : 0);
});
function take() { touring = false; idle = 0; }
function select(i) { take(); sel = (i + INFO.length) % INFO.length; run(); show(); }
function setForge(on) { take(); forged = on; run(); show(); }
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") select(sel + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") select(sel - 1);
  else if (e.key === "Home") select(0);
  else if (e.key === "End") select(INFO.length - 1);
  else if (e.key === "f" || e.key === "F" || e.key === "Enter") setForge(!forged);
  else if (e.key === "Escape") setForge(false);
  else return;
  e.preventDefault();
});
stage.addEventListener("click", () => { if (touring) take(); else { touring = true; t = 0; run(); } });
if (button) button.addEventListener("click", () => setForge(!forged));
bus.on("pick", ({ chapter: c, ref }) => {
  if (c !== chapter) return;
  const at = ref.indexOf(":");
  const kind = ref.slice(0, at), value = ref.slice(at + 1);
  const i = INFO.findIndex((a) => (kind === "tuple" ? a.address === Number(value) : kind === "wire" ? a.name === value : false));
  if (i >= 0) select(i);
});
drawBeam();
show();
run();
}`;

  return {
    id: "fig-balance",
    fig: "Fig 4",
    title: "Assay balance",
    hint: "← → address · F forge",
    readout: readoutOf(0, false),
    stage: { role: "group", "aria-label": "Assay balance: arrow keys pick a wire address and light its tokens on both pans; F forges one read and tips the beam" },
    keys: [
      { mark: "lit", label: "Tokens of the chosen address, on both pans" },
      { mark: "raised", label: "Left pan: writes, m per address · right pan: reads" },
      { mark: "red", label: "Forged read: no partner, sum nonzero" },
    ],
    caption: `The balance is a picture of a field sum, not of mass. Each read adds 1/H(GATE, a, V₀..V₃) and each write subtracts m/H(…); with honest wiring the ${TERMS.length} terms of ${MODEL.poly.name} pair off and Σ = 0 in M31. Forge one read, so x⁴'s gate reads ${FORGED_VALUE} where x² wrote ${HONEST_VALUE} in lane ${FORGE_LANE}, and Σ = ${SUM_FORGED}: the proof fails. Sums use an illustrative M31 challenge; Stwo draws QM31 challenges after the trace commitment.`,
    controls: `<div class="fig-controls"><button type="button" data-forge aria-pressed="false">Forge one read</button></div>`,
    svg,
    live,
  };
}
