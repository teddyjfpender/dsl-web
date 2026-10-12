// Builds the site: node build.mjs [--only=<figure-id>]
// Writes dist/index.html (every chapter) and dist/fig/<id>.html (each figure
// alone, for screenshots and the line check).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pageHtml, plate, NAME, TAGLINE } from "./src/page.mjs";
import { chapters, renderSite } from "./src/chapters.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
const css = readFileSync(join(HERE, "src", "site.css"), "utf8");

mkdirSync(join(DIST, "fig"), { recursive: true });

const built = [];
for (const chapter of chapters) {
  if (only && chapter.figure.id !== only && chapter.key !== only) continue;
  const started = Date.now();
  const figure = chapter.build();
  built.push({ chapter, figure });
  // A standalone page per figure, for verification.
  const body = `<main style="width:min(650px,100% - 32px);margin:64px auto">${plate(figure)}</main>`;
  writeFileSync(
    join(DIST, "fig", `${figure.id}.html`),
    pageHtml({ title: `${figure.fig} · ${figure.title}`, description: figure.caption, body, css, lives: [{ id: figure.id, chapter: chapter.key, live: figure.live }] }),
  );
  console.log(`built ${figure.id} in ${Date.now() - started} ms`);
}

if (!only) {
  const { body, lives } = renderSite(built);
  writeFileSync(join(DIST, "index.html"), pageHtml({ title: `${NAME} · from source to proof`, description: TAGLINE, body, css, lives }));
  console.log("wrote dist/index.html");
}
