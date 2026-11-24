import { Jieba } from '@node-rs/jieba'
import { dict } from '@node-rs/jieba/dict.js'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { z } from 'zod'

let require = createRequire(import.meta.url)
let 中文停用词路径 = require.resolve('stopwords-zh')
let 中文停用词列表 = z.array(z.string()).parse(JSON.parse(readFileSync(中文停用词路径, 'utf8')))

/**
 * 基于 `stopwords-zh` 加载的默认中文停用词集合（全小写归一化）。
 */
export let 默认中文停用词集合: ReadonlySet<string> = new Set(中文停用词列表.map((词) => 词.trim().toLowerCase()))

let jieba实例 = Jieba.withDict(dict)
let 纯标点或空白正则 = /^[\p{P}\p{S}\s]+$/u
let 纯数字正则 = /^\d+(?:\.\d+)?$/

/**
 * 判断 jieba 词性标注是否属于承载独立语义的实词（名词、动词、形容词、成语、习语、英文词等）。
 */
function 是否为实词词性(词性: string): boolean {
  if (词性.startsWith('n') === true) return true
  if (词性.startsWith('v') === true) return true
  if (词性.startsWith('a') === true) return true
  if (词性 === 'i' || 词性 === 'l' || 词性 === 'j' || 词性 === 'eng' || 词性 === 't') return true
  return false
}

/**
 * 使用 `@node-rs/jieba` 进行中文分词，并过滤标点、空白与纯数字。
 */
export function 默认中文分词(文本: string): string[] {
  let 词列表: string[] = []
  for (let 原始词 of jieba实例.cut(文本, true)) {
    let 词 = 原始词.trim().toLowerCase()
    if (词.length === 0) continue
    if (纯标点或空白正则.test(词) === true) continue
    if (纯数字正则.test(词) === true) continue
    词列表.push(词)
  }
  return 词列表
}

/**
 * 使用 `@node-rs/jieba` 词性标注提取实词序列，并结合停用词集合过滤高频虚词，同时返回有效总词数。
 */
export function 提取中文实词与总词数(
  文本: string,
  停用词集合: ReadonlySet<string>,
): { 总词数: number; 实词序列: string[] } {
  let 总词数 = 0
  let 实词序列: string[] = []

  for (let 词项 of jieba实例.tag(文本, true)) {
    let 词 = 词项.word.trim().toLowerCase()
    if (词.length === 0) continue
    if (纯标点或空白正则.test(词) === true) continue
    if (纯数字正则.test(词) === true) continue
    总词数++

    if (是否为实词词性(词项.tag) === false) continue
    if (停用词集合.has(词) === true) continue
    实词序列.push(词)
  }

  return { 总词数, 实词序列 }
}

/**
 * 将文章按段落与句子边界切分为结构化文本片段。
 */
export function 切分文章片段(
  原文: string,
  切分粒度: '句子' | '段落',
): Array<{ 序号: number; 段落序号: number; 原文: string }> {
  let 段落列表 = 原文
    .split(/\r?\n+/)
    .map((行) => 行.trim())
    .filter((行) => 行.length > 0)

  let 结果: Array<{ 序号: number; 段落序号: number; 原文: string }> = []
  let 序号 = 0

  for (let 段落索引 = 0; 段落索引 < 段落列表.length; 段落索引++) {
    let 段落文本 = 段落列表[段落索引]
    if (段落文本 === undefined) continue

    if (切分粒度 === '段落') {
      结果.push({ 序号, 段落序号: 段落索引, 原文: 段落文本 })
      序号++
      continue
    }

    let 句子切分 = 段落文本
      .split(/(?<=[。！？!?；;…]+)\s*/u)
      .map((句) => 句.trim())
      .filter((句) => 句.length > 0)

    for (let 句 of 句子切分) {
      结果.push({ 序号, 段落序号: 段落索引, 原文: 句 })
      序号++
    }
  }

  return 结果
}

/**
 * 计算两个数值向量的余弦相似度；若维度不同则抛出异常，零向量返回 0。
 */
export function 计算向量余弦相似度(向量甲: readonly number[], 向量乙: readonly number[]): number {
  if (向量甲.length !== 向量乙.length) {
    throw new Error(`向量维度不一致：${String(向量甲.length)} !== ${String(向量乙.length)}`)
  }
  let 点积 = 0
  let 模甲平方 = 0
  let 模乙平方 = 0

  for (let 索引 = 0; 索引 < 向量甲.length; 索引++) {
    let 值甲 = 向量甲[索引]
    let 值乙 = 向量乙[索引]
    if (值甲 === undefined || 值乙 === undefined) continue
    点积 += 值甲 * 值乙
    模甲平方 += 值甲 * 值甲
    模乙平方 += 值乙 * 值乙
  }

  let 分母 = Math.sqrt(模甲平方) * Math.sqrt(模乙平方)
  if (分母 === 0) return 0
  return 点积 / 分母
}
