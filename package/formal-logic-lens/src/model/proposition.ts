import { collectPredicateArities, findFreeVariables, FormulaNode } from '../formula/ast.js'
import { parseFormula } from '../formula/parser.js'
import { EvidenceAnchor, FormalPropositionSnapshot, formalPropositionSnapshotSchema } from '../schema.js'

/**
 * A FormalProposition is a single statement explicitly asserted in a text, translated into a
 * formal-logic formula.
 * It holds the proposition's id, natural-language content, the verbatim evidence anchor that
 * grounds it in the original text, and the formula (stored as source string, parsed and
 * validated as a closed formula on construction).
 * It supports keyword matching, predicate-arity inspection and snapshot export; all accessors
 * return copies.
 */
export class FormalProposition {
  private readonly 命题标识: string
  private readonly 命题内容: string
  private readonly 原文依据: EvidenceAnchor
  private readonly 公式源码: string
  private readonly 公式语法树: FormulaNode

  public constructor(snapshot: FormalPropositionSnapshot) {
    let 校验值 = formalPropositionSnapshotSchema.parse(snapshot)
    let 语法树 = parseFormula(校验值.formula)
    let 自由变量 = findFreeVariables(语法树)
    if (自由变量.length > 0) {
      throw new Error(`命题公式必须是闭公式，存在未被量词绑定的自由变量: ${自由变量.join(', ')}`)
    }
    this.命题标识 = 校验值.id
    this.命题内容 = 校验值.content
    this.原文依据 = { ...校验值.evidence }
    this.公式源码 = 校验值.formula
    this.公式语法树 = 语法树
  }

  public getId(): string {
    return this.命题标识
  }

  public getContent(): string {
    return this.命题内容
  }

  public getEvidence(): EvidenceAnchor {
    return { ...this.原文依据 }
  }

  public getFormulaSource(): string {
    return this.公式源码
  }

  /**
   * Returns the parsed formula AST. The tree is re-parsed on every call so callers can never
   * mutate the proposition's internal state.
   */
  public getFormulaAst(): FormulaNode {
    return parseFormula(this.公式源码)
  }

  /**
   * Returns the predicate symbols used by this proposition's formula together with their
   * arities (0 for bare atomic propositions). The map is rebuilt on every call.
   */
  public getPredicateArities(): Map<string, number> {
    return collectPredicateArities(this.公式语法树)
  }

  /**
   * Case-insensitive substring match against the proposition content and formula source.
   * A blank keyword matches every proposition.
   */
  public matchesKeyword(keyword: string): boolean {
    let 归一化关键词 = keyword.trim().toLowerCase()
    if (归一化关键词.length === 0) {
      return true
    }
    return this.命题内容.toLowerCase().includes(归一化关键词) || this.公式源码.toLowerCase().includes(归一化关键词)
  }

  public toSnapshot(): FormalPropositionSnapshot {
    return { id: this.命题标识, content: this.命题内容, evidence: { ...this.原文依据 }, formula: this.公式源码 }
  }
}
