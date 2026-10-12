# S31 website

The S31 compiler and prover drawn as working isometric machines, one per
pipeline stage: source → relation → circuit → AIR → LogUp → chip → FRI →
verification. "S31" is a code name; change `NAME` in `src/site.mjs`.

```sh
node build.mjs            # writes dist/index.html and dist/fig/<id>.html
npm run serve             # http://localhost:8080
```

No dependencies. Node 20.10+.

## Where the numbers come from

`src/model/s31.mjs` computes every value from the real S31 example programs
and build reports in `src/data/`:

- `math_polynomial4.s31`, its relation and assignment (the running example)
- `arith4_m31.s31` and its assignment (the repeated-step chip)
- `trial-poly.json`, `cost-poly.json`, `equations-poly.json`, `explain-poly.json`,
  `trial-chip.json`: produced by `s31 trial` at the commit in `S31_COMMIT`

To refresh them, run from the S31 repository:

```sh
python3 src/frontends/s31/python/s31.py trial \
  src/frontends/s31/examples/arithmetic/math_polynomial4.s31 \
  src/frontends/s31/examples/arithmetic/math_polynomial4.valid.json \
  --lowering direct-gate --out /tmp/trial-poly
```

then copy `trial-report.json` (as `trial-poly.json`, without the local
`assignment`/`package` paths), `package/cost-report.json`, `equations.json`,
`explain.json` and the statements into `src/data/`. The build throws if a
program no longer reproduces its claimed output.

## Figures

See [FIGURES.md](FIGURES.md) for the contract each figure follows and how to
verify one. The drawing kit is [Anatomy](https://github.com/wheresryan22/anatomy)
(MIT), vendored in `vendor/anatomy` at the commit in `vendor/anatomy/COMMIT`.
