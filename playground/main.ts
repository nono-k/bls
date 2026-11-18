import "../src/bls.css";
import {
  adjustLetterSpacing,
  applyLetterSpacing,
  clearLetterSpacing,
  createDocument,
  insertLineBreak,
  removeLineBreaks,
  toAstro,
  toHtml,
  toPug,
  type KernDocument,
} from "../src/scripts/index.ts";
import { paintRuns, rangeForOffsets } from "../src/scripts/browser.ts";

const caretColor = document.querySelector<HTMLInputElement>("#caret-color");
const spacing = document.querySelector<HTMLInputElement>("#spacing");
const status = document.querySelector<HTMLParagraphElement>("#status");
const format = document.querySelector<HTMLSelectElement>("#format");
const output = document.querySelector<HTMLTextAreaElement>("#output");
const save = document.querySelector<HTMLButtonElement>("#save");
const showUi = document.querySelector<HTMLButtonElement>("#show-ui");
const panel = document.querySelector<HTMLElement>(".panel");
const TEXT_HOST = "h1,h2,h3,h4,h5,h6,p,li,a,button,figcaption,blockquote,td,th,dt,dd,span,small,strong,em,cite,time,address,label";

function textHosts(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(TEXT_HOST)].filter((el) => {
    if (el.closest(".panel, #show-ui")) return false;
    if (!(el.textContent ?? "").trim()) return false;
    return ![...el.querySelectorAll<HTMLElement>(TEXT_HOST)].some((child) => (child.textContent ?? "").trim().length > 0);
  });
}

const hosts = textHosts();

if (!caretColor || !spacing || !status || !format || !output || !save || !showUi || !panel) {
  throw new Error("preview markup is incomplete");
}

const CARET_COLOR_KEY = "bls-caret-color";
const storedCaretColor = localStorage.getItem(CARET_COLOR_KEY);
if (storedCaretColor && /^#[0-9a-fA-F]{6}$/.test(storedCaretColor)) {
  caretColor.value = storedCaretColor;
  document.documentElement.style.setProperty("--bls-caret", storedCaretColor);
}

caretColor.addEventListener("input", () => {
  document.documentElement.style.setProperty("--bls-caret", caretColor.value);
  localStorage.setItem(CARET_COLOR_KEY, caretColor.value);
});

const FINE_STEP = 0.01;
const COARSE_STEP = 0.1;
const COMPLETE_NUMBER = /^-?\d+(\.\d+)?$/;

type Target = {
  host: HTMLElement;
  start: number;
  end: number;
  caret: number;
};

const docs = new Map<HTMLElement, KernDocument>();
let target: Target | null = null;

for (const host of hosts) {
  docs.set(host, createDocument(host.textContent ?? ""));
}

function spacingInRange(doc: KernDocument, start: number, end: number): number | null | "mixed" {
  let found: number | null | undefined;
  let offset = 0;
  for (const run of doc.runs) {
    const runEnd = offset + run.text.length;
    if (runEnd > start && offset < end && run.text.replaceAll("\n", "").length > 0) {
      if (found === undefined) found = run.letterSpacingEm;
      else if (found !== run.letterSpacingEm) return "mixed";
    }
    offset = runEnd;
  }
  return found === undefined ? null : found;
}

function paint(host: HTMLElement, doc: KernDocument) {
  host.classList.add("bls");
  paintRuns(host, doc.runs);
}

function placeCaret(host: HTMLElement, caret: number) {
  const plain = docs.get(host)?.plain ?? "";
  const end = Math.min(caret + characterSize(plain, caret), plain.length);
  const probe = rangeForOffsets(host, caret, end);
  const rect = probe?.getBoundingClientRect();
  const fallback = rangeForOffsets(host, Math.max(0, caret - 1), caret)?.getBoundingClientRect();
  const box = rect && rect.height > 0 ? rect : fallback;
  if (!box || box.height === 0) return;
  const hostRect = host.getBoundingClientRect();
  const line = document.createElement("span");
  line.className = "bls-caret";
  line.setAttribute("aria-hidden", "true");
  const atEnd = rect == null || rect.height === 0;
  line.style.left = `${(atEnd ? box.right : box.left) - hostRect.left}px`;
  line.style.top = `${box.top - hostRect.top}px`;
  line.style.height = `${box.height}px`;
  host.append(line);
}

