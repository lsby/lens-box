import { ArgumentDocumentSnapshot, argumentDocumentSnapshotSchema, ExtractionProvenance } from '../schema.js'
import { ArgumentGraph } from './graph.js'

/**
 * An ArgumentDocument is the complete result of analyzing one text from the argumentation
 * perspective. It aggregates the original text, the extracted argument graph, the source label,
 * the recording timestamp and the extraction provenance (model and prompt version).
 *
 * Construction re-validates every evidence anchor against the original text, so a document
 * restored from a snapshot is guaranteed to be grounded in the exact characters it quotes.
 */
export class ArgumentDocument {
  private readonly 篇章标识: string
  private readonly 原文: string
  private readonly 论证图: ArgumentGraph
  private readonly 来源标签: string | null
  private readonly 记录时间: number
  private readonly 提取来源: ExtractionProvenance

  public constructor(snapshot: ArgumentDocumentSnapshot) {
    let 校验值 = argumentDocumentSnapshotSchema.parse(snapshot)

    for (let 命题 of 校验值.graph.propositions) {
      let 依据 = 命题.evidence
      if (依据.end > 校验值.text.length) {
        throw new Error(`Evidence anchor for proposition ${命题.id} exceeds the document text length`)
      }
      if (校验值.text.slice(依据.start, 依据.end) !== 依据.quote) {
        throw new Error(`Evidence anchor for proposition ${命题.id} does not match the document text`)
      }
    }

    this.篇章标识 = 校验值.id
    this.原文 = 校验值.text
    this.论证图 = new ArgumentGraph(校验值.graph)
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

  public getGraph(): ArgumentGraph {
    return this.论证图
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

  public toSnapshot(): ArgumentDocumentSnapshot {
    return {
      snapshotVersion: 1,
      id: this.篇章标识,
      text: this.原文,
      graph: this.论证图.toSnapshot(),
      sourceLabel: this.来源标签,
      recordedAt: this.记录时间,
      provenance: { ...this.提取来源 },
    }
  }
}
