// The one model every figure reads. Values are computed here from the real
// S31 example programs in src/data; geometry never invents a number.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const text = (name) => readFileSync(join(DATA, name), "utf8");
const json = (name) => JSON.parse(text(name));
const maybe = (name) => {
  try {
    return json(name);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------- M31 field
export const P = 2147483647;
const PB = BigInt(P);
const red = (v) => Number(((v % PB) + PB) % PB);
export const add = (a, b) => red(BigInt(a) + BigInt(b));
export const sub = (a, b) => red(BigInt(a) - BigInt(b));
export const mul = (a, b) => red(BigInt(a) * BigInt(b));
export const pow = (a, e) => {
  let r = 1n, b = BigInt(a) % PB, k = BigInt(e);
  while (k > 0n) {
    if (k & 1n) r = (r * b) % PB;
    b = (b * b) % PB;
    k >>= 1n;
  }
  return Number(r);
};
export const inv = (a) => pow(a, P - 2);
const lanes = (f, ...xs) => xs[0].map((_, j) => f(...xs.map((x) => x[j])));

// ------------------------------------------------- Program: math_polynomial4
// f(x) = x^5 + 3x - 7 over M31, four independent lanes, built with direct-gate.
const POLY_SOURCE = text("math_polynomial4.s31");
const POLY_RELATION = json("math_polynomial4.s31.json");
const POLY_VALID = json("math_polynomial4.valid.json");
const POLY_TRIAL = maybe("trial-poly.json");
const POLY_EQUATIONS = maybe("equations-poly.json");
const POLY_COST = maybe("cost-poly.json");
const POLY_CHANGED = maybe("changed-statement-poly.json");

function evalRelation(relation, inputs) {
  const env = { ...inputs };
  return relation.nodes.map((node) => {
    const a = env[node.lhs];
    let out;
    if (node.op === "mul") out = lanes(mul, a, env[node.rhs]);
    else if (node.op === "add") out = lanes(add, a, env[node.rhs]);
    else if (node.op === "mul_const") out = a.map((v) => mul(v, node.constant));
    else if (node.op === "add_const") out = a.map((v) => add(v, node.constant));
    else throw new Error(`model: unknown op ${node.op}`);
    env[node.name] = out;
    return { ...node, lanes: out };
  });
}

const polyNodes = evalRelation(POLY_RELATION, POLY_VALID.public_inputs);
const polyResult = polyNodes[polyNodes.length - 1].lanes;
if (polyResult.join() !== POLY_VALID.public_outputs.result.join())
  throw new Error("model: math_polynomial4 does not reproduce its claimed output");

// Each source line and the relation nodes it lowers to. `pow<5>` expands to
// three multiplications by the standard library's static power schedule.
const srcLines = POLY_SOURCE.split("\n");
const lineOf = (needle) => srcLines.findIndex((line) => line.includes(needle)) + 1;
const POLY_LINES = [
  { line: lineOf("circuit math_polynomial4"), kind: "signature", nodes: [], note: "one public input x: [m31; 4], one public output" },
  { line: lineOf("pow<5>"), kind: "call", nodes: ["_s31_0", "_s31_1", "fifth"], note: "std::math::pow<5> unrolls to x², x⁴, x⁴·x" },
  { line: lineOf("splat<4>(3_m31)"), kind: "op", nodes: ["triple"], note: "x .* splat<4>(3) becomes one mul_const" },
  { line: lineOf("fifth + triple"), kind: "op", nodes: ["combined"], note: "+ becomes one add" },
  { line: lineOf("std::math::sub"), kind: "call", nodes: ["result"], note: "sub 7 becomes add_const p−7" },
  { line: lineOf("    result"), kind: "return", nodes: [], note: "result is bound as the public output" },
];

// Circuit wires. Addresses are illustrative (the builder assigns its own), but
// the graph, multiplicities and per-lane values are the program's.
const CONST_3 = 3, CONST_NEG7 = P - 7;
const wires = [
  { name: "x", address: 10, kind: "input", lanes: POLY_VALID.public_inputs.x },
  { name: "c3", address: 11, kind: "const", lanes: [CONST_3, CONST_3, CONST_3, CONST_3] },
  { name: "c−7", address: 12, kind: "const", lanes: [CONST_NEG7, CONST_NEG7, CONST_NEG7, CONST_NEG7] },
];
const addressOf = { x: 10 };
let next = 13;
const gates = polyNodes.map((node) => {
  const address = next++;
  addressOf[node.name] = address;
  const in0 = node.lhs;
  const in1 = node.op === "mul_const" ? "c3" : node.op === "add_const" ? "c−7" : node.rhs;
  const opcode = node.op === "add" || node.op === "add_const" ? "add" : "pointwise_mul";
  wires.push({ name: node.name, address, kind: "gate", lanes: node.lanes });
  return { name: node.name, op: node.op, opcode, in0, in1, out: node.name, lanes: node.lanes };
});
addressOf.c3 = 11;
addressOf["c−7"] = 12;
const uses = Object.fromEntries(wires.map((wire) => [wire.name, 0]));
for (const gate of gates) {
  uses[gate.in0]++;
  uses[gate.in1]++;
}
uses.result++; // public output binding consumes the result wire once
for (const wire of wires) wire.mult = uses[wire.name];
for (const gate of gates) {
  gate.address = { in0: addressOf[gate.in0], in1: addressOf[gate.in1], out: addressOf[gate.out] };
  gate.mult = uses[gate.out];
}

const laneOf = (name) => wires.find((wire) => wire.name === name).lanes;
const FLAGS = ["add", "sub", "mul", "pointwise_mul"];
const polyRows = gates.map((gate, row) => {
  const A = laneOf(gate.in0), B = laneOf(gate.in1), C = laneOf(gate.out);
  const residual = (Cv) => lanes((a, b, c) => (gate.opcode === "add" ? sub(sub(c, a), b) : sub(c, mul(a, b))), A, B, Cv);
  return {
    row,
    gate: gate.name,
    op: gate.op,
    opcode: gate.opcode,
    flags: FLAGS.map((flag) => (flag === gate.opcode ? 1 : 0)),
    address: gate.address,
    mult: gate.mult,
    A, B, C,
    residual: residual(C),
    residualIf: (Cv) => residual(Cv),
  };
});

// ------------------------------------------- Program: arith4_m31 (the chip)
const CHIP_SOURCE = text("arith4_m31.s31");
const CHIP_VALID = json("arith4.valid.json");
const CHIP_TRIAL = maybe("trial-chip.json");
const step = (v, c = 7) => v.map((s) => add(mul(s, s), c));
function chipTrace(x, rounds) {
  const rows = [];
  let s = x;
  for (let i = 0; i < rounds; i++) {
    const out = step(s);
    rows.push({ index: i, in: s, out });
    s = out;
  }
  return rows;
}
const chipReal = chipTrace(CHIP_VALID.public_inputs.x, 256);
if (chipReal[255].out.join() !== CHIP_VALID.public_outputs.result.join())
  throw new Error("model: arith4_m31 does not reproduce its claimed output");
const chipTeach = chipTrace([1, 2, 3, 4], 16);

// ------------------------------------------------------- Stwo / FRI numbers
// Visible FRI settings from a real direct-gate trial report (see data/*.json).
const FALLBACK_TRIAL = {
  program: "functional_square4",
  lowering: "direct-gate",
  profile: "direct-m31-v4",
  raw: { qm31_ops: 322 },
  padded: { qm31_ops: 512 },
  preprocessed_cells: 4096,
  proof_bytes: 55523,
  visible_fri: { blowup_factor: 2, fold_step: 1, last_layer_degree_bound: 1, pow_bits: 26, queries: 70 },
  native_verifier_accepted: true,
  changed_public_statement_rejected: "public_outputs.result[0]",
};
const trial = POLY_TRIAL ?? FALLBACK_TRIAL;
const fri = trial.visible_fri;
const traceLog = Math.log2(trial.padded.qm31_ops);
const ldeLog = traceLog + Math.log2(fri.blowup_factor);
const friLayers = [];
for (let log = ldeLog; log >= Math.log2(fri.last_layer_degree_bound * fri.blowup_factor); log -= fri.fold_step)
  friLayers.push({ log, size: 2 ** log });

// ----------------------------------------------------------------- LogUp
// Semantic tuples: + use, − m · produce. They cancel when wiring is honest.
const logupTerms = [];
for (const gate of gates) {
  logupTerms.push({ sign: +1, address: gate.address.in0, lanes: laneOf(gate.in0), by: gate.name, role: "use in0" });
  logupTerms.push({ sign: +1, address: gate.address.in1, lanes: laneOf(gate.in1), by: gate.name, role: "use in1" });
  logupTerms.push({ sign: -gate.mult, address: gate.address.out, lanes: laneOf(gate.out), by: gate.name, role: "produce" });
}

export const MODEL = {
  field: { p: P, name: "M31", modulus: "2³¹ − 1" },
  poly: {
    name: POLY_RELATION.name,
    source: POLY_SOURCE,
    lines: POLY_LINES,
    relation: POLY_RELATION,
    x: POLY_VALID.public_inputs.x,
    result: polyResult,
    nodes: polyNodes,
    wires,
    gates,
    rows: polyRows,
    flags: FLAGS,
    columns: {
      preprocessed: ["add_flag", "sub_flag", "mul_flag", "pointwise_mul_flag", "in0_address", "in1_address", "out_address", "mults"],
      main: ["A0", "A1", "A2", "A3", "B0", "B1", "B2", "B3", "C0", "C1", "C2", "C3"],
      interaction: 8,
    },
    logup: logupTerms,
    equations: POLY_EQUATIONS,
    trial,
  },
  chip: {
    name: "arith4_m31",
    source: CHIP_SOURCE,
    x: CHIP_VALID.public_inputs.x,
    result: CHIP_VALID.public_outputs.result,
    rounds: 256,
    tag: 0x53333102,
    real: chipReal,
    teach: chipTeach,
    columns: ["index", "in0", "in1", "in2", "in3", "out0", "out1", "out2", "out3"],
    constraints: 6,
    trial: CHIP_TRIAL,
  },
  stark: {
    traceLog,
    ldeLog,
    fri,
    friLayers,
    proofBytes: trial.proof_bytes,
    rawRows: trial.raw.qm31_ops,
    paddedRows: trial.padded.qm31_ops,
    fixedCells: trial.preprocessed_cells,
    rejected: trial.changed_public_statement_rejected,
    changed: POLY_CHANGED,
    component: POLY_COST?.component_manifest?.components?.[0] ?? null,
    key: POLY_COST
      ? {
          circuit: POLY_COST.circuit_hash,
          air: POLY_COST.component_manifest.air_bundle_sha256,
          ir: POLY_COST.canonical_ir_sha256,
          binding: POLY_COST.component_manifest.components[0].program_binding_sha256,
        }
      : null,
    accepted: trial.native_verifier_accepted,
  },
};

export default MODEL;
