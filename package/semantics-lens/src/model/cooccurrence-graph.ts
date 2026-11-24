import { UndirectedGraph } from 'graphology'
import { createRequire } from 'node:module'
import { z } from 'zod'
import { 概念共现图快照, 概念共现图快照Schema, 概念共现边, 概念权重 } from '../schema.js'
import { 语义单元 } from './unit.js'

let require = createRequire(import.meta.url)
let 社区映射Schema = z.record(z.string(), z.number())

/**
 * 概念共现图是以分布语义学为核心、刻画文章内部概念关联结构的无向加权图。
 * 里面保存了各实词概念的 TextRank 权重、出现频次，以及概念之间在局部窗口内的共现边强度。
 * 可以通过它提取核心概念、查询某概念的语义邻域、识别抱团的概念簇，或与其他共现图对比概念重合度。
 */
export class 概念共现图 {
  private static 计算TextRank分数(
    词列表: readonly string[],
    邻接表: ReadonlyMap<string, ReadonlyMap<string, number>>,
  ): Map<string, number> {
    let 分数 = new Map<string, number>()
    if (词列表.length === 0) return 分数

    let 阻尼系数 = 0.85
    let 迭代次数 = 20
    for (let 词 of 词列表) {
      分数.set(词, 1)
    }

    let 出边总权 = new Map<string, number>()
    for (let 词 of 词列表) {
      let 邻居 = 邻接表.get(词)
      let 总权 = 0
      if (邻居 !== undefined) {
        for (let 权 of 邻居.values()) {
          总权 += 权
        }
      }
      出边总权.set(词, 总权)
    }

    for (let 轮 = 0; 轮 < 迭代次数; 轮++) {
      let 新分数 = new Map<string, number>()
      for (let 词 of 词列表) {
        let 邻居 = 邻接表.get(词)
        let 聚合贡献 = 0
        if (邻居 !== undefined) {
          for (let [邻居词, 边权] of 邻居.entries()) {
            let 邻居总权 = 出边总权.get(邻居词) ?? 0
            if (邻居总权 > 0) {
              聚合贡献 += ((分数.get(邻居词) ?? 0) * 边权) / 邻居总权
            }
          }
        }
        新分数.set(词, 1 - 阻尼系数 + 阻尼系数 * 聚合贡献)
      }
      分数 = 新分数
    }

    let 最大分数 = 0
    for (let 值 of 分数.values()) {
      if (值 > 最大分数) 最大分数 = 值
    }
    if (最大分数 > 0) {
      for (let [词, 值] of 分数.entries()) {
        分数.set(词, Number((值 / 最大分数).toFixed(4)))
      }
    }

    return 分数
  }

  /**
   * 从有序语义单元列表构建概念共现图，并运行 TextRank 迭代计算概念核心权重。
   */
  public static 从语义单元构建(单元列表: readonly 语义单元[], 共现窗口大小: number = 4): 概念共现图 {
    if (共现窗口大小 < 2) {
      throw new Error('共现窗口大小至少为 2')
    }

    let 词频统计 = new Map<string, number>()
    let 边权重统计 = new Map<string, Map<string, number>>()

    let 累加边 = (词甲: string, 词乙: string): void => {
      if (词甲 === 词乙) return
      let 甲 = 词甲 < 词乙 ? 词甲 : 词乙
      let 乙 = 词甲 < 词乙 ? 词乙 : 词甲
      let 甲邻接 = 边权重统计.get(甲)
      if (甲邻接 === undefined) {
        甲邻接 = new Map()
        边权重统计.set(甲, 甲邻接)
      }
      甲邻接.set(乙, (甲邻接.get(乙) ?? 0) + 1)
    }

    for (let 单元 of 单元列表) {
      let 实词们 = 单元.获得实词序列()
      for (let 索引 = 0; 索引 < 实词们.length; 索引++) {
        let 当前词 = 实词们[索引]
        if (当前词 === undefined) continue
        词频统计.set(当前词, (词频统计.get(当前词) ?? 0) + 1)

        let 上界 = Math.min(实词们.length, 索引 + 共现窗口大小)
        for (let 目标索引 = 索引 + 1; 目标索引 < 上界; 目标索引++) {
          let 目标词 = 实词们[目标索引]
          if (目标词 === undefined) continue
          累加边(当前词, 目标词)
        }
      }
    }

    let 全部词们 = [...词频统计.keys()]
    let 完整邻接 = new Map<string, Map<string, number>>()
    for (let 词 of 全部词们) {
      完整邻接.set(词, new Map())
    }

    let 边列表: 概念共现边[] = []
    for (let [源词, 邻接] of 边权重统计.entries()) {
      for (let [目标词, 强度] of 邻接.entries()) {
        边列表.push({ 源词, 目标词, 共现强度: 强度 })
        完整邻接.get(源词)?.set(目标词, 强度)
        完整邻接.get(目标词)?.set(源词, 强度)
      }
    }

    let 分数映射 = 概念共现图.计算TextRank分数(全部词们, 完整邻接)
    let 节点列表: 概念权重[] = 全部词们.map((词) => ({ 词, 权重: 分数映射.get(词) ?? 0, 频次: 词频统计.get(词) ?? 0 }))

    return new 概念共现图({ 节点们: 节点列表, 边们: 边列表 })
  }

  private readonly 节点映射: Map<string, 概念权重>
  private readonly 邻接表: Map<string, Map<string, number>>

  public constructor(快照: 概念共现图快照) {
    let 校验值 = 概念共现图快照Schema.parse(快照)
    this.节点映射 = new Map()
    this.邻接表 = new Map()

    for (let 节点 of 校验值.节点们) {
      this.节点映射.set(节点.词, { ...节点 })
      if (this.邻接表.has(节点.词) === false) {
        this.邻接表.set(节点.词, new Map())
      }
    }

    for (let 边 of 校验值.边们) {
      if (边.源词 === 边.目标词) continue
      this.写入无向边(边.源词, 边.目标词, 边.共现强度)
    }
  }

