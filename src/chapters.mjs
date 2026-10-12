// Chapter text, side panels and the page around the figures.
// Each chapter's figure is a module in src/figures; a missing module is skipped.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import MODEL from "./model/s31.mjs";
import { codeBlock, factList, plate, esc, NAME, TAGLINE, REPO } from "./page.mjs";
import { schematicPanel, schematicLive } from "./schematic.mjs";

const FIGS = join(dirname(fileURLToPath(import.meta.url)), "figures");
const fmt = (n) => Number(n).toLocaleString("en-US");
const poly = MODEL.poly;
const stark = MODEL.stark;
const chip = MODEL.chip;
const short = (hash) => (hash ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : "—");

// ------------------------------------------------------------ side panels
function sourcePanel(chapter) {
  const lineRefs = Object.fromEntries(poly.lines.map((l) => [l.line, `line:${l.line} ${l.nodes.map((n) => `node:${n}`).join(" ")}`.trim()]));
  return codeBlock({
    title: `${poly.name}.s31`,
    note: "source",
    lines: poly.source.trimEnd().split("\n"),
    refs: (_, i) => lineRefs[i + 1] ?? "",
  });
}

function relationPanel() {
  const lines = ["{", `  "name": "${poly.relation.name}",`, `  "inputs": [{"name":"x","kind":"m31","length":4,"visibility":"public"}],`, `  "nodes": [`];
  const refs = ["", "", "", ""];
  poly.relation.nodes.forEach((node, i) => {
    const operand = node.rhs ? `"rhs":"${node.rhs}"` : `"constant":${node.constant}`;
    lines.push(`    {"name":"${node.name}","op":"${node.op}","lhs":"${node.lhs}",${operand}}${i < poly.relation.nodes.length - 1 ? "," : ""}`);
    refs.push(`node:${node.name}`);
  });
  lines.push("  ],", `  "public_outputs": ["result"]`, "}");
  refs.push("", "node:result", "");
  return codeBlock({ title: "normalized relation", note: "s31 lower", lang: "json", lines, refs: (_, i) => refs[i] ?? "" });
}

