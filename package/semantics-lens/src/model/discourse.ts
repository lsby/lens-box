import { 概念权重, 语义篇章快照, 语义篇章快照Schema, 语义转折点 } from '../schema.js'
import { 概念共现图 } from './cooccurrence-graph.js'
import { 语义单元 } from './unit.js'

/**
 * 语义篇章是单篇文章在语义学视角下的完整充血模型。
 * 当中聚合了按顺序排列的语义单元、由文本构建的概念共现图，以及文章来源与时间戳等元信息。
 * 可以通过它提取核心概念、计算相邻句/段的语义连贯度曲线、定位语义转折点、评估主题收敛度，或与其他篇章对比语义重合度。
 */
export class 语义篇章 {
  private readonly 篇章标识: string
  private readonly 原文: string
  private readonly 单元列表: readonly 语义单元[]
  private readonly 共现图: 概念共现图
  private readonly 记录时间戳: number
  private readonly 来源标签: string | null

  public constructor(快照: 语义篇章快照) {
    let 校验值 = 语义篇章快照Schema.parse(快照)
    this.篇章标识 = 校验值.篇章标识
    this.原文 = 校验值.原文
    this.单元列表 = 校验值.单元们.map((单元快照) => new 语义单元(单元快照))
    this.共现图 = new 概念共现图(校验值.共现图)
    this.记录时间戳 = 校验值.记录时间戳
    this.来源标签 = 校验值.来源标签
  }

  public 获得篇章标识(): string {
    return this.篇章标识
  }

  public 获得原文(): string {
    return this.原文
  }

  public 获得来源标签(): string | null {
    return this.来源标签
  }

  public 获得单元数量(): number {
    return this.单元列表.length
  }

  public 获得语义单元们(): 语义单元[] {
    return [...this.单元列表]
  }

  public 获得概念共现图(): 概念共现图 {
    return this.共现图
  }

  public 获取核心概念(最大数量: number = 10): 概念权重[] {
    return this.共现图.获取核心概念(最大数量)
  }

  public 是否包含概念(概念词: string): boolean {
    return this.单元列表.some((单元) => 单元.是否包含概念(概念词))
  }

  /**
   * 计算全篇平均词汇信息密度（实词数 / 总词数）。
   */
  public 评估平均信息密度(): number {
    if (this.单元列表.length === 0) return 0
    let 总密度 = 0
    for (let 单元 of this.单元列表) {
      总密度 += 单元.获得词汇信息密度()
    }
    return 总密度 / this.单元列表.length
  }

  /**
   * 依次计算相邻语义单元之间的语义相似度，形成篇章语义连贯度曲线。
   */
  public 计算相邻连贯度曲线(): number[] {
    if (this.单元列表.length < 2) return []
    let 曲线: number[] = []
    for (let 索引 = 0; 索引 < this.单元列表.length - 1; 索引++) {
      let 前单元 = this.单元列表[索引]
      let 后单元 = this.单元列表[索引 + 1]
      if (前单元 === undefined || 后单元 === undefined) continue
      曲线.push(前单元.计算语义相似度(后单元))
    }
    return 曲线
  }

  /**
   * 计算相邻语义单元连贯度的均值，衡量文章整体的推进平滑度（范围 [0, 1]）。
   */
  public 评估平均连贯度(): number {
    let 曲线 = this.计算相邻连贯度曲线()
    if (曲线.length === 0) return 1
    let 总和 = 0
    for (let 值 of 曲线) {
      总和 += 值
    }
    return 总和 / 曲线.length
  }

  /**
   * 定位相邻单元语义相似度显著低于平均水平（或低于指定阈值）的语义转折点。
   */
  public 定位语义转折点(最小跌落幅度: number = 0.15): 语义转折点[] {
    if (最小跌落幅度 < 0) {
      throw new Error('最小跌落幅度不能为负数')
    }
    let 曲线 = this.计算相邻连贯度曲线()
    if (曲线.length === 0) return []

    let 平均连贯度 = this.评估平均连贯度()
    let 转折点列表: 语义转折点[] = []

    for (let 索引 = 0; 索引 < 曲线.length; 索引++) {
      let 当前相似度 = 曲线[索引]
      if (当前相似度 === undefined) continue
      let 跌落幅度 = 平均连贯度 - 当前相似度
      if (跌落幅度 >= 最小跌落幅度) {
        let 前单元 = this.单元列表[索引]
        let 后单元 = this.单元列表[索引 + 1]
        if (前单元 === undefined || 后单元 === undefined) continue
        转折点列表.push({
          单元位置: 索引 + 1,
          前单元原文: 前单元.获得原文(),
          后单元原文: 后单元.获得原文(),
          相邻相似度: 当前相似度,
          跌落幅度: Number(跌落幅度.toFixed(4)),
        })
      }
    }

    return 转折点列表
  }

  /**
   * 评估文章的主题收敛度（范围 [0, 1]）：
   * 基于所有单元对彼此的平均语义亲和度与核心概念覆盖率综合衡量。
   */
  public 评估主题收敛度(): number {
    if (this.单元列表.length <= 1) return 1
    let 总相似度 = 0
    let 配对数 = 0

    for (let 左 = 0; 左 < this.单元列表.length; 左++) {
      let 单元左 = this.单元列表[左]
      if (单元左 === undefined) continue
      for (let 右 = 左 + 1; 右 < this.单元列表.length; 右++) {
        let 单元右 = this.单元列表[右]
        if (单元右 === undefined) continue
        总相似度 += 单元左.计算语义相似度(单元右)
        配对数++
      }
    }

    if (配对数 === 0) return 1
    return 总相似度 / 配对数
  }

  /**
   * 对比另一语义篇章在核心概念与共现结构上的重合度（范围 [0, 1]）。
   */
  public 对比另一篇章(目标篇章: 语义篇章): number {
    return this.共现图.计算概念重合度(目标篇章.共现图)
  }

  public 导出快照(): 语义篇章快照 {
    return {
      篇章标识: this.篇章标识,
      原文: this.原文,
      单元们: this.单元列表.map((单元) => 单元.导出快照()),
      共现图: this.共现图.导出快照(),
      记录时间戳: this.记录时间戳,
      来源标签: this.来源标签,
    }
  }
}
