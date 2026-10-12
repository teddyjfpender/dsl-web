// A flat circuit schematic for the circuit chapter: the real gate graph from
// MODEL, with wire addresses and live lane values. Elements carry data-ref
// "wire:<name>", so the page bus lights them in step with the patch bay.
import MODEL from "./model/s31.mjs";
import { esc } from "./page.mjs";

const poly = MODEL.poly;
const W = 540, H = 340;
const GW = 44, GH = 36;
const COL = (c) => 30 + c * 76;
const ROW = [44, 140, 232, 296];

// Hand-placed layout of the real graph (columns follow dependency depth).
const PLACE = {
  x: [0, 1], c3: [0, 2], "c−7": [4, 3],
  _s31_0: [1, 0], _s31_1: [2, 0], fifth: [3, 0], triple: [2, 2],
  combined: [4, 1], result: [5, 1], out: [6, 1],
};
const LABEL = { x: "x", c3: "3", "c−7": "p−7", _s31_0: "x²", _s31_1: "x⁴", fifth: "x⁵", triple: "3x", combined: "x⁵+3x", result: "f(x)" };
const fmt = (n) => Number(n).toLocaleString("en-US");

export function schematicPanel() {
  const at = (name) => ({ x: COL(PLACE[name][0]), y: ROW[PLACE[name][1]] });
  const wire = (name) => poly.wires.find((w) => w.name === name);
  const parts = [];

  // Wires: producer output → consumer port, orthogonal, one path per read.
  const edges = [];
  poly.gates.forEach((g) => {
    edges.push({ from: g.in0, to: g.name, port: 0 });
    edges.push({ from: g.in1, to: g.name, port: 1 });
  });
  edges.push({ from: "result", to: "out", port: 0.5 });
  const portY = (to, port) => at(to).y - GH / 2 + (port === 0.5 ? GH / 2 : port === 0 ? GH * 0.3 : GH * 0.7);
  const bends = {};
  for (const e of edges) {
    const a = at(e.from), b = at(e.to);
    const x0 = a.x + GW / 2, y0 = a.y, x1 = b.x - GW / 2, y1 = portY(e.to, e.port);
    const key = e.to;
    bends[key] = (bends[key] ?? 0) + 1;
    const mx = x1 - 8 - (bends[key] - 1) * 6;
    const d = Math.abs(y0 - y1) < 0.5 ? `M${x0} ${y0}H${x1}` : `M${x0} ${y0}H${mx}V${y1}H${x1}`;
    parts.push(`<path class="sch-wire" data-ref="wire:${esc(e.from)}" d="${d}"/>`);
    parts.push(`<circle class="sch-port" cx="${x1}" cy="${y1}" r="1.8"/>`);
  }

  // Sources, gates and the output terminal.
  for (const name of Object.keys(PLACE)) {
    const { x, y } = at(name);
    if (name === "out") {
      parts.push(`<g class="sch-node" data-ref="wire:result"><rect class="sch-term" x="${x - GW / 2}" y="${y - GH / 2}" width="${GW}" height="${GH}" rx="${GH / 2}"/><text class="sch-sym" x="${x}" y="${y + 1}">out</text><text class="sch-name" x="${x}" y="${y + GH / 2 + 12}">public</text></g>`);
      continue;
    }
    const w = wire(name);
    const gate = poly.gates.find((g) => g.name === name);
    const sym = gate ? (gate.opcode === "add" ? "+" : "⊙") : w.kind === "const" ? "k" : "in";
    const cls = gate ? "sch-gate" : "sch-src";
    parts.push(`<g class="sch-node" data-ref="wire:${esc(name)}"><rect class="${cls}" x="${x - GW / 2}" y="${y - GH / 2}" width="${GW}" height="${GH}" rx="4"/><text class="sch-sym" x="${x}" y="${y + 1}">${sym}</text><text class="sch-name" x="${x}" y="${y + GH / 2 + 12}">${esc(LABEL[name])}</text></g>`);
    // Output stub label: address and the selected lane's value.
    parts.push(`<text class="sch-addr" x="${x + GW / 2 + 3}" y="${y - 5}">@${w.address}</text>`);
    parts.push(`<text class="sch-val" data-sch-val="${esc(name)}" data-lanes="${w.lanes.join(",")}" x="${x}" y="${y + GH / 2 + 24}">${fmt(w.lanes[0])}</text>`);
  }

  const lanes = [0, 1, 2, 3].map((j) => `<button type="button" data-sch-lane="${j}" aria-pressed="${j === 0}">lane ${j}</button>`).join("");
  return `<div class="code schematic" id="schematic-circuit"><div class="code-head"><span>circuit schematic</span><span class="sch-lanes">${lanes}</span></div><svg class="sch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Circuit schematic of math_polynomial4: input x and constants 3 and p minus 7 feed six gates, x squared, x to the fourth, x to the fifth, 3x, their sum, and the result, which is bound to the public output.">${parts.join("")}</svg><div class="sch-key">⊙ pointwise multiply, lane by lane · + add · @n wire address (illustrative) · numbers show the selected lane</div></div>`;
}

export const schematicLive = `function (root) {
const vals = [...root.querySelectorAll("[data-sch-val]")];
const buttons = [...root.querySelectorAll("[data-sch-lane]")];
const fmt = (n) => Number(n).toLocaleString("en-US");
let lane = 0;
function show(j) {
  lane = j;
  vals.forEach((t) => (t.textContent = fmt(t.dataset.lanes.split(",")[j])));
  buttons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.schLane) === j)));
}
buttons.forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); show(Number(b.dataset.schLane)); }));
// Follow the patch bay's lane knob through its readout ("lane N · …").
const readout = document.querySelector("#fig-plugboard [data-readout]");
if (readout) new MutationObserver(() => {
  const m = /^lane (\\d)/.exec(readout.textContent);
  if (m && Number(m[1]) !== lane) show(Number(m[1]));
}).observe(readout, { childList: true, characterData: true, subtree: true });
}`;