function placeSelection(host: HTMLElement, start: number, end: number) {
  const range = rangeForOffsets(host, start, end);
  if (!range) return;
  const lines: { left: number; right: number; top: number; bottom: number }[] = [];
  for (const rect of range.getClientRects()) {
    if (rect.width < 2 || rect.height < 2) continue;
    const line = lines.find((item) => Math.abs(item.top - rect.top) < rect.height / 2);
    if (!line) {
      lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
      continue;
    }
    line.left = Math.min(line.left, rect.left);
    line.right = Math.max(line.right, rect.right);
    line.top = Math.min(line.top, rect.top);
    line.bottom = Math.max(line.bottom, rect.bottom);
  }
  const hostRect = host.getBoundingClientRect();
  for (const line of lines) {
    const box = document.createElement("span");
    box.className = "bls-selection";
    box.setAttribute("aria-hidden", "true");
    box.style.left = `${line.left - hostRect.left - 4}px`;
    box.style.top = `${line.top - hostRect.top - 3}px`;
    box.style.width = `${line.right - line.left + 8}px`;
    box.style.height = `${line.bottom - line.top + 6}px`;
    host.append(box);
  }
}

function characterSize(text: string, index: number): number {
  const before = text.charCodeAt(index);
  const after = text.charCodeAt(index + 1);
  const pair = before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
  return pair ? 2 : 1;
}

function nextCharacter(text: string, index: number): { start: number; end: number } | null {
  let cursor = index;
  while (cursor < text.length && text[cursor] === "\n") cursor += 1;
  if (cursor >= text.length) return null;
  return { start: cursor, end: cursor + characterSize(text, cursor) };
}

function previousCharacter(text: string, index: number): { start: number; end: number } | null {
  let cursor = 0;
  let previous: { start: number; end: number } | null = null;
  while (cursor < text.length && cursor < index) {
    if (text[cursor] === "\n") {
      cursor += 1;
      continue;
    }
    const end = cursor + characterSize(text, cursor);
    previous = { start: cursor, end };
    cursor = end;
  }
  return previous;
}

function characterAtPoint(
  host: HTMLElement,
  doc: KernDocument,
  x: number,
  y: number,
): { start: number; end: number } | null {
  let index = 0;
  let nearest: { start: number; end: number; distance: number } | null = null;
  while (index < doc.plain.length) {
    const found = nextCharacter(doc.plain, index);
    if (!found) break;
    index = found.end;
    const range = rangeForOffsets(host, found.start, found.end);
    const rect = range?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) continue;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return found;
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    const distance = dx * dx + dy * dy;
    if (!nearest || distance < nearest.distance) nearest = { ...found, distance };
  }
  return nearest ? { start: nearest.start, end: nearest.end } : null;
}

function selectText(host: HTMLElement, caret: number) {
  const doc = docs.get(host);
  if (!doc) return;
  const character = nextCharacter(doc.plain, caret) ?? previousCharacter(doc.plain, Math.min(caret, doc.plain.length));
  target = { host, start: 0, end: doc.plain.length, caret: character?.start ?? 0 };
  const label = character ? doc.plain.slice(character.start, character.end) : "";
  status.textContent = label ? `「${label}」を、Alt と矢印で詰められます` : "テキスト全体を選択しています";
  render();
  document.getSelection()?.removeAllRanges();
}

function activeCharacter(doc: KernDocument): { start: number; end: number } | null {
  if (!target) return null;
  return nextCharacter(doc.plain, target.caret);
}

