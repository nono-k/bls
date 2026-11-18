import { describe, expect, it } from "vitest"
import {
  adjustLetterSpacing,
  applyLetterSpacing,
  clearLetterSpacing,
  createDocument,
  insertLineBreak,
  removeLineBreaks,
} from "../src/scripts/document.ts"

function expectSamePlain(doc: { plain: string; runs: { text: string }[] }) {
  expect(doc.runs.map((run) => run.text).join("")).toBe(doc.plain)
}

describe("createDocument", () => {
  it("空文字は run を持たない", () => {
    expect(createDocument("")).toEqual({ plain: "", runs: [] })
  })

  it("本文を1つの run にする", () => {
    const doc = createDocument("これは文字詰めです")
    expect(doc.runs).toEqual([{ text: "これは文字詰めです", letterSpacingEm: null }])
    expectSamePlain(doc)
  })
})

describe("applyLetterSpacing", () => {
  it("選択範囲だけ字間を付ける", () => {
    // これは = 0..3、文字詰め = 3..7、です = 7..9
    const doc = applyLetterSpacing(createDocument("これは文字詰めです"), 3, 7, -0.05)
    expect(doc.runs).toEqual([
      { text: "これは", letterSpacingEm: null },
      { text: "文字詰め", letterSpacingEm: -0.05 },
      { text: "です", letterSpacingEm: null },
    ])
    expectSamePlain(doc)
  })

  it("同じ字間が隣り合ったら1つに戻す", () => {
    const once = applyLetterSpacing(createDocument("あいうえお"), 0, 2, -0.05)
    const twice = applyLetterSpacing(once, 2, 4, -0.05)
    expect(twice.runs).toEqual([
      { text: "あいうえ", letterSpacingEm: -0.05 },
      { text: "お", letterSpacingEm: null },
    ])
  })

  it("元の文書を変更しない", () => {
    const original = createDocument("あいう")
    applyLetterSpacing(original, 0, 1, -0.05)
    expect(original.runs).toEqual([{ text: "あいう", letterSpacingEm: null }])
  })

  it("空の範囲は受け付けない", () => {
    expect(() => applyLetterSpacing(createDocument("あいう"), 1, 1, -0.05)).toThrow(RangeError)
  })

  it("絵文字の途中では切れない", () => {
    const doc = createDocument("あ😀う")
    const middle = "あ".length + 1
    expect(() => applyLetterSpacing(doc, middle, middle + 1, -0.05)).toThrow(RangeError)
  })
})

describe("adjustLetterSpacing", () => {
  it("範囲内の今の字間に足す", () => {
    const spaced = applyLetterSpacing(createDocument("あいうえお"), 0, 2, -0.05)
    const adjusted = adjustLetterSpacing(spaced, 1, 4, -0.01)
    expect(adjusted.runs).toEqual([
      { text: "あ", letterSpacingEm: -0.05 },
      { text: "い", letterSpacingEm: -0.06 },
      { text: "うえ", letterSpacingEm: -0.01 },
      { text: "お", letterSpacingEm: null },
    ])
  })
})

describe("line breaks", () => {
  it("指定位置に改行を入れる", () => {
    const doc = insertLineBreak(createDocument("あいう"), 1)
    expect(doc.plain).toBe("あ\nいう")
    expectSamePlain(doc)
  })

  it("字間の途中でも改行の前後を残す", () => {
    const spaced = applyLetterSpacing(createDocument("あいう"), 0, 3, -0.05)
    const broken = insertLineBreak(spaced, 1)
    expect(broken.runs).toEqual([
      { text: "あ", letterSpacingEm: -0.05 },
      { text: "\n", letterSpacingEm: null },
      { text: "いう", letterSpacingEm: -0.05 },
    ])
    expect(spaced.plain).toBe("あいう")
  })

  it("ブロック内の改行をすべて外す", () => {
    const broken = insertLineBreak(insertLineBreak(createDocument("あいう"), 1), 3)
    const restored = removeLineBreaks(broken, 0, broken.plain.length)
    expect(restored).toEqual({ plain: "あいう", runs: [{ text: "あいう", letterSpacingEm: null }] })
  })
})

describe("clearLetterSpacing", () => {
  it("範囲の字間を外す", () => {
    const spaced = applyLetterSpacing(createDocument("あいうえお"), 0, 5, -0.05)
    const cleared = clearLetterSpacing(spaced, 1, 4)
    expect(cleared.runs).toEqual([
      { text: "あ", letterSpacingEm: -0.05 },
      { text: "いうえ", letterSpacingEm: null },
      { text: "お", letterSpacingEm: -0.05 },
    ])
  })
})