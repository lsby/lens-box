import { ExtractionProvenance, FormalLogicDocumentSnapshot, formalLogicDocumentSnapshotSchema } from '../schema.js'
import { FormalProposition } from './proposition.js'

/**
 * A predicate symbol used somewhere in the document, together with the arity it is used with.
 */
export type PredicateSymbol = { symbol: string; arity: number }

/**
 * A FormalLogicDocument is the complete result of analyzing one text from the formal-logic
 * perspective. It aggregates the original text, the formalized propositions, the source label,
 * the recording timestamp and the extraction provenance (model and prompt version).
 *
 * Construction re-validates every evidence anchor against the original text, re-parses every
 * formula (enforcing the closed-formula constraint) and enforces document-wide predicate arity
 * consistency, so a document restored from a snapshot is guaranteed to satisfy the same
 * invariants as a freshly built one.
 *
 * The document deliberately offers no contradiction detection, truth-table evaluation or
 * inference analysis; such further reasoning is left to the caller (e.g. an LLM) on demand.
 */
export class FormalLogicDocument {
  private readonly 篇章标识: string
  private readonly 原文: string
  private readonly 命题列表: FormalProposition[]
  private readonly 谓词元数表: Map<string, number>
  private readonly 来源标签: string | null
  private readonly 记录时间: number
  private readonly 提取来源: ExtractionProvenance

  public constructor(snapshot: FormalLogicDocumentSnapshot) {
    let 校验值 = formalLogicDocumentSnapshotSchema.parse(snapshot)

    for (let 命题 of 校验值.propositions) {
      let 依据 = 命题.evidence
      if (依据.end > 校验值.text.length) {
        throw new Error(`Evidence anchor for proposition ${命题.id} exceeds the document text length`)
      }
      if (校验值.text.slice(依据.start, 依据.end) !== 依据.quote) {
        throw new Error(`Evidence anchor for proposition ${命题.id} does not match the document text`)
      }
    }

    let 命题列表 = 校验值.propositions.map((命题) => new FormalProposition(命题))

    let 标识集合 = new Set<string>()
    for (let 命题 of 命题列表) {
      if (标识集合.has(命题.getId())) {
        throw new Error(`Duplicate proposition id in document: ${命题.getId()}`)
      }
      标识集合.add(命题.getId())
    }

    let 谓词元数表 = new Map<string, number>()
    for (let 命题 of 命题列表) {
      for (let [符号, 元数] of 命题.getPredicateArities()) {
        let 已有元数 = 谓词元数表.get(符号)
        if (已有元数 !== undefined && 已有元数 !== 元数) {
          throw new Error(
            `谓词 "${符号}" 在不同命题中以 ${String(已有元数)} 元与 ${String(元数)} 元两种元数出现，同一文档内元数必须一致`,
          )
        }
        谓词元数表.set(符号, 元数)
      }
    }

    this.篇章标识 = 校验值.id
    this.原文 = 校验值.text
    this.命题列表 = 命题列表
    this.谓词元数表 = 谓词元数表
    this.来源标签 = 校验值.sourceLabel
    this.记录时间 = 校验值.recordedAt
    this.提取来源 = { ...校验值.provenance }
  }

  public getId(): string {
    return this.篇章标识
  }

  public getText(): string {
    return this.原文
  }

  public getPropositions(): FormalProposition[] {
    return [...this.命题列表]
  }

  public getPropositionById(id: string): FormalProposition | undefined {
    return this.命题列表.find((命题) => 命题.getId() === id)
  }

  /**
   * Lists every predicate symbol used across the document with its arity, sorted by symbol.
   */
  public listPredicateSymbols(): PredicateSymbol[] {
    return [...this.谓词元数表.entries()]
      .map(([符号, 元数]) => ({ symbol: 符号, arity: 元数 }))
      .sort((甲, 乙) => 甲.symbol.localeCompare(乙.symbol))
  }

  public getSourceLabel(): string | null {
    return this.来源标签
  }

  public getRecordedAt(): number {
    return this.记录时间
  }

  public getProvenance(): ExtractionProvenance {
    return { ...this.提取来源 }
  }

  public toSnapshot(): FormalLogicDocumentSnapshot {
    return {
      snapshotVersion: 1,
      id: this.篇章标识,
      text: this.原文,
      propositions: this.命题列表.map((命题) => 命题.toSnapshot()),
      sourceLabel: this.来源标签,
      recordedAt: this.记录时间,
      provenance: { ...this.提取来源 },
    }
  }
}
