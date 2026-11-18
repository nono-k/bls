import { splitCharacters, type KernDocument } from "./document";
import type { SerializeOptions } from "./serialize";

export function renderDocument(
  parent: HTMLElement,
  doc: KernDocument,
  options: SerializeOptions = {},
): HTMLElement {
  const tag = options.tag ?? "p";
  const className = options.className ?? "bls";
  const el = document.createElement(tag);
  if (className !== "") el.className = className;

  paintRuns(el, doc.runs);

  parent.replaceChildren(el);
  return el;
}

export function paintRuns(host: HTMLElement, runs: KernDocument["runs"]) {
  host.replaceChildren();
  for (const run of runs) appendRun(host, run.text, run.letterSpacingEm);
}

function appendRun(host: HTMLElement, text: string, em: number | null) {
  const parts = text.split("\n");
  for (let index = 0; index < parts.length; index += 1) {
    if (index > 0) host.append(document.createElement("br"));
    const part = parts[index] ?? "";
    if (part.length === 0) continue;
    if (em == null) {
      host.append(document.createTextNode(part));
      continue;
    }
    for (const character of splitCharacters(part)) {
      const span = document.createElement("span");
      span.style.marginLeft = `${em}em`;
      span.textContent = character;
      host.append(span);
    }
  }
}

export function offsetsFromSelection(
  root: HTMLElement,
  selection: Selection,
): { start: number; end: number } | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

  const start = pointOffset(root, range.startContainer, range.startOffset);
  const end = pointOffset(root, range.endContainer, range.endOffset);
  if (start === end) return null;
  return start < end ? { start, end } : { start: end, end: start };
}

export function caretOffset(root: HTMLElement, selection: Selection): number | null {
  const node = selection.focusNode;
  if (!node || !root.contains(node)) return null;
  return pointOffset(root, node, selection.focusOffset);
}

export function rangeForOffsets(root: HTMLElement, start: number, end: number): Range | null {
  const from = locateOffset(root, start);
  const to = locateOffset(root, end);
  if (!from || !to) return null;
  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

function pointOffset(root: HTMLElement, container: Node, offset: number): number {
  const probe = document.createRange();
  probe.selectNodeContents(root);
  probe.setEnd(container, offset);
  return probe.toString().length + breakCount(probe);
}

function locateOffset(root: HTMLElement, index: number): { node: Node; offset: number } | null {
  let cursor = 0;

  function visit(node: Node): { node: Node; offset: number } | null {
    if (node instanceof Element) {
      if (node.classList.contains("bls-selection") || node.classList.contains("bls-caret")) {
        return null;
      }
      if (node instanceof HTMLBRElement) {
        const parent = node.parentNode;
        if (!parent) return null;
        const at = childIndex(parent, node);
        if (cursor === index) return { node: parent, offset: at };
        cursor += 1;
        if (cursor === index) return { node: parent, offset: at + 1 };
        return null;
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      const length = text.data.length;
      if (index >= cursor && index <= cursor + length) {
        return { node: text, offset: index - cursor };
      }
      cursor += length;
      return null;
    }

    for (const child of node.childNodes) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  }

  return visit(root);
}

function childIndex(parent: Node, child: Node): number {
  let index = 0;
  for (const node of parent.childNodes) {
    if (node === child) return index;
    index += 1;
  }
  return index;
}

function breakCount(range: Range): number {
  return range.cloneContents().querySelectorAll("br").length;
}
