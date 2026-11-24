import { 计算向量余弦相似度 } from '../lexical/text-tools.js'
import { 语义单元快照, 语义单元快照Schema } from '../schema.js'

/**
 * 语义单元是文章经过切分后的最小语义片段（例如单个句子或自然段）。
 * 当中记录了片段在文章中的位置序号、所属段落、原文内容、分词统计后的实词序列以及可选的语义向量。
 * 可以通过它计算自身词汇信息密度、判断是否包含特定概念，以及评估与另一语义单元的语义相似度。
 */
export class 语义单元 {
  private readonly 序号: number
  private readonly 段落序号: number
  private readonly 原文: string
  private readonly 总词数: number
  private readonly 实词序列: readonly string[]
  private readonly 实词集合: ReadonlySet<string>
  private readonly 向量: readonly number[] | null

  public constructor(快照: 语义单元快照) {
    let 校验值 = 语义单元快照Schema.parse(快照)
    if (校验值.总词数 < 校验值.实词序列.length) {
      throw new Error('语义单元的总词数不能小于实词数量')
    }
    this.序号 = 校验值.序号
    this.段落序号 = 校验值.段落序号
    this.原文 = 校验值.原文
    this.总词数 = 校验值.总词数
    this.实词序列 = [...校验值.实词序列]
    this.实词集合 = new Set(校验值.实词序列)
    this.向量 = 校验值.向量 !== null ? [...校验值.向量] : null
  }

  public 获得序号(): number {
    return this.序号
  }

  public 获得段落序号(): number {
    return this.段落序号
  }

  public 获得原文(): string {
    return this.原文
  }

  public 获得实词序列(): string[] {
    return [...this.实词序列]
  }

  public 获得唯一实词列表(): string[] {
    return [...this.实词集合]
  }

  public 获得向量(): number[] | null {
    return this.向量 !== null ? [...this.向量] : null
  }

  public 是否包含概念(概念词: string): boolean {
    let 归一化词 = 概念词.trim().toLowerCase()
    if (归一化词.length === 0) return false
    return this.实词集合.has(归一化词)
  }

  /**
   * 衡量片段的实词信息密度（实词数占总词数的比例，范围 [0, 1]）。
   */
  public 获得词汇信息密度(): number {
    if (this.总词数 === 0) return 0
    return this.实词序列.length / this.总词数
  }

  /**
   * 计算与另一语义单元的语义相似度（范围 [0, 1]）。
   * 若双方均具备语义向量则优先采用向量余弦相似度（裁剪至非负区间），否则退回词面 Jaccard 重叠度。
   */
  public 计算语义相似度(另一单元: 语义单元): number {
    if (this.向量 !== null && 另一单元.向量 !== null) {
      let 余弦 = 计算向量余弦相似度(this.向量, 另一单元.向量)
      return Math.max(0, Math.min(1, 余弦))
    }

    if (this.实词集合.size === 0 || 另一单元.实词集合.size === 0) {
      return 0
    }

    let 交集数量 = 0
    for (let 词 of this.实词集合) {
      if (另一单元.实词集合.has(词) === true) {
        交集数量++
      }
    }
    let 并集数量 = this.实词集合.size + 另一单元.实词集合.size - 交集数量
    if (并集数量 === 0) return 0
    return 交集数量 / 并集数量
  }

  public 导出快照(): 语义单元快照 {
    return {
      序号: this.序号,
      段落序号: this.段落序号,
      原文: this.原文,
      总词数: this.总词数,
      实词序列: [...this.实词序列],
      向量: this.向量 !== null ? [...this.向量] : null,
    }
  }
}