function moveSelection(direction: "left" | "right" | "up" | "down") {
  const doc = activeDoc();
  if (!target || !doc) return;
  const index = hosts.indexOf(target.host);
  if (direction === "up" || direction === "down") {
    const host = hosts[index + (direction === "up" ? -1 : 1)];
    if (host) selectText(host, 0);
    return;
  }
  const current = activeCharacter(doc);
  if (!current) return;
  if (direction === "left") {
    const previous = previousCharacter(doc.plain, current.start);
    if (previous) {
      selectText(target.host, previous.start);
      return;
    }
    const host = hosts[index - 1];
    const previousDoc = host ? docs.get(host) : undefined;
    const last = previousDoc ? previousCharacter(previousDoc.plain, previousDoc.plain.length) : null;
    if (host) selectText(host, last?.start ?? 0);
    return;
  }
  const next = nextCharacter(doc.plain, current.end);
  if (next) {
    selectText(target.host, next.start);
    return;
  }
  const host = hosts[index + 1];
  if (host) selectText(host, 0);
}

function activeDoc(): KernDocument | null {
  if (!target) return null;
  return docs.get(target.host) ?? null;
}

function refreshOutput() {
  const doc = activeDoc();
  if (!target || !doc) {
    output.value = "";
    return;
  }
  const options = { tag: target.host.tagName.toLowerCase(), className: "bls" };
  const write = format.value === "pug" ? toPug : format.value === "astro" ? toAstro : toHtml;
  output.value = write(doc, options);
}

function syncPanel() {
  const doc = activeDoc();
  const character = doc ? activeCharacter(doc) : null;
  const hasTarget = character != null;
  spacing.disabled = !hasTarget;
  if (!target || !doc || !character) {
    if (document.activeElement !== spacing) {
      spacing.value = "";
      spacing.placeholder = "";
    }
    return;
  }
  if (document.activeElement === spacing) return;
  const current = spacingInRange(doc, character.start, character.end);
  if (current === "mixed") {
    spacing.value = "";
    spacing.placeholder = "混在";
    return;
  }
  spacing.placeholder = current == null ? "未指定" : "";
  spacing.value = current == null ? "" : String(current);
}

function render() {
  for (const host of hosts) {
    host.classList.remove("is-active", "has-range");
  }
  for (const [host, doc] of docs) paint(host, doc);
  const doc = activeDoc();
  if (target && doc && target.end <= doc.plain.length) {
    target.host.classList.add("is-active");
    if (target.start < target.end) {
      target.host.classList.add("has-range");
      placeSelection(target.host, target.start, target.end);
    }
    placeCaret(target.host, Math.min(target.caret, doc.plain.length));
  }
  refreshOutput();
  syncPanel();
}

function applyValue(em: number) {
  const doc = activeDoc();
  const character = doc ? activeCharacter(doc) : null;
  if (!target || !doc || !character) return;
  docs.set(target.host, applyLetterSpacing(doc, character.start, character.end, em));
  status.textContent = `字間を ${em}em にしました`;
  render();
}

function stepFor(event: KeyboardEvent): number {
  return event.shiftKey || event.metaKey || event.ctrlKey ? COARSE_STEP : FINE_STEP;
}

function typingTarget(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || active instanceof HTMLInputElement;
}

function toggleUi() {
  const hidden = !panel.hidden;
  panel.hidden = hidden;
  showUi.hidden = !hidden;
  status.textContent = hidden ? "UI を隠しました" : "UI を表示しました";
}

async function saveOutput() {
  refreshOutput();
  const text = output.value;
  if (text.length === 0) {
    status.textContent = "保存する文字がありません";
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "書き出しをコピーしました";
  } catch {
    output.focus();
    output.select();
    status.textContent = "書き出しを選択しました";
  }
}

function caretWithoutBreaks(plain: string, caret: number): number {
  let next = 0;
  for (let index = 0; index < caret && index < plain.length; index += 1) {
    if (plain[index] !== "\n") next += 1;
  }
  return next;
}