  public 获取核心概念(最大数量: number = 10): 概念权重[] {
    if (最大数量 <= 0) {
      throw new Error('获取核心概念的数量必须为正整数')
    }
    return [...this.节点映射.values()]
      .sort((甲, 乙) => {
        if (乙.权重 !== 甲.权重) return 乙.权重 - 甲.权重
        return 乙.频次 - 甲.频次
      })
      .slice(0, 最大数量)
      .map((项) => ({ ...项 }))
  }

  public 查询关联概念(目标词: string, 最大数量: number = 8): Array<{ 词: string; 共现强度: number }> {
    let 归一化词 = 目标词.trim().toLowerCase()
    if (归一化词.length === 0) return []
    let 邻居 = this.邻接表.get(归一化词)
    if (邻居 === undefined) return []

    return [...邻居.entries()]
      .sort((甲, 乙) => 乙[1] - 甲[1])
      .slice(0, 最大数量)
      .map(([词, 共现强度]) => ({ 词, 共现强度 }))
  }

  /**
   * 基于 Louvain 社区发现算法识别高内聚的语义概念簇，按簇内最高概念权重与簇规模降序排列。
   */
  public 识别概念簇(最小簇大小: number = 2): string[][] {
    let 无向图 = new UndirectedGraph<Record<string, never>, { weight: number }>()

    for (let 词 of this.节点映射.keys()) {
      无向图.addNode(词)
    }

    for (let [源词, 邻接] of this.邻接表.entries()) {
      for (let [目标词, 共现强度] of 邻接.entries()) {
        if (源词 < 目标词 && 无向图.hasEdge(源词, 目标词) === false) {
          无向图.addEdge(源词, 目标词, { weight: 共现强度 })
        }
      }
    }

    if (无向图.order === 0 || 无向图.size === 0) {
      return []
    }

    let 原始社区发现: unknown = require('graphology-communities-louvain')
    if (typeof 原始社区发现 !== 'function') {
      throw new Error('加载 graphology-communities-louvain 失败')
    }
    let 社区映射 = 社区映射Schema.parse(原始社区发现(无向图, { getEdgeWeight: 'weight' }))
    let 社区分组 = new Map<number, string[]>()

    for (let [词, 社区编号] of Object.entries(社区映射)) {
      let 已有列表 = 社区分组.get(社区编号)
      if (已有列表 === undefined) {
        社区分组.set(社区编号, [词])
      } else {
        已有列表.push(词)
      }
    }

    let 簇列表: string[][] = []
    for (let 当前簇 of 社区分组.values()) {
      if (当前簇.length >= 最小簇大小) {
        当前簇.sort((甲, 乙) => (this.节点映射.get(乙)?.权重 ?? 0) - (this.节点映射.get(甲)?.权重 ?? 0))
        簇列表.push(当前簇)
      }
    }

    簇列表.sort((甲, 乙) => {
      let 权重甲 = 甲[0] !== undefined ? (this.节点映射.get(甲[0])?.权重 ?? 0) : 0
      let 权重乙 = 乙[0] !== undefined ? (this.节点映射.get(乙[0])?.权重 ?? 0) : 0
      if (权重乙 !== 权重甲) return 权重乙 - 权重甲
      return 乙.length - 甲.length
    })
    return 簇列表
  }

  /**
   * 计算与另一共现图在核心概念权重上的加权 Jaccard 重合度（范围 [0, 1]）。
   */
  public 计算概念重合度(另一图: 概念共现图): number {
    let 所有词 = new Set<string>([...this.节点映射.keys(), ...另一图.节点映射.keys()])
    if (所有词.size === 0) return 0

    let 最小和 = 0
    let 最大和 = 0
    for (let 词 of 所有词) {
      let 权重甲 = this.节点映射.get(词)?.权重 ?? 0
      let 权重乙 = 另一图.节点映射.get(词)?.权重 ?? 0
      最小和 += Math.min(权重甲, 权重乙)
      最大和 += Math.max(权重甲, 权重乙)
    }
    if (最大和 === 0) return 0
    return 最小和 / 最大和
  }

  public 导出快照(): 概念共现图快照 {
    let 节点们 = [...this.节点映射.values()].map((节点) => ({ ...节点 }))
    let 边们: 概念共现边[] = []
    let 已导出边 = new Set<string>()

    for (let [源词, 邻接] of this.邻接表.entries()) {
      for (let [目标词, 共现强度] of 邻接.entries()) {
        let 键 = 源词 < 目标词 ? `${源词}\0${目标词}` : `${目标词}\0${源词}`
        if (已导出边.has(键) === true) continue
        已导出边.add(键)
        边们.push({ 源词: 源词 < 目标词 ? 源词 : 目标词, 目标词: 源词 < 目标词 ? 目标词 : 源词, 共现强度 })
      }
    }

    return { 节点们, 边们 }
  }

  private 写入无向边(词甲: string, 词乙: string, 强度: number): void {
    let 邻接甲 = this.邻接表.get(词甲)
    if (邻接甲 === undefined) {
      邻接甲 = new Map()
      this.邻接表.set(词甲, 邻接甲)
    }
    邻接甲.set(词乙, 强度)

    let 邻接乙 = this.邻接表.get(词乙)
    if (邻接乙 === undefined) {
      邻接乙 = new Map()
      this.邻接表.set(词乙, 邻接乙)
    }
    邻接乙.set(词甲, 强度)
  }
}
