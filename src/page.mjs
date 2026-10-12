// Page shell: the HTML around the figures, the side panels and the shared bus.
import { ISO_CSS } from "../vendor/anatomy/kit/iso-kit.mjs";
import { kitScript } from "../vendor/anatomy/scripts/inline-kit.mjs";
import { NAME, TAGLINE, REPO } from "./site.mjs";

export const esc = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ------------------------------------------------------------ highlighting
const S31_KEYWORDS = new Set(["circuit", "fn", "let", "public", "private", "use", "fun", "if", "else", "struct", "return", "iterate"]);
const S31_TYPES = new Set(["m31", "u8", "u16", "u32", "u64", "u128", "i8", "i16", "i32", "i64", "i128", "Fn", "Bytes32", "UInt256", "bool"]);

function highlightS31Line(line) {
  const out = [];
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d[\d_]*(?:_m31|_u16|_u32)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(::|=>|->|\.\*|[{}()[\];,<>=+\-*.:])|(\s+)|(.)/g;
  let m;
  while ((m = re.exec(line))) {
    const [token, comment, str, num, ident, punct] = m;
    if (comment) out.push(`<span class="t-com">${esc(comment)}</span>`);
    else if (str) out.push(`<span class="t-str">${esc(str)}</span>`);
    else if (num) out.push(`<span class="t-num">${esc(num)}</span>`);
    else if (ident) {
      const cls = S31_KEYWORDS.has(ident) ? "t-key" : S31_TYPES.has(ident) ? "t-type" : ident === "std" || ident === "math" ? "t-ns" : "";
      out.push(cls ? `<span class="${cls}">${esc(ident)}</span>` : esc(ident));
    } else if (punct) out.push(`<span class="t-pun">${esc(punct)}</span>`);
    else out.push(esc(token));
  }
  return out.join("");
}

function highlightJsonLine(line) {
  return esc(line)
    .replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="t-key">$1</span>$2')
    .replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="t-str">$1</span>')
    .replace(/\b(-?\d+)\b/g, '<span class="t-num">$1</span>');
}

// A code block whose lines carry data-ref so figures can light them.
export function codeBlock({ title, lines, lang = "s31", refs = () => "", note = "" }) {
  const body = lines
    .map((line, index) => {
      const ref = refs(line, index);
      const html = lang === "s31" ? highlightS31Line(line) : lang === "json" ? highlightJsonLine(line) : esc(line);
      return `<span class="code-line"${ref ? ` data-ref="${esc(ref)}"` : ""}><span class="code-no">${index + 1}</span><span class="code-text">${html || " "}</span></span>`;
    })
    .join("");
  return `<div class="code"><div class="code-head"><span>${esc(title)}</span>${note ? `<span class="code-note">${esc(note)}</span>` : ""}</div><pre><code>${body}</code></pre></div>`;
}

export function factList(facts) {
  return `<dl class="facts">${facts
    .map(([term, value, ref]) => `<div class="fact"${ref ? ` data-ref="${esc(ref)}"` : ""}><dt>${esc(term)}</dt><dd>${value}</dd></div>`)
    .join("")}</dl>`;
}

// ----------------------------------------------------------------- the card
export function plate(figure) {
  const corner = (name, text, extra = "") => `<span class="iso-plate-corner" data-corner="${name}"${extra}>${esc(text)}</span>`;
  const swatch = (mark) => {
    if (mark === "raised" || mark === "flat" || mark === "lit") {
      const body = mark === "flat" ? "M2 6.5 8 3.5 14 6.5 8 9.5Z" : "M2 4.5 8 1.5 14 4.5 14 6 8 9 2 6Z";
      const crease = mark === "flat" ? "" : `<path class="iso-swatch-crease" d="M2 4.5 8 7.5 14 4.5"/>`;
      return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="${body}"/>${crease}</svg>`;
    }
    return `<svg class="iso-swatch" data-mark="${mark}" viewBox="0 0 16 10" aria-hidden="true"><path d="M1.5 5h13"/></svg>`;
  };
  const keys = (figure.keys ?? []).map((key) => `<span class="iso-key">${swatch(key.mark)}${esc(key.label)}</span>`).join("");
  const stage = figure.stage ?? {};
  const stageAttrs = Object.entries({ role: "group", tabindex: "0", ...stage })
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
  return `<figure class="iso-figure" id="${figure.id}" data-figure="${figure.id}"><div class="iso-plate"><div class="iso-plate-corners" aria-hidden="true">${corner("fig", figure.fig)}${corner("title", figure.title)}${corner("hint", figure.hint)}${corner("readout", figure.readout, " data-readout")}</div><div class="iso-stage"${stageAttrs}>${figure.svg}</div>${figure.controls ?? ""}</div><figcaption class="iso-legend">${keys ? `<span class="iso-keys">${keys}</span>` : ""}${figure.caption ? `<span class="iso-caption">${esc(figure.caption)}</span>` : ""}</figcaption></figure>`;
}

// ------------------------------------------------------------------ the page
const BUS = `
const S31BUS = (() => {
  const listeners = {};
  return {
    on(type, fn) { (listeners[type] ??= []).push(fn); },
    emit(type, detail) { (listeners[type] ?? []).forEach((fn) => fn(detail)); },
  };
})();
// Light the side-panel elements whose data-ref names something a figure is showing.
S31BUS.on("focus", ({ chapter, refs }) => {
  const scope = document.querySelector('[data-chapter="' + chapter + '"]');
  if (!scope) return;
  const want = new Set(refs);
  scope.querySelectorAll("[data-ref]").forEach((el) => {
    const on = el.dataset.ref.split(" ").some((ref) => want.has(ref));
    el.classList.toggle("is-on", on);
  });
});
`;

const THEME_HEAD = `(()=>{let t=null;try{t=localStorage.getItem("s31-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t;})();`;
const THEME_BODY = `
(() => {
  const root = document.documentElement;
  const apply = (t) => { root.dataset.theme = t; };
  apply(root.dataset.theme || "dark");
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    const t = root.dataset.theme === "light" ? "dark" : "light";
    apply(t);
    try { localStorage.setItem("s31-theme", t); } catch (e) {}
  });
})();
`;

export function pageHtml({ title, description, body, lives, css }) {
  const liveScript = lives
    .map(({ id, chapter, live }) => `{ const root = document.getElementById(${JSON.stringify(id)}); if (root) { try { (${live})(root, S31BUS, ${JSON.stringify(chapter)}); } catch (error) { console.error("figure ${id}", error); } } }`)
    .join("\n");
  const script = kitScript() + BUS + THEME_BODY + liveScript;
  return `<!doctype html><html lang="en" class="iso"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><script>${THEME_HEAD}</script><style>${ISO_CSS}${css}</style></head><body>${body}<script type="module">${script.replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;
}

export { NAME, TAGLINE, REPO };
