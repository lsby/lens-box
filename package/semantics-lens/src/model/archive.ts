import { z } from 'zod'
import { 概念权重, 语义档案分布摘要, 语义档案查询条件, 语义篇章快照Schema } from '../schema.js'
import { 语义篇章 } from './discourse.js'

/**
 * 语义档案是跨多篇文章聚合的语料库容器。
 * 里面保存了不重复的语义篇章集合及其快照导入导出能力。
 * 主要负责收录新篇章、按概念或来源检索篇章、计算跨篇章的语料库级 TF-IDF 独特概念，以及归纳整体语义分布摘要。
 */
export class 语义档案 {
  public static 从快照Json恢复(json文本: string): 语义档案 {
    let 解析结果: unknown = JSON.parse(json文本)
    let 快照列表 = z.array(语义篇章快照Schema).parse(解析结果)
    let 篇章实例列表 = 快照列表.map((快照) => new 语义篇章(快照))
    return new 语义档案(篇章实例列表)
  }

  private 篇章列表: 语义篇章[]

  public constructor(初始篇章列表?: 语义篇章[]) {
    this.篇章列表 = []
    if (初始篇章列表 !== undefined) {
      for (let 篇章 of 初始篇章列表) {
        this.收录(篇章)
      }
    }
  }

  public 收录(篇章: 语义篇章): void {
    let 已存在 = this.篇章列表.some((已有) => 已有.获得篇章标识() === 篇章.获得篇章标识())
    if (已存在 === true) {
      throw new Error(`篇章标识重复，无法重复收录：${篇章.获得篇章标识()}`)
    }
    this.篇章列表.push(篇章)
  }

  public 获得篇章数量(): number {
    return this.篇章列表.length
  }

  public 获得全部篇章(): 语义篇章[] {
    return [...this.篇章列表]
  }

  public 按条件检索(条件: 语义档案查询条件): 语义篇章[] {
    if (条件.最大数量 !== undefined && 条件.最大数量 < 0) {
      throw new Error('最大数量不能为负数')
    }

    let 匹配结果 = this.篇章列表.filter((篇章) => {
      if (条件.来源标签 !== undefined && 篇章.获得来源标签() !== 条件.来源标签) {
        return false
      }
      if (条件.包含概念 !== undefined && 篇章.是否包含概念(条件.包含概念) === false) {
        return false
      }
      return true
    })

    if (条件.最大数量 !== undefined) {
      return 匹配结果.slice(0, 条件.最大数量)
    }
    return 匹配结果
  }

  /**
   * 基于整个档案语料库计算指定篇章的 TF-IDF 独特概念，识别该篇文章区别于其他文章的标志性词汇。
   */
  public 提取篇章独特概念(篇章标识: string, 最大数量: number = 10): 概念权重[] {
    if (最大数量 <= 0) {
      throw new Error('提取独特概念的数量必须为正整数')
    }

    let 目标篇章 = this.篇章列表.find((篇章) => 篇章.获得篇章标识() === 篇章标识)
    if (目标篇章 === undefined) {
      throw new Error(`档案中未找到标识为 ${篇章标识} 的语义篇章`)
    }

    let 总篇章数 = this.篇章列表.length
    let 文档频次映射 = new Map<string, number>()

    for (let 篇章 of this.篇章列表) {
      let 篇章唯一词 = new Set<string>()
      for (let 单元 of 篇章.获得语义单元们()) {
        for (let 词 of 单元.获得唯一实词列表()) {
          篇章唯一词.add(词)
        }
      }
      for (let 词 of 篇章唯一词) {
        文档频次映射.set(词, (文档频次映射.get(词) ?? 0) + 1)
      }
    }

    let 目标词频映射 = new Map<string, number>()
    let 目标总实词数 = 0
    for (let 单元 of 目标篇章.获得语义单元们()) {
      for (let 词 of 单元.获得实词序列()) {
        目标词频映射.set(词, (目标词频映射.get(词) ?? 0) + 1)
        目标总实词数++
      }
    }

    if (目标总实词数 === 0) return []

    let 结果列表: 概念权重[] = []
    for (let [词, 频次] of 目标词频映射.entries()) {
      let tf = 频次 / 目标总实词数
      let 包含该词篇章数 = 文档频次映射.get(词) ?? 1
      let idf = Math.log((总篇章数 + 1) / (包含该词篇章数 + 1)) + 1
      结果列表.push({ 词, 权重: Number((tf * idf).toFixed(4)), 频次 })
    }

    return 结果列表
      .sort((甲, 乙) => {
        if (乙.权重 !== 甲.权重) return 乙.权重 - 甲.权重
        return 乙.频次 - 甲.频次
      })
      .slice(0, 最大数量)
  }

  public 归纳档案分布(): 语义档案分布摘要 {
    let 概念聚合 = new Map<string, { 权重总和: number; 频次总和: number }>()
    let 总连贯度 = 0

    for (let 篇章 of this.篇章列表) {
      总连贯度 += 篇章.评估平均连贯度()
      for (let 概念 of 篇章.获取核心概念(20)) {
        let 已有 = 概念聚合.get(概念.词)
        if (已有 === undefined) {
          概念聚合.set(概念.词, { 权重总和: 概念.权重, 频次总和: 概念.频次 })
        } else {
          已有.权重总和 += 概念.权重
          已有.频次总和 += 概念.频次
        }
      }
    }

    let 高频概念们: 概念权重[] = [...概念聚合.entries()]
      .map(([词, 统计]) => ({ 词, 权重: Number(统计.权重总和.toFixed(4)), 频次: 统计.频次总和 }))
      .sort((甲, 乙) => {
        if (乙.权重 !== 甲.权重) return 乙.权重 - 甲.权重
        return 乙.频次 - 甲.频次
      })
      .slice(0, 15)

    let 篇章总数 = this.篇章列表.length
    return { 篇章总数, 高频概念们, 平均相邻连贯度: 篇章总数 === 0 ? 0 : Number((总连贯度 / 篇章总数).toFixed(4)) }
  }

  public 导出快照Json(): string {
    let 快照列表 = this.篇章列表.map((篇章) => 篇章.导出快照())
    return JSON.stringify(快照列表, null, 2)
  }
}
