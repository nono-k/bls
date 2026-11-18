export type Run = {
  text: string;
  letterSpacingEm: number | null;
}

export type KernDocument = {
  plain: string;
  runs: Run[];
}

export function createDocument(text: string): KernDocument {
  return {
    plain: text,
    runs: text.length === 0 ? [] : [{ text, letterSpacingEm: null }]
  }
}

function assertCharBoundary(text: string, index: number) {
  if (index < 0 || index > text.length) {
    throw new RangeError('offset is outside the text');
  }

  if (index === 0 || index === text.length) return;

  const before = text.charCodeAt(index - 1);
  const after = text.charCodeAt(index);
  const splitsSurrogate =
    before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;

  if (splitsSurrogate) {
    throw new RangeError('offset splits a surrogate pair');
  }
}

export function splitCharacters(text: string): string[] {
  const characters: string[] = [];
  for (let index = 0; index < text.length; ) {
    const before = text.charCodeAt(index);
    const after = text.charCodeAt(index + 1);
    const pair =
      before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
    const size = pair ? 2 : 1;
    characters.push(text.slice(index, index + size));
    index += size;
  }
  return characters;
}

function normalizeEm(em: number): number {
  if (!Number.isFinite(em)) {
    throw new TypeError('letterSpacingEm must be a finite number');
  }

  return Math.round(em * 1000) / 1000;
}

function splitAt(runs: Run[], index: number): Run[] {
  let offset = 0;
  const next: Run[] = [];
  for (const run of runs) {
    const end = offset + run.text.length;
    if (index > offset && index < end) {
      const cut = index - offset;

      next.push({
        text: run.text.slice(0, cut),
        letterSpacingEm: run.letterSpacingEm
      });
      next.push({
        text: run.text.slice(cut),
        letterSpacingEm: run.letterSpacingEm
      });
    } else {
      next.push({
        text: run.text,
        letterSpacingEm: run.letterSpacingEm
      });
    }
    offset = end;
  }
  return next;
}

function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    if (run.text.length === 0) continue;
    const prev = merged.at(-1);
    if (prev && prev.letterSpacingEm === run.letterSpacingEm) {
      prev.text += run.text;
    } else {
      merged.push({
        text: run.text,
        letterSpacingEm: run.letterSpacingEm
      });
    }
  }
  return merged;
}

function setLetterSpacing(
  doc: KernDocument,
  start: number,
  end: number,
  value: number | null,
): KernDocument {
  assertCharBoundary(doc.plain, start);
  assertCharBoundary(doc.plain, end);

  if (start >= end) throw new RangeError('empty range');

  let offset = 0;
  const runs = splitAt(splitAt(doc.runs, start), end).map((run) => {
    const runEnd = offset + run.text.length;
    const inside = offset >= start && runEnd <= end;
    offset = runEnd;
    return inside ? { text: run.text, letterSpacingEm: value } : run;
  });

  return { plain: doc.plain, runs: mergeRuns(runs) };
}

export function applyLetterSpacing(
  doc: KernDocument,
  start: number,
  end: number,
  em: number,
): KernDocument {
  return setLetterSpacing(doc, start, end, normalizeEm(em));
}

export function clearLetterSpacing(
  doc: KernDocument,
  start: number,
  end: number,
): KernDocument {
  return setLetterSpacing(doc, start, end, null);
}

export function insertLineBreak(doc: KernDocument, index: number): KernDocument {
  assertCharBoundary(doc.plain, index);
  const plain = `${doc.plain.slice(0, index)}\n${doc.plain.slice(index)}`;
  if (doc.runs.length === 0) {
    return { plain, runs: [{ text: "\n", letterSpacingEm: null }] };
  }

  let offset = 0;
  let inserted = false;
  const runs: Run[] = [];
  for (const run of doc.runs) {
    const end = offset + run.text.length;
    if (!inserted && index >= offset && index <= end) {
      const cut = index - offset;
      const before = run.text.slice(0, cut);
      const after = run.text.slice(cut);
      if (before.length > 0) runs.push({ text: before, letterSpacingEm: run.letterSpacingEm });
      runs.push({ text: "\n", letterSpacingEm: null });
      if (after.length > 0) runs.push({ text: after, letterSpacingEm: run.letterSpacingEm });
      inserted = true;
    } else {
      runs.push({ text: run.text, letterSpacingEm: run.letterSpacingEm });
    }
    offset = end;
  }

  return { plain, runs: mergeRuns(runs) };
}

export function removeLineBreaks(
  doc: KernDocument,
  start: number,
  end: number,
): KernDocument {
  assertCharBoundary(doc.plain, start);
  assertCharBoundary(doc.plain, end);
  if (start >= end) return doc;

  let offset = 0;
  let plain = "";
  const runs: Run[] = [];
  for (const run of doc.runs) {
    let text = "";
    for (let index = 0; index < run.text.length; ) {
      const size = characterSize(run.text, index);
      const piece = run.text.slice(index, index + size);
      if (!(piece === "\n" && offset >= start && offset < end)) {
        text += piece;
        plain += piece;
      }
      offset += size;
      index += size;
    }
    if (text.length > 0) runs.push({ text, letterSpacingEm: run.letterSpacingEm });
  }

  return { plain, runs: mergeRuns(runs) };
}

function characterSize(text: string, index: number): number {
  const before = text.charCodeAt(index);
  const after = text.charCodeAt(index + 1);
  const pair = before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
  return pair ? 2 : 1;
}

export function adjustLetterSpacing(
  doc: KernDocument,
  start: number,
  end: number,
  delta: number,
): KernDocument {
  if (!Number.isFinite(delta)) {
    throw new TypeError("delta must be a finite number");
  }

  let offset = 0;
  let next = doc;
  for (const run of doc.runs) {
    const runEnd = offset + run.text.length;
    const from = Math.max(offset, start);
    const to = Math.min(runEnd, end);
    if (from < to) {
      next = applyLetterSpacing(next, from, to, (run.letterSpacingEm ?? 0) + delta);
    }
    offset = runEnd;
  }
  return next;
}

export function spacingWarning(em: number): string | undefined {
  if (em < -0.1 || em > 0.2) {
    return "字間は-0.1emから0.2emの間で指定してください";
  }
  return undefined;
}