function wirePanel() {
  const rows = poly.wires
    .map((w) => `<tr data-ref="wire:${esc(w.name)}"><td>${esc(w.name)}</td><td>${w.address}</td><td>${w.mult}</td><td>${w.lanes.map((v) => fmt(v)).join(" · ")}</td></tr>`)
    .join("");
  return `<div class="table-wrap"><table class="table"><thead><tr><th>wire</th><th>addr</th><th>uses</th><th>lanes 0 · 1 · 2 · 3</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function tracePanel() {
  const rows = poly.rows
    .map((r) => `<tr data-ref="row:${r.row}"><td>${r.row}</td><td>${esc(r.opcode)}</td><td>${r.address.in0}</td><td>${r.address.in1}</td><td>${r.address.out}</td><td>${r.mult}</td><td>${fmt(r.A[2])}</td><td>${fmt(r.B[2])}</td><td>${fmt(r.C[2])}</td></tr>`)
    .join("");
  return `<div class="table-wrap"><table class="table"><thead><tr><th>row</th><th>flag</th><th>in0</th><th>in1</th><th>out</th><th>m</th><th>A₂</th><th>B₂</th><th>C₂</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function logupPanel() {
  const byAddress = new Map();
  for (const term of poly.logup) {
    const entry = byAddress.get(term.address) ?? { address: term.address, wire: poly.wires.find((w) => w.address === term.address)?.name, uses: 0, produced: 0 };
    if (term.sign > 0) entry.uses += term.sign;
    else entry.produced += -term.sign;
    byAddress.set(term.address, entry);
  }
  const rows = [...byAddress.values()]
    .sort((a, b) => a.address - b.address)
    .map((e) => `<tr data-ref="tuple:${e.address} wire:${esc(e.wire)}"><td>${e.address}</td><td>${esc(e.wire)}</td><td>+${e.uses}</td><td>${e.produced ? "−" + e.produced : "input / const"}</td></tr>`)
    .join("");
  return `<div class="table-wrap"><table class="table"><thead><tr><th>addr</th><th>wire</th><th>reads</th><th>writes × m</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function chipPanel() {
  const rows = chip.teach
    .slice(0, 6)
    .map((r) => `<tr data-ref="round:${r.index}"><td>${r.index}</td><td>${r.in.map(fmt).join(", ")}</td><td>${r.out.map(fmt).join(", ")}</td></tr>`)
    .join("");
  return `<div class="table-wrap"><table class="table"><thead><tr><th>i</th><th>in[0..3]</th><th>out[0..3]</th></tr></thead><tbody>${rows}<tr><td>…</td><td>…</td><td>…</td></tr></tbody></table></div>`;
}

// ---------------------------------------------------------------- chapters
const lane2 = (name) => poly.wires.find((w) => w.name === name).lanes[2];
const DEFS = [
  {
    key: "source",
    module: "01-punch.mjs",
    no: "01",
    station: ["Source", "typed text"],
    title: "Source becomes a deck of relation nodes",
    sub: `A proof system can't read code. It can only check arithmetic. So the first job is to turn your program into a flat list of arithmetic steps, with every loop, function and name taken away.`,
    side: () => [sourcePanel(), relationPanel()],
    question: "What does the compiler actually keep from my program?",
    steps: [
      `<span class="term">Write a circuit.</span> Our program is <code>f(x) = x⁵ + 3x − 7</code>. Its input <code>x: [m31; 4]</code> is an array of four numbers, called <span class="term">lanes</span>. The same formula runs on each lane separately, here with <code>x = [${poly.x.join(", ")}]</code>.`,
      `<span class="term">All arithmetic wraps around.</span> Numbers live in <span class="term">M31</span>, the integers modulo <code>p = 2³¹ − 1 = ${fmt(MODEL.field.p)}</code>. Lane 0 computes <code>0 + 0 − 7</code>, which is −7, and −7 wraps to <code>${fmt(poly.result[0])}</code>. That's why the claimed output looks so large.`,
      `<span class="term">Lower it.</span> The compiler type-checks the text and expands every convenience. <code>std::math::pow&lt;5&gt;</code> becomes three multiplications: x² = x·x, x⁴ = x²·x², x⁵ = x⁴·x. <code>sub(…, 7)</code> becomes "add <code>p − 7</code>". Functions, closures and records disappear entirely and cost nothing.`,
      `<span class="term">What's left is the relation.</span> Six numbered steps, each one operation on earlier results. That's the deck in the stacker and the JSON on the right. Lines that only declare the inputs or return the result add no steps.`,
    ],
    tryit: [
      `Press <kbd>→</kbd> on the figure to punch one card at a time, and watch the lit source line and JSON node move together.`,
      `Click a line of source on the right: the machine jumps to the cards that line produced.`,
    ],
    keyidea: `The relation is fixed when you build. Values you supply later can't change its shape, so one verification key works for every run.`,
    caveat: `The hole patterns are this figure's own encoding. <code>s31 lower</code> prints the exact JSON the compiler consumes.`,
  },
  {
    key: "circuit",
    module: "02-plugboard.mjs",
    no: "02",
    station: ["Circuit", "gates & wires"],
    title: "Nodes become gates wired by address",
    sub: `Each step of the relation becomes a physical-looking gate. Gates are connected by wires, and every wire has a fixed address so later stages can tell exactly which value went where.`,
    side: () => [schematicPanel(), wirePanel()],
    sideLive: { id: "schematic-circuit", live: schematicLive },
    question: "How do six steps become a machine that computes four lanes at once?",
    steps: [
      `<span class="term">One gate per step.</span> Each gate reads two wires and writes one. The multiply gate for <code>x²</code> reads <code>x</code> twice and writes a new wire.`,
      `<span class="term">One wire carries four lanes.</span> The <code>direct-gate</code> profile packs the four lane values into one wire, like four conductors in one cable. A <span class="term">pointwise</span> multiply works conductor by conductor, so in lane 2 the gate turns <code>2</code> into <code>${lane2("_s31_0")}</code> while lane 3 turns <code>7</code> into <code>${poly.wires.find((w) => w.name === "_s31_0").lanes[3]}</code>. Lanes never mix.`,
      `<span class="term">Constants are wires too.</span> The <code>3</code> in <code>3x</code> and the <code>p − 7</code> are wires with fixed values, read like any other input.`,
      `<span class="term">Count the reads.</span> A wire's <span class="term">multiplicity</span> is how many times it is read. <code>x</code> is read 4 times, <code>x²</code> twice and <code>result</code> once, by the public output. These counts become important in chapter 04.`,
    ],
    tryit: [
      `Turn the lane knob with <kbd>←</kbd> <kbd>→</kbd>: a pulse runs through the gates and every display shows that lane's value.`,
      `Follow lane 2 by hand: 2 → 4 → 16 → 32, then 3·2 = 6, then 32 + 6 − 7 = <code>${poly.result[2]}</code>.`,
      `Click a row of the wire table to send the pulse to that wire.`,
    ],
    keyidea: `A circuit is the program's data flow, fixed in place: which gate reads which wire, and how often.`,
    caveat: `The addresses shown are illustrative; the builder assigns its own. The graph, the multiplicities and every lane value come from the program.`,
  },
  {
    key: "air",
    module: "03-tabulator.mjs",
    no: "03",
    station: ["AIR", "rows & columns"],
    title: "Gates become rows of a trace table",
    sub: `A STARK doesn't check gates directly. It checks a table: every gate becomes one row, and each row must satisfy a simple equation. This table-plus-equations form is called an AIR, an Algebraic Intermediate Representation.`,
    side: () => [tracePanel()],
    question: "How do you check a whole computation with one kind of equation?",
    steps: [
      `<span class="term">Fixed columns describe the program.</span> For each row they say which operation runs (four on/off flags: add, sub, mul, pointwise_mul) and which wire addresses it uses. They're decided at build time and are the same for every proof, like the pins on the drum.`,
      `<span class="term">Witness columns hold the values.</span> The prover fills in A, B and C, the two inputs and the output, four lanes each, so 12 witness columns. That's the paper sheet.`,
      `<span class="term">Each row must come out to zero.</span> The flag switches its equation on. For a multiply row, <code>C − A·B = 0</code>. Row 2 in lane 2 is x⁵ = x⁴·x: <code>${lane2("fifth")} − ${lane2("_s31_1")}·2 = 0</code>. ✓`,
      `<span class="term">The real table is bigger.</span> Inputs, constants, the output binding and bookkeeping rows bring it to <code>${stark.rawRows}</code> rows. It is then padded to <code>${stark.paddedRows}</code>, because the proof needs a power of two. 8 fixed columns × ${stark.paddedRows} rows = <code>${fmt(stark.fixedCells)}</code> fixed cells.`,
    ],
    tryit: [
      `Step through rows with <kbd>←</kbd> <kbd>→</kbd> and watch the gauge sit on zero.`,
      `Press <kbd>F</kbd> (forge) to add 1 to C. The equation is no longer zero: the needle swings and the lamp goes red. That's a wrong computation being caught.`,
    ],
    keyidea: `If every row's equation is zero, every gate computed correctly. One equation per row, checked everywhere at once.`,
    caveat: `The six rows shown are the program's six arithmetic gates. The physical table groups rows by operation and adds permutation rows.`,
  },
  {
    key: "logup",
    module: "04-balance.mjs",
    no: "04",
    station: ["LogUp", "wire consistency"],
    title: "A balance proves every wire is the same wire",
    sub: `Chapter 03 checks each row on its own, but that leaves a loophole. Nothing yet says the value a gate <em>reads</em> is the value another gate <em>wrote</em>. LogUp closes that gap with one big sum that must balance.`,
    side: () => [logupPanel()],
    question: "What stops a cheater from making every row correct but disconnected?",
    steps: [
      `<span class="term">The loophole.</span> A cheater could write a correct row <code>x² = 2·2 = 4</code>, then a correct row <code>x⁴ = 5·5 = 25</code>. Both rows pass chapter 03's check, but the second one read <code>5</code>, not the <code>4</code> that was written.`,
      `<span class="term">Tag every read and write.</span> Each read of a wire adds a token for <code>(address, value)</code>. Each write removes <code>m</code> tokens, one per expected read. Honest wiring means every token has a partner, so the total is zero.`,
      `<span class="term">Make tokens impossible to fake.</span> Each token is the fraction <code>1 / H(address, value)</code>, where H mixes in random numbers chosen <em>after</em> the prover has committed to the table. The prover can't find fake values that happen to cancel.`,
      `<span class="term">Read the scale.</span> Honest: Σ = 0 and the beam is level. Forged read: one token has no partner, Σ ≠ 0 and the beam tips. The proof fails.`,
    ],
    tryit: [
      `Use <kbd>←</kbd> <kbd>→</kbd> to pick an address: its write tokens and read tokens light up on both pans in equal numbers.`,
      `Press <kbd>F</kbd> to forge the read above. The display shows the real, nonzero field sum.`,
    ],
    keyidea: `Row equations check the arithmetic; LogUp checks the wiring. You need both to trust the output.`,
    caveat: `The balance pictures a sum of field elements, not of weights. The figure uses an illustrative challenge. Real proofs draw it from the transcript after the trace is committed.`,
  },
  {
    key: "chip",
    module: "05-chip.mjs",
    no: "05",
    station: ["Chip", "repeated step"],
    title: "A recurrence runs on its own line",
    sub: `Some programs repeat one step many times. Instead of unrolling 256 copies into gates, the compiler can hand the loop to a dedicated assembly line, called a chip, that proves one round per row.`,
    side: () => [codeBlock({ title: "arith4_m31.s31", note: "source", lines: chip.source.trimEnd().split("\n") }), chipPanel()],
    question: "How can a proof cover 256 rounds without 256 copies of the circuit?",
    steps: [
      `<span class="term">One step, repeated.</span> <code>iterate&lt;256&gt;(step, x)</code> applies <code>v ↦ v² + 7</code> to all four lanes, 256 times. The compiler sees a single <code>repeat</code> node.`,
      `<span class="term">One row per round.</span> The chip's table has 9 columns: the round <code>index</code>, four inputs and four outputs. Round 0 of the teaching run turns <code>[1, 2, 3, 4]</code> into <code>[8, 11, 16, 23]</code>, since 1² + 7 = 8 and 4² + 7 = 23.`,
      `<span class="term">Four step checks.</span> In each lane, <code>out − in² − 7 = 0</code>. That's 4 of the chip's 6 constraints.`,
      `<span class="term">Link the rounds.</span> The other 2 constraints are a LogUp, as in chapter 04. Round <code>i</code>'s outputs must match round <code>i + 1</code>'s inputs, and the first input and last output are bound to the public <code>x</code> and result.`,
    ],
    tryit: [
      `Step rounds with <kbd>←</kbd> <kbd>→</kbd>. Check one by hand: 8² + 7 = 71, the first output of round 1.`,
      `Click a row of the trace table on the right to jump to that round.`,
    ],
    keyidea: `A chip turns "do this 256 times" into 256 rows of one small table, linked end to end by lookups.`,
    caveat: `The figure runs the 16-round teaching instance. The real build proves ${chip.rounds} rounds for x = [${chip.x.map(fmt).join(", ")}].`,
  },
  {
    key: "fri",
    module: "06-press.mjs",
    no: "06",
    station: ["Commit · FRI", "low degree"],
    title: "Columns become polynomials, folded flat",
    sub: `The verifier can't read a 512-row table, so the prover turns it into polynomials and sends a few fingerprints. FRI then lets the verifier check, with a handful of random spot-checks, that those polynomials are honest.`,
    side: () => [
      factList([
        ["trace rows (padded)", `2<sup>${stark.traceLog}</sup> = ${fmt(stark.paddedRows)}`],
        ["blowup factor", `${stark.fri.blowup_factor}`],
        ["evaluation domain", `2<sup>${stark.ldeLog}</sup> = ${fmt(2 ** stark.ldeLog)}`],
        ["fold step", `${stark.fri.fold_step} (halve per layer)`],
        ["last layer degree bound", `${stark.fri.last_layer_degree_bound}`],
        ["queries", `${stark.fri.queries}`],
        ["proof-of-work", `${stark.fri.pow_bits} bits`],
        ["proof size", `${fmt(stark.proofBytes)} bytes`],
      ]),
    ],
    question: "How can someone check a huge table by looking at only a few entries?",
    steps: [
      `<span class="term">Columns become polynomials.</span> Each column of ${stark.paddedRows} values is the list of outputs of one polynomial. The prover evaluates it at ${stark.fri.blowup_factor}× as many points (${fmt(2 ** stark.ldeLog)}) and commits to them with a Merkle root, a short fingerprint that can't be changed later.`,
      `<span class="term">"Zero on every row" becomes "divides evenly".</span> If a constraint is zero on every row, it divides exactly by a polynomial that is zero on every row, and the result is still a low-degree polynomial. If even one row is wrong, the division leaves something that isn't low degree.`,
      `<span class="term">Fold, fold, fold.</span> FRI tests low degree by folding the function in half with a random number, again and again: ${stark.friLayers.map((l) => fmt(l.size)).join(" → ")}. Each fold is committed. An honest low-degree function stays consistent all the way down.`,
      `<span class="term">Spot-check.</span> After ${stark.fri.pow_bits} bits of proof-of-work (which makes retries expensive), the verifier picks ${stark.fri.queries} random positions and checks every fold along each path. A cheater would almost certainly be caught at one of them.`,
    ],
    tryit: [
      `Step the phases with <kbd>←</kbd> <kbd>→</kbd>: commit the three tables, fold each layer, grind, then drop the query pins through the stack.`,
    ],
    keyidea: `Commit to everything, then let randomness choose what to check. That is why a ${fmt(stark.proofBytes)}-byte proof can vouch for the whole table.`,
    caveat: `Stwo works over circle domains, and its first fold maps a circle to a line. Read the figure as the folding schedule, not the proof's byte format. The plates are tapered to fit.`,
  },
  {
    key: "verify",
    module: "07-lock.mjs",
    no: "07",
    station: ["Verify", "key & statement"],
    title: "A key cut for one program, a lock for one claim",
    sub: `The last step is the only one most people see: a small program says yes or no. Every build produces a verifier with a key cut for that one program, and it opens only for the exact claim the proof was made for.`,
    side: () => [
      factList([
        ["circuit hash", `<span title="${esc(stark.key?.circuit ?? "")}">${short(stark.key?.circuit)}</span>`],
        ["AIR bundle", `<span title="${esc(stark.key?.air ?? "")}">${short(stark.key?.air)}</span>`],
        ["canonical IR", `<span title="${esc(stark.key?.ir ?? "")}">${short(stark.key?.ir)}</span>`],
        ["public x", `[${poly.x.join(", ")}]`],
        ["public result", `[${poly.result.map(fmt).join(", ")}]`],
        ["changed claim", `<code>${esc(stark.rejected)}</code>`],
        ["verdict", stark.accepted ? "accepted · tampered rejected" : "—"],
      ]),
    ],
    question: "What exactly does a 'yes' from the verifier mean?",
    steps: [
      `<span class="term">The key belongs to one program.</span> It pins the circuit's fingerprint, the AIR and the relation from chapter 01. A proof for any other program doesn't fit.`,
      `<span class="term">The statement is the claim.</span> It lists the public inputs and outputs: <code>x = [${poly.x.join(", ")}]</code> and <code>result = [${poly.result.map(fmt).join(", ")}]</code>. Private inputs never appear in it.`,
      `<span class="term">The verifier re-checks everything.</span> It checks the fingerprints, the row equations (03), the wiring sum (04) and the folds and spot-checks (06), all against this statement.`,
      `<span class="term">It really says no.</span> In the real run we kept the same proof and changed <code>result[0]</code> from ${fmt(poly.result[0])} to ${fmt(poly.result[0] + 1)}. The verifier rejected it.`,
    ],
    tryit: [
      `Watch the key go in and the bolt open, then press <kbd>T</kbd> to tamper with <code>result[0]</code>. One pin leaves the line and the lock stays shut.`,
    ],
    keyidea: `"Accepted" means a valid table exists for this exact program and this exact claim, except with a tiny, quantified chance of error.`,
    caveat: `The pins are a picture: they encode only part of each word, but the real verifier rejects a change to any bit of any public word, because the whole transcript changes. "Accepted" also doesn't prove that the compiler translated your source as you intended. S31 also doesn't currently promise zero knowledge: private inputs are absent from the statement, but proofs aren't guaranteed to hide them.`,
  },
];

