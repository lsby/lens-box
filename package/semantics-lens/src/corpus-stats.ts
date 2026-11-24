import { 语义篇章 } from './model/discourse.js'
import { 多篇章语义分布摘要, 概念权重 } from './schema.js'

/**
 * 基于给定的多篇文章集合计算目标篇章的 TF-IDF 独特概念，识别该篇文章区别于其他文章的标志性词汇。
 */
export function 提取篇章独特概念(
  目标篇章: 语义篇章,
  语料库篇章们: readonly 语义篇章[],
  最大数量: number = 10,
): 概念权重[] {
  if (最大数量 <= 0) {
    throw new Error('提取独特概念的数量必须为正整数')
  }

  let 语料库映射 = new Map<string, 语义篇章>()
  for (let 篇章 of 语料库篇章们) {
    语料库映射.set(篇章.获得篇章标识(), 篇章)
  }
  语料库映射.set(目标篇章.获得篇章标识(), 目标篇章)

  let 有效篇章们 = [...语料库映射.values()]
  let 总篇章数 = 有效篇章们.length
  let 文档频次映射 = new Map<string, number>()

  for (let 篇章 of 有效篇章们) {
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

/**
 * 统计多篇文章的整体高频核心概念与平均相邻连贯度。
 */
export function 归纳多篇章语义分布(篇章们: readonly 语义篇章[]): 多篇章语义分布摘要 {
  let 概念聚合 = new Map<string, { 权重总和: number; 频次总和: number }>()
  let 总连贯度 = 0

  for (let 篇章 of 篇章们) {
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

  let 篇章总数 = 篇章们.length
  return { 篇章总数, 高频概念们, 平均相邻连贯度: 篇章总数 === 0 ? 0 : Number((总连贯度 / 篇章总数).toFixed(4)) }
}
