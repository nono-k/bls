import pug from "pug"
import { describe, expect, it } from "vitest"
import { applyLetterSpacing, createDocument, insertLineBreak } from "../src/scripts/document.ts"
import { toAstro, toHtml, toPug } from "../src/scripts/serialize.ts"

const doc = applyLetterSpacing(createDocument("これは文字詰めです"), 3, 7, -0.05)

describe("toHtml", () => {
  it("選択範囲だけ span にする", () => {
    expect(toHtml(doc)).toBe(
      '<p class="bls">これは<span style="margin-left:-0.05em">文</span><span style="margin-left:-0.05em">字</span><span style="margin-left:-0.05em">詰</span><span style="margin-left:-0.05em">め</span>です</p>',
    )
  })

  it("改行を br にする", () => {
    const broken = insertLineBreak(createDocument("あいう"), 1)
    expect(toHtml(broken)).toBe('<p class="bls">あ<br/>いう</p>')
    expect(pug.render(toPug(broken))).toBe(toHtml(broken))
  })

  it("記号をエスケープする", () => {
    expect(toHtml(createDocument(`A<B>&"`))).toBe('<p class="bls">A&lt;B&gt;&amp;&quot;</p>')
  })
})

describe("toPug", () => {
  it("Pug を描画すると HTML と一致する", () => {
    expect(pug.render(toPug(doc))).toBe(toHtml(doc))
  })

  it("空の文書では段落の中に空白を入れない", () => {
    expect(pug.render(toPug(createDocument("")))).toBe('<p class="bls"></p>')
  })
})

describe("toAstro", () => {
  it("波括弧を式にしない", () => {
    const source = createDocument("a{b}c")
    expect(toAstro(source)).toBe("<p class=\"bls\">a{'{'}b{'}'}c</p>")
    const restored = toAstro(source).replaceAll("{'{'}", "{").replaceAll("{'}'}", "}")
    expect(restored).toBe(toHtml(source))
  })
})