export const chapters = [];
for (const def of DEFS) {
  const file = join(FIGS, def.module);
  if (!existsSync(file)) continue;
  try {
    const mod = await import(pathToFileURL(file).href);
    chapters.push({ ...def, build: mod.default, figure: { id: `fig-${def.module.replace(/^\d+-|\.mjs$/g, "")}` } });
  } catch (error) {
    console.warn(`skipping ${def.module}: ${error.message}`);
  }
}

// ---------------------------------------------------------------- the site
const MARK = `<svg class="brand-mark" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.5 16 5.5v7L9 16.5 2 12.5v-7Z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M2 5.5 9 9.5l7-4M9 9.5v7" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/></svg>`;
const SUN = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" stroke="currentColor"/></svg>`;

export function renderSite(built) {
  const live = built.map(({ chapter }) => chapter);
  const stations = DEFS.map((d) => {
    const ready = live.some((c) => c.key === d.key);
    return `<a class="station" href="#${d.key}"${ready ? "" : ' aria-disabled="true"'}><b>${d.no}</b><span>${d.station[0]}</span><small>${d.station[1]}</small></a>`;
  }).join("");
  const nav = live.map((c) => `<a href="#${c.key}">${c.no} ${c.station[0]}</a>`).join("");

  const header = `<header class="top"><a class="brand" href="#top">${MARK}<span>${esc(NAME)}</span><span class="brand-code">code name</span></a><nav aria-label="Chapters">${nav}</nav><button class="theme-toggle" type="button" data-theme-toggle aria-label="Toggle light and dark">${SUN}</button></header>`;

  const hero = `<section class="hero wrap" id="top">
<p class="eyebrow">${esc(NAME)} · a circuit language for Stwo</p>
<h1>From source to proof, <em>as a machine.</em></h1>
<p class="lede">${esc(TAGLINE)} Follow one real program, <code>f(x) = x⁵ + 3x − 7</code> over four lanes, through every stage of the compiler and the prover. Each stage is a working machine, and every number on it comes from an actual build.</p>
<div class="hero-cta"><a class="btn" href="#source">Start at the source →</a><a class="btn ghost" href="${esc(REPO)}">Repository</a></div>
<div class="primer">
<div><h3>The problem</h3><p>You ran a program and got an answer. Someone else wants to trust that answer <em>without</em> re-running it, perhaps because it's huge or because some inputs are private.</p></div>
<div><h3>The trick</h3><p>Turn the program into a table of numbers that must obey simple equations. Then prove, with a few random spot-checks, that a table obeying every equation exists. That proof is a <span class="term">STARK</span>, and Stwo is the engine that makes one.</p></div>
<div><h3>Where ${esc(NAME)} fits</h3><p>${esc(NAME)} is the language you write the program in. Its compiler builds the table, the equations and a verifier for you. The seven machines below follow one real program through every step.</p></div>
</div>
<nav class="line" aria-label="Pipeline">${stations}</nav>
<dl class="run">
<div><dt>relation nodes</dt><dd>${poly.nodes.length}</dd></div>
<div><dt>trace rows</dt><dd>${stark.rawRows} <small>→ ${stark.paddedRows}</small></dd></div>
<div><dt>fixed cells</dt><dd>${fmt(stark.fixedCells)}</dd></div>
<div><dt>proof</dt><dd>${fmt(stark.proofBytes)} <small>bytes</small></dd></div>
</dl>
<p class="run-note">One local build of <code>${esc(poly.name)}</code> with <code>--lowering ${esc(stark.trial?.lowering ?? poly.trial.lowering)}</code>: the native verifier accepted the proof and rejected a statement with <code>${esc(stark.rejected)}</code> changed. Timings are omitted because they are single observations.</p>
</section>`;

  const sections = built
    .map(({ chapter, figure }) => {
      const side = chapter.side().join("");
      return `<section class="chapter wrap" id="${chapter.key}" data-chapter="${chapter.key}">
<div class="chapter-head"><span class="chapter-no">${chapter.no}</span><div><h2>${esc(chapter.title)}</h2></div><p class="chapter-sub">${chapter.sub}</p></div>
<div class="chapter-grid">${plate(figure)}<aside class="side">${side}</aside></div>
<div class="below"><div class="lesson">
<div><span class="lesson-label">The question</span><h3>${esc(chapter.question)}</h3></div>
<div><span class="lesson-label">Step by step</span><ol class="steps">${chapter.steps.map((step) => `<li>${step}</li>`).join("")}</ol></div>
<div class="tryit"><span class="lesson-label">Try it on the machine</span><ul>${chapter.tryit.map((t) => `<li>${t}</li>`).join("")}</ul></div>
<p class="keyidea">${chapter.keyidea}</p>
</div>${chapter.caveat ? `<p class="caveat">${chapter.caveat}</p>` : ""}</div>
</section>`;
    })
    .join("");

  const foot = `<footer class="foot wrap">
<p>${esc(NAME)} is a code name. The figures are generated from the ${esc(NAME)} repository's example programs and from one local build of each; nothing on the page is typed in by hand. They are drawn with <a href="https://github.com/wheresryan22/anatomy">Anatomy</a> (MIT).</p>
<p>This page explains the mechanism. It is not a security claim. ${esc(NAME)} proofs have profile-specific limits on blinding, private witnesses and recursion; read the repository's documentation before relying on one.</p>
</footer>`;

  const pick = `function (root, bus) {
document.querySelectorAll("[data-chapter]").forEach((scope) => {
  scope.querySelector(".side")?.addEventListener("click", (e) => {
    const el = e.target.closest("[data-ref]");
    if (!el) return;
    bus.emit("pick", { chapter: scope.dataset.chapter, ref: el.dataset.ref.split(" ")[0] });
  });
});
const links = [...document.querySelectorAll('.top nav a, .station')];
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    links.forEach((a) => a.classList.toggle("is-here", a.getAttribute("href") === "#" + entry.target.id));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll(".chapter").forEach((s) => io.observe(s));
}`;

  return {
    body: header + `<main>${hero}${sections}</main>` + foot,
    lives: [
      { id: "top", chapter: "", live: pick },
      ...built.map(({ chapter, figure }) => ({ id: figure.id, chapter: chapter.key, live: figure.live })),
      ...built.filter(({ chapter }) => chapter.sideLive).map(({ chapter }) => ({ id: chapter.sideLive.id, chapter: chapter.key, live: chapter.sideLive.live })),
    ],
  };
}
