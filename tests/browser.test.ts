// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { applyLetterSpacing, createDocument, insertLineBreak } from "../src/scripts/document.ts"
import { offsetsFromSelection, renderDocument } from "../src/scripts/browser.ts"

describe("browser selection", () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it("描画した選択範囲を文書のオフセットにする", () => {
    const parent = document.createElement("div")
    document.body.append(parent)
    const paragraph = renderDocument(parent, createDocument("これは文字詰めです"))
    const text = paragraph.firstChild
    if (!text) throw new Error("missing text")

    const range = document.createRange()
    range.setStart(text, 3)
    range.setEnd(text, 7)
    const selection = document.getSelection()
    if (!selection) throw new Error("missing selection")
    selection.removeAllRanges()
    selection.addRange(range)

    const offsets = offsetsFromSelection(paragraph, selection)
    expect(offsets).toEqual({ start: 3, end: 7 })

    const next = applyLetterSpacing(
      createDocument("これは文字詰めです"),
      offsets!.start,
      offsets!.end,
      -0.05,
    )
    renderDocument(parent, next)
    const rendered = parent.firstElementChild
    expect(rendered).not.toBeNull()
    expect(rendered?.textContent).toBe("これは文字詰めです")
    const spans = [...parent.querySelectorAll("span")].filter((span) => span.style.marginLeft)
    expect(spans.map((span) => span.textContent).join("")).toBe("文字詰め")
    expect(spans.map((span) => span.style.marginLeft)).toEqual(["-0.05em", "-0.05em", "-0.05em", "-0.05em"])
  })

  it("改行の br をオフセットに数える", () => {
    const parent = document.createElement("div")
    document.body.append(parent)
    const doc = insertLineBreak(createDocument("あいう"), 1)
    const paragraph = renderDocument(parent, doc)
    expect(paragraph.querySelectorAll("br")).toHaveLength(1)

    const selection = document.getSelection()
    if (!selection) throw new Error("missing selection")
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    selection.removeAllRanges()
    selection.addRange(range)

    expect(offsetsFromSelection(paragraph, selection)).toEqual({ start: 0, end: doc.plain.length })
  })
})
