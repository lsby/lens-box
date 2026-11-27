import { detectSupportCycles } from '../algorithm/support-cycle.js'
import { ArgumentGraphSnapshot, argumentGraphSnapshotSchema, ArgumentRelation } from '../schema.js'
import { ArgumentProposition } from './proposition.js'

/**
 * An ArgumentGraph is the directed support/attack network extracted from one text.
 * It owns the identified propositions and the relations between them, and enforces the graph
 * invariants at construction time: unique proposition ids, existing relation endpoints,
 * no self-loops and no duplicated relations (the same pair may still support AND attack).
 *
 * It offers lookup and traversal queries plus three structural diagnostics:
 * claims without explicit support, objections without a rebuttal, and support cycles.
 * These diagnostics describe only the structure explicitly present in the text; they are not
 * verdicts about factual truth or logical validity.
 */
export class ArgumentGraph {
  private readonly 命题映射: Map<string, ArgumentProposition>
  private readonly 关系列表: ArgumentRelation[]

  public constructor(snapshot: ArgumentGraphSnapshot) {
    let 校验值 = argumentGraphSnapshotSchema.parse(snapshot)

    this.命题映射 = new Map()
    for (let 命题快照 of 校验值.propositions) {
      if (this.命题映射.has(命题快照.id)) {
        throw new Error(`Duplicate proposition id in argument graph: ${命题快照.id}`)
      }
      this.命题映射.set(命题快照.id, new ArgumentProposition(命题快照))
    }

    this.关系列表 = []
    let 已见关系键 = new Set<string>()
    for (let 关系 of 校验值.relations) {
      if (this.命题映射.has(关系.sourceId) === false) {
        throw new Error(`Relation source proposition not found in graph: ${关系.sourceId}`)
      }
      if (this.命题映射.has(关系.targetId) === false) {
        throw new Error(`Relation target proposition not found in graph: ${关系.targetId}`)
      }
      if (关系.sourceId === 关系.targetId) {
        throw new Error(`Self-referencing relations are not allowed: ${关系.sourceId}`)
      }
      let 关系键 = `${关系.sourceId}${关系.targetId}${关系.type}`
      if (已见关系键.has(关系键)) {
        throw new Error(`Duplicate relation in argument graph: ${关系.sourceId} -[${关系.type}]-> ${关系.targetId}`)
      }
      已见关系键.add(关系键)
      this.关系列表.push({ ...关系 })
    }
  }

  public getProposition(id: string): ArgumentProposition | undefined {
    return this.命题映射.get(id)
  }

  public getPropositions(): ArgumentProposition[] {
    return [...this.命题映射.values()]
  }

  public getRelations(): ArgumentRelation[] {
    return this.关系列表.map((关系) => ({ ...关系 }))
  }

  public getCentralClaims(): ArgumentProposition[] {
    return [...this.命题映射.values()].filter((命题) => 命题.getType() === 'centralClaim')
  }

  /**
   * Case-insensitive keyword search over proposition content; a blank keyword returns all propositions.
   */
  public searchPropositions(keyword: string): ArgumentProposition[] {
    return [...this.命题映射.values()].filter((命题) => 命题.matchesKeyword(keyword))
  }

  /**
   * Returns the propositions that directly support the given proposition (sources of incoming support edges).
   */
  public getDirectSupporters(id: string): ArgumentProposition[] {
    this.确保命题存在(id)
    let 结果: ArgumentProposition[] = []
    for (let 关系 of this.关系列表) {
      if (关系.type !== 'support') continue
      if (关系.targetId !== id) continue
      let 来源 = this.命题映射.get(关系.sourceId)
      if (来源 !== undefined) {
        结果.push(来源)
      }
    }
    return 结果
  }

  /**
   * Returns the propositions that directly attack the given proposition (sources of incoming attack edges).
   */
  public getDirectAttackers(id: string): ArgumentProposition[] {
    this.确保命题存在(id)
    let 结果: ArgumentProposition[] = []
    for (let 关系 of this.关系列表) {
      if (关系.type !== 'attack') continue
      if (关系.targetId !== id) continue
      let 来源 = this.命题映射.get(关系.sourceId)
      if (来源 !== undefined) {
        结果.push(来源)
      }
    }
    return 结果
  }

  /**
   * Central claims and sub-claims that receive no incoming support edge.
   * This only means the text offers no explicit reason for them; it does not judge their truth.
   */
  public findClaimsWithoutExplicitSupport(): ArgumentProposition[] {
    let 被支持集合 = new Set<string>()
    for (let 关系 of this.关系列表) {
      if (关系.type === 'support') {
        被支持集合.add(关系.targetId)
      }
    }
    return [...this.命题映射.values()].filter((命题) => {
      let 类型 = 命题.getType()
      if (类型 !== 'centralClaim' && 类型 !== 'subClaim') {
        return false
      }
      return 被支持集合.has(命题.getId()) === false
    })
  }

  /**
   * Objections that are not attacked by any proposition of type `rebuttal`.
   * This only means the text leaves the objection unanswered; it does not judge who is right.
   */
  public findObjectionsWithoutRebuttal(): ArgumentProposition[] {
    let 被回应集合 = new Set<string>()
    for (let 关系 of this.关系列表) {
      if (关系.type !== 'attack') continue
      let 来源 = this.命题映射.get(关系.sourceId)
      if (来源 !== undefined && 来源.getType() === 'rebuttal') {
        被回应集合.add(关系.targetId)
      }
    }
    return [...this.命题映射.values()].filter(
      (命题) => 命题.getType() === 'objection' && 被回应集合.has(命题.getId()) === false,
    )
  }

  /**
   * Representative cycles in the support subgraph; see `detectSupportCycles` for semantics.
   */
  public findSupportCycles(): string[][] {
    return detectSupportCycles([...this.命题映射.keys()], this.关系列表)
  }

  public toSnapshot(): ArgumentGraphSnapshot {
    return {
      propositions: [...this.命题映射.values()].map((命题) => 命题.toSnapshot()),
      relations: this.关系列表.map((关系) => ({ ...关系 })),
    }
  }

  private 确保命题存在(id: string): void {
    if (this.命题映射.has(id) === false) {
      throw new Error(`Proposition not found in argument graph: ${id}`)
    }
  }
}
