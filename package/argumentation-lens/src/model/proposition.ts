import {
  ArgumentPropositionSnapshot,
  argumentPropositionSnapshotSchema,
  EvidenceAnchor,
  PropositionType,
} from '../schema.js'

/**
 * An ArgumentProposition is a single claim, reason, piece of evidence, objection or rebuttal
 * explicitly identified in a text's argumentation structure.
 * It holds the proposition's id, argumentative role, normalized content and the verbatim
 * evidence anchor that grounds it in the original text.
 * It supports keyword matching and snapshot export; all accessors return copies.
 */
export class ArgumentProposition {
  private readonly 命题标识: string
  private readonly 命题类型: PropositionType
  private readonly 命题内容: string
  private readonly 原文依据: EvidenceAnchor

  public constructor(snapshot: ArgumentPropositionSnapshot) {
    let 校验值 = argumentPropositionSnapshotSchema.parse(snapshot)
    this.命题标识 = 校验值.id
    this.命题类型 = 校验值.type
    this.命题内容 = 校验值.content
    this.原文依据 = { ...校验值.evidence }
  }

  public getId(): string {
    return this.命题标识
  }

  public getType(): PropositionType {
    return this.命题类型
  }

  public getContent(): string {
    return this.命题内容
  }

  public getEvidence(): EvidenceAnchor {
    return { ...this.原文依据 }
  }

  /**
   * Case-insensitive substring match against the proposition content.
   * A blank keyword matches every proposition.
   */
  public matchesKeyword(keyword: string): boolean {
    let 归一化关键词 = keyword.trim().toLowerCase()
    if (归一化关键词.length === 0) {
      return true
    }
    return this.命题内容.toLowerCase().includes(归一化关键词)
  }

  public toSnapshot(): ArgumentPropositionSnapshot {
    return { id: this.命题标识, type: this.命题类型, content: this.命题内容, evidence: { ...this.原文依据 } }
  }
}
