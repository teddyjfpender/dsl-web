# Figure contract

Every chapter of the site is one machine, drawn with the vendored
[Anatomy](vendor/anatomy/SKILL.md) kit (MIT, see `vendor/anatomy/LICENSE`).
Read `vendor/anatomy/SKILL.md` and `vendor/anatomy/references/craft.md` before
drawing; `vendor/anatomy/references/kit.md` is the API.

## The one rule

**The object is the explanation.** Invent a real, well-made machine whose
working *is* the stage of the pipeline. No boxes, arrows or floating labels.
Words go in the card corners, the legend and the caption.

## Truth

Every number a figure shows, and every value that moves a part, comes from
`src/model/s31.mjs` (`MODEL`). That module computes from the real S31 example
programs and real build reports in `src/data/`. Never type a number into a
figure that the model can give you. If you need a derived value, compute it in
your figure module from `MODEL`.

## Module shape

A figure is `src/figures/NN-name.mjs`. Its id is `fig-name`. It exports a
default function that returns:

```js
{
  id: "fig-name",            // must match the file name
  fig: "Fig N",
  title: "Short title",       // top-right corner, rendered uppercase
  hint: "Hover … · ← →",      // bottom-left corner
  readout: "initial text",    // bottom-right; live code rewrites it
  stage: { "aria-label": "…" },
  keys: [{ mark: "lit" | "raised" | "flat" | "edge" | "dim" | "dotted" | "dashed" | "red" | "green", label: "…" }],
  caption: "One or two true sentences.",
  controls: "",              // optional HTML under the drawing (buttons, see .fig-controls)
  svg,                        // k.figureSvg({ width: 600, height: 380, label, body })
  live,                       // source of `function (root, bus, chapter) { … }`
}
```

`root` is the `<figure>` element. Query everything inside it
(`root.querySelector(".iso-stage svg")`, `root.querySelector("[data-readout]")`).
Every figure shares one page, so never use `document.querySelector` for your
own parts. The kit (`translateAlong`, `lineOnTop`, `iso`, …) is global on the
page. `LIVE_HELPERS` from `parts.mjs` gives `clamp`, `follow`, `stillQuery` and
`loop(root, tick)`. Paste it into your live source as the first line.

## The bus

- `bus.emit("focus", { chapter, refs: ["row:3", "wire:x"] })` lights the side
  panel elements whose `data-ref` contains any of those refs. Emit only when
  the focus changes.
- `bus.on("pick", ({ chapter: c, ref }) => …)` fires when a reader clicks a
  side panel element. Ignore it when `c !== chapter`. Jump the figure to that
  ref.

Refs per chapter (see `src/chapters.mjs` for the panels):

| chapter | refs |
| --- | --- |
| source | `line:N`, `node:name` |
| circuit | `wire:name` |
| air | `row:N` |
| logup | `tuple:address`, `wire:name` |
| chip | `round:N` |
| fri, verify | none required |

## Behaviour

Calm, eased, time-based motion. An idle tour runs when nobody touches the
figure and pauses after interaction, then resumes after a few seconds. Arrow
keys work when the stage has focus. The loop stops offscreen (`loop` does this)
and the figure goes still and fully readable under `prefers-reduced-motion`.

## Verify

```sh
node build.mjs --only=fig-name
node vendor/anatomy/scripts/capture.mjs dist/fig/fig-name.html --out shots/fig-name.png --width 1000 --scale 2
node vendor/anatomy/scripts/capture.mjs dist/fig/fig-name.html --out shots/fig-name-light.png --width 1000 --scale 2 --theme light
node vendor/anatomy/scripts/capture.mjs dist/fig/fig-name.html --out shots/fig-name-phone.png --width 390
node vendor/anatomy/scripts/lines.mjs dist/fig/fig-name.html --out shots/fig-name-lines.png
```

Read every PNG. The console must be clean, the line check should print
`line ends: 0`, and a 4× zoom (`--zoom x,y,w,h`) of every junction should
hold up.