document.addEventListener("pointerup", (event) => {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest(".panel, #show-ui")) return;
  if (event.metaKey || event.ctrlKey) return;

  const fromPoint = document.caretRangeFromPoint(event.clientX, event.clientY);
  const host = hosts.find((item) => fromPoint != null && item.contains(fromPoint.startContainer));
  const doc = host ? docs.get(host) : undefined;
  if (!host || !doc) return;
  const character = characterAtPoint(host, doc, event.clientX, event.clientY);
  if (!character) return;
  selectText(host, character.start);
});

document.addEventListener("click", (event) => {
  if (event.metaKey || event.ctrlKey) return;
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest("a");
  if (!link || link.closest(".panel")) return;
  event.preventDefault();
});

spacing.addEventListener("input", () => {
  const raw = spacing.value.trim();
  if (!COMPLETE_NUMBER.test(raw)) return;
  applyValue(Number(raw));
});

format.addEventListener("change", refreshOutput);
save.addEventListener("click", () => {
  void saveOutput();
});
showUi.addEventListener("click", toggleUi);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    toggleUi();
    return;
  }
  if (
    !event.altKey &&
    !typingTarget() &&
    target &&
    (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown")
  ) {
    event.preventDefault();
    const direction =
      event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : event.key === "ArrowUp" ? "up" : "down";
    moveSelection(direction);
    return;
  }
  if (!event.altKey || typingTarget()) return;
  if (event.repeat && event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Enter") return;

  if (event.code === "KeyS" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    void saveOutput();
    return;
  }
  if (event.code === "KeyB" && !event.shiftKey) {
    event.preventDefault();
    document.body.classList.toggle("is-gray");
    status.textContent = document.body.classList.contains("is-gray") ? "背景をグレーにしました" : "背景を戻しました";
    return;
  }
  if (event.code === "KeyM" && !event.shiftKey) {
    event.preventDefault();
    document.body.classList.toggle("hide-menu");
    status.textContent = document.body.classList.contains("hide-menu") ? "メニューを隠しました" : "メニューを表示しました";
    return;
  }
  if (event.code === "KeyG" && !event.shiftKey) {
    event.preventDefault();
    document.body.classList.toggle("show-guides");
    status.textContent = document.body.classList.contains("show-guides") ? "ガイドを表示しました" : "ガイドを隠しました";
    return;
  }

  const doc = activeDoc();
  if (!target || !doc) return;

  if (event.code === "Digit0" && !event.shiftKey) {
    event.preventDefault();
    if (doc.plain.length === 0) return;
    docs.set(target.host, clearLetterSpacing(doc, 0, doc.plain.length));
    status.textContent = "このブロックの字間を外しました";
    render();
    return;
  }

  if (event.key === "Enter" && event.shiftKey) {
    event.preventDefault();
    const next = removeLineBreaks(doc, 0, doc.plain.length);
    const caret = caretWithoutBreaks(doc.plain, target.caret);
    docs.set(target.host, next);
    const character = nextCharacter(next.plain, caret) ?? previousCharacter(next.plain, caret);
    selectText(target.host, character?.start ?? caret);
    status.textContent = "このブロックの改行を外しました";
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const caret = Math.min(target.caret, doc.plain.length);
    const next = insertLineBreak(doc, caret);
    docs.set(target.host, next);
    const character = nextCharacter(next.plain, caret + 1) ?? previousCharacter(next.plain, caret + 1);
    selectText(target.host, character?.start ?? caret + 1);
    status.textContent = "改行を入れました";
    return;
  }

  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const character = activeCharacter(doc);
  if (!character) return;
  event.preventDefault();
  const delta = (event.key === "ArrowLeft" ? -1 : 1) * stepFor(event);
  const next = adjustLetterSpacing(doc, character.start, character.end, delta);
  docs.set(target.host, next);
  const current = spacingInRange(next, character.start, character.end);
  status.textContent =
    typeof current === "number" ? `字間を ${current}em にしました` : "選択した文字の字間を変えました";
  render();
});

render();
