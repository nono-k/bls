export {
  adjustLetterSpacing,
  applyLetterSpacing,
  clearLetterSpacing,
  createDocument,
  insertLineBreak,
  removeLineBreaks,
  spacingWarning,
} from "./document";
export type { KernDocument, Run } from "./document";
export { toAstro, toHtml, toPug } from "./serialize";
export type { SerializeOptions } from "./serialize";
