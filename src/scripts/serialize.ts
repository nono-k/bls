import { splitCharacters, type KernDocument } from "./document";

export type SerializeOptions = {
  tag?: string;
  className?: string;
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAstroText(text: string): string {
  return escapeHtml(text).replace(/[{}]/g, (char) => (char === "{" ? "{'{'}" : "{'}'}"));
}

function formatEm(em: number): string {
  return `${em}em`;
}

function assertTag(tag: string) {
  if (!/^[a-z][a-z0-9]*$/.test(tag)) throw new Error("invalid tag");
}

function assertClassName(className: string) {
  if (className !== "" && !/^[A-Za-z_][\w-]*$/.test(className)) {
    throw new Error("invalid className");
  }
}

function runHtml(text: string, em: number | null, escape: (value: string) => string): string {
  return text
    .split("\n")
    .map((part, index) => {
      const lineBreak = index === 0 ? "" : "<br/>";
      if (part.length === 0) return lineBreak;
      const body = em == null ? escape(part) : marginLeftHtml(part, em, escape);
      return `${lineBreak}${body}`;
    })
    .join("");
}

function runPug(text: string, em: number | null): string {
  return text
    .split("\n")
    .map((part, index) => {
      const lineBreak = index === 0 ? "" : "#[br]";
      if (part.length === 0) return lineBreak;
      const body = em == null ? `#{${JSON.stringify(part)}}` : marginLeftPug(part, em);
      return `${lineBreak}${body}`;
    })
    .join("");
}

function marginLeftHtml(text: string, em: number, escape: (value: string) => string): string {
  const style = `margin-left:${formatEm(em)}`;
  return splitCharacters(text)
    .map((character) => `<span style="${style}">${escape(character)}</span>`)
    .join("");
}

function marginLeftPug(text: string, em: number): string {
  const style = `margin-left:${formatEm(em)}`;
  return splitCharacters(text)
    .map((character) => `#[span(style="${style}") #{${JSON.stringify(character)}}]`)
    .join("");
}

function readOptions(options: SerializeOptions) {
  const tag = options.tag ?? "p";
  const className = options.className ?? "bls";
  assertTag(tag);
  assertClassName(className);
  return { tag, className };
}

export function toHtml(doc: KernDocument, options: SerializeOptions = {}): string {
  const { tag, className } = readOptions(options);
  const inner = doc.runs.map((run) => runHtml(run.text, run.letterSpacingEm, escapeHtml)).join("");
  const classAttr = className === "" ? "" : ` class="${escapeHtml(className)}"`;
  return `<${tag}${classAttr}>${inner}</${tag}>`;
}

export function toPug(doc: KernDocument, options: SerializeOptions = {}): string {
  const { tag, className } = readOptions(options);
  const inner = doc.runs.map((run) => runPug(run.text, run.letterSpacingEm)).join("");
  const head = className === "" ? tag : `${tag}.${className}`;
  return inner === "" ? head : `${head} ${inner}`;
}

export function toAstro(doc: KernDocument, options: SerializeOptions = {}): string {
  const { tag, className } = readOptions(options);
  const inner = doc.runs
    .map((run) => runHtml(run.text, run.letterSpacingEm, escapeAstroText))
    .join("");
  const classAttr = className === "" ? "" : ` class="${escapeHtml(className)}"`;
  return `<${tag}${classAttr}>${inner}</${tag}>`;
}
