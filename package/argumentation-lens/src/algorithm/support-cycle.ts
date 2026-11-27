import { ArgumentRelation } from '../schema.js'

/**
 * Detects representative cycles in the support subgraph of an argument graph.
 * Relations of type `attack` are ignored; a directed support cycle indicates that the text
 * presents a group of propositions as mutually reinforcing, which readers may want to review.
 *
 * Detection runs a deterministic depth-first search in the given proposition order and reports
 * each cycle once, canonically rotated to start at its lexicographically smallest id.
 * Every returned path repeats its first id at the end to mark closure (e.g. `['a', 'b', 'a']`).
 *
 * This is a structural diagnostic only: it does not enumerate every elementary cycle in dense
 * graphs and does not judge whether a cycle is fallacious.
 */
export function detectSupportCycles(
  propositionIds: readonly string[],
  relations: readonly ArgumentRelation[],
): string[][] {
  let 支持邻接 = new Map<string, string[]>()
  for (let 关系 of relations) {
    if (关系.type !== 'support') continue
    let 已有邻居 = 支持邻接.get(关系.sourceId)
    if (已有邻居 === undefined) {
      支持邻接.set(关系.sourceId, [关系.targetId])
    } else {
      已有邻居.push(关系.targetId)
    }
  }

  let 在栈中 = new Set<string>()
  let 已完成 = new Set<string>()
  let 栈: string[] = []
  let 环列表: string[][] = []
  let 已见环键 = new Set<string>()

  let 深度优先访问 = (节点: string): void => {
    在栈中.add(节点)
    栈.push(节点)
    for (let 邻居 of 支持邻接.get(节点) ?? []) {
      if (在栈中.has(邻居)) {
        let 起点 = 栈.indexOf(邻居)
        if (起点 === -1) continue
        let 环 = 栈.slice(起点)
        let 最小索引 = 0
        for (let 索引 = 1; 索引 < 环.length; 索引++) {
          let 当前 = 环[索引]
          let 最小 = 环[最小索引]
          if (当前 !== undefined && 最小 !== undefined && 当前 < 最小) {
            最小索引 = 索引
          }
        }
        let 旋转后 = [...环.slice(最小索引), ...环.slice(0, 最小索引)]
        let 环键 = 旋转后.join(' ')
        if (已见环键.has(环键) === false) {
          已见环键.add(环键)
          let 环首 = 旋转后[0]
          if (环首 !== undefined) {
            环列表.push([...旋转后, 环首])
          }
        }
      } else if (已完成.has(邻居) === false) {
        深度优先访问(邻居)
      }
    }
    栈.pop()
    在栈中.delete(节点)
    已完成.add(节点)
  }

  for (let 标识 of propositionIds) {
    if (已完成.has(标识) === false && 在栈中.has(标识) === false) {
      深度优先访问(标识)
    }
  }

  return 环列表
}
