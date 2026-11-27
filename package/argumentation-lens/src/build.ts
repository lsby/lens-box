import { ArgumentDocument } from './model/discourse.js'
import {
  ArgumentExtractionResult,
  argumentExtractionResultSchema,
  ArgumentPropositionSnapshot,
  ArgumentRelation,
} from './schema.js'

/**
 * Parameters for building an argument document from a raw extraction result.
 */
export type BuildArgumentDocumentParams = {
  text: string
  extraction: ArgumentExtractionResult
  model: string
  promptVersion: number
  sourceLabel?: string | null
}

/**
 * Builds a validated ArgumentDocument from a raw extraction result without any network access.
 *
 * The builder maps the model's temporary proposition keys to fresh UUIDs, locates each verbatim
 * evidence quote in the original text (honoring the 1-based occurrence index for repeated
 * quotes) and constructs the final document. It fails fast on duplicate keys, unknown relation
 * endpoints, unresolvable quotes and invalid provenance metadata.
 */
export function buildArgumentDocument(params: BuildArgumentDocumentParams): ArgumentDocument {
  if (params.text.trim().length === 0) {
    throw new Error('Cannot build an argument document from empty text')
  }
  if (params.model.trim().length === 0) {
    throw new Error('Extraction provenance model must not be empty')
  }
  if (Number.isInteger(params.promptVersion) === false || params.promptVersion <= 0) {
    throw new Error(`Extraction promptVersion must be a positive integer, got: ${String(params.promptVersion)}`)
  }

  let 提取结果 = argumentExtractionResultSchema.parse(params.extraction)

  let 标识映射 = new Map<string, string>()
  let 命题快照列表: ArgumentPropositionSnapshot[] = []
  for (let 命题 of 提取结果.propositions) {
    if (标识映射.has(命题.key)) {
      throw new Error(`Duplicate proposition key in extraction result: ${命题.key}`)
    }
    let 位置列表 = 查找全部出现位置(params.text, 命题.evidence.quote)
    let 起始 = 位置列表[命题.evidence.occurrence - 1]
    if (起始 === undefined) {
      throw new Error(
        `Evidence quote for proposition "${命题.key}" appears ${String(位置列表.length)} time(s) in the text, so occurrence ${String(命题.evidence.occurrence)} cannot be resolved`,
      )
    }
    let 标识 = globalThis.crypto.randomUUID()
    标识映射.set(命题.key, 标识)
    命题快照列表.push({
      id: 标识,
      type: 命题.type,
      content: 命题.content,
      evidence: { quote: 命题.evidence.quote, start: 起始, end: 起始 + 命题.evidence.quote.length },
    })
  }

  let 关系列表: ArgumentRelation[] = []
  for (let 关系 of 提取结果.relations) {
    let 源标识 = 标识映射.get(关系.sourceKey)
    if (源标识 === undefined) {
      throw new Error(`Relation references unknown proposition key: ${关系.sourceKey}`)
    }
    let 目标标识 = 标识映射.get(关系.targetKey)
    if (目标标识 === undefined) {
      throw new Error(`Relation references unknown proposition key: ${关系.targetKey}`)
    }
    关系列表.push({ sourceId: 源标识, targetId: 目标标识, type: 关系.type })
  }

  return new ArgumentDocument({
    snapshotVersion: 1,
    id: globalThis.crypto.randomUUID(),
    text: params.text,
    graph: { propositions: 命题快照列表, relations: 关系列表 },
    sourceLabel: params.sourceLabel ?? null,
    recordedAt: Date.now(),
    provenance: { model: params.model, promptVersion: params.promptVersion },
  })
}

/**
 * Finds the start offsets of every non-overlapping exact occurrence of a quote in the text.
 */
function 查找全部出现位置(文本: string, 摘录: string): number[] {
  let 位置列表: number[] = []
  let 游标 = 0
  let 命中 = 文本.indexOf(摘录, 游标)
  while (命中 !== -1) {
    位置列表.push(命中)
    游标 = 命中 + 摘录.length
    命中 = 文本.indexOf(摘录, 游标)
  }
  return 位置列表
}
