import { z } from 'zod'

/**
 * 语义剖析输入 Schema。
 */
export let 语义剖析输入Schema = z.object({
  文本: z.string().trim().min(1, '输入文章文本不能为空'),
  来源标签: z.string().trim().min(1).nullable().optional(),
  切分粒度: z.enum(['句子', '段落']).optional(),
})

export type 语义剖析输入 = z.infer<typeof 语义剖析输入Schema>

/**
 * 概念节点权重信息。
 */
export let 概念权重Schema = z.object({
  词: z.string().min(1),
  权重: z.number().nonnegative(),
  频次: z.number().int().nonnegative(),
})

export type 概念权重 = z.infer<typeof 概念权重Schema>

/**
 * 共现边信息。
 */
export let 概念共现边Schema = z.object({
  源词: z.string().min(1),
  目标词: z.string().min(1),
  共现强度: z.number().nonnegative(),
})

export type 概念共现边 = z.infer<typeof 概念共现边Schema>

/**
 * 语义转折点信息。
 */
export type 语义转折点 = {
  单元位置: number
  前单元原文: string
  后单元原文: string
  相邻相似度: number
  跌落幅度: number
}

/**
 * 语义单元快照 Schema。
 */
export let 语义单元快照Schema = z.object({
  序号: z.number().int().nonnegative(),
  段落序号: z.number().int().nonnegative(),
  原文: z.string().min(1),
  总词数: z.number().int().nonnegative(),
  实词序列: z.array(z.string().min(1)),
  向量: z.array(z.number()).nullable(),
})

export type 语义单元快照 = z.infer<typeof 语义单元快照Schema>

/**
 * 概念共现图快照 Schema。
 */
export let 概念共现图快照Schema = z.object({ 节点们: z.array(概念权重Schema), 边们: z.array(概念共现边Schema) })

export type 概念共现图快照 = z.infer<typeof 概念共现图快照Schema>

/**
 * 语义篇章快照 Schema。
 */
export let 语义篇章快照Schema = z.object({
  篇章标识: z.string().min(1),
  原文: z.string().min(1),
  单元们: z.array(语义单元快照Schema).min(1),
  共现图: 概念共现图快照Schema,
  记录时间戳: z.number().int().nonnegative(),
  来源标签: z.string().nullable(),
})

export type 语义篇章快照 = z.infer<typeof 语义篇章快照Schema>

/**
 * 多篇章语义分布摘要。
 */
export type 多篇章语义分布摘要 = { 篇章总数: number; 高频概念们: 概念权重[]; 平均相邻连贯度: number }
