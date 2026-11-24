import {
  人物性格画像,
  对话场景环境,
  心理学文风样本快照,
  心理学文风样本快照Schema,
  心理学样本查询条件,
  权力位阶,
  社交距离,
} from '../schema.js'
import { 包含忽略大小写 } from '../utils/tools.js'

/**
 * 心理学文风样本代表一条从心理学视角完成剖析并沉淀下来的文本例句。
 * 当中记录了原始文本、人物性格画像、对话场景环境、来源标签与记录时间。
 * 支持按性格、场景或组合条件进行自身语义匹配，并可导出为不可变的纯数据快照。
 */
export class 心理学文风样本 {
  private readonly 样本标识值: string
  private readonly 原文值: string
  private readonly 人物性格值: 人物性格画像
  private readonly 对话场景值: 对话场景环境
  private readonly 记录时间戳值: number
  private readonly 来源标签值: string | null

  public constructor(快照: 心理学文风样本快照) {
    let 校验后 = 心理学文风样本快照Schema.parse(快照)
    this.样本标识值 = 校验后.样本标识
    this.原文值 = 校验后.原文
    this.人物性格值 = {
      主导特质: [...校验后.人物性格.主导特质],
      情绪基调: 校验后.人物性格.情绪基调,
      表达动机: 校验后.人物性格.表达动机,
      防御或互动姿态: 校验后.人物性格.防御或互动姿态,
    }
    this.对话场景值 = { ...校验后.对话场景 }
    this.记录时间戳值 = 校验后.记录时间戳
    this.来源标签值 = 校验后.来源标签
  }

  public 获得样本标识(): string {
    return this.样本标识值
  }

  public 获得原文(): string {
    return this.原文值
  }

  public 获得主导特质(): string[] {
    return [...this.人物性格值.主导特质]
  }

  public 获得社交距离(): 社交距离 {
    return this.对话场景值.社交距离
  }

  public 获得权力位阶(): 权力位阶 {
    return this.对话场景值.权力位阶
  }

  public 匹配性格特质(关键词: string): boolean {
    if (关键词.trim().length === 0) {
      return true
    }
    let 命中特质 = this.人物性格值.主导特质.some((特质) => 包含忽略大小写(特质, 关键词))
    let 命中姿态 = 包含忽略大小写(this.人物性格值.防御或互动姿态, 关键词)
    return 命中特质 || 命中姿态
  }

  public 匹配场景环境(关键词: string): boolean {
    if (关键词.trim().length === 0) {
      return true
    }
    let 命中场景 = 包含忽略大小写(this.对话场景值.场景类型, 关键词)
    let 命中气氛 = 包含忽略大小写(this.对话场景值.气氛张力, 关键词)
    return 命中场景 || 命中气氛
  }

  public 匹配条件(条件: 心理学样本查询条件): boolean {
    if (条件.性格特质关键词 !== undefined && this.匹配性格特质(条件.性格特质关键词) === false) {
      return false
    }

    if (条件.情绪基调关键词 !== undefined && 条件.情绪基调关键词.trim().length > 0) {
      if (包含忽略大小写(this.人物性格值.情绪基调, 条件.情绪基调关键词) === false) {
        return false
      }
    }

    if (条件.场景关键词 !== undefined && this.匹配场景环境(条件.场景关键词) === false) {
      return false
    }

    if (条件.社交距离 !== undefined && this.对话场景值.社交距离 !== 条件.社交距离) {
      return false
    }

    if (条件.权力位阶 !== undefined && this.对话场景值.权力位阶 !== 条件.权力位阶) {
      return false
    }

    if (条件.来源标签 !== undefined && this.来源标签值 !== 条件.来源标签) {
      return false
    }

    return true
  }

  public 导出快照(): 心理学文风样本快照 {
    return {
      样本标识: this.样本标识值,
      原文: this.原文值,
      人物性格: {
        主导特质: [...this.人物性格值.主导特质],
        情绪基调: this.人物性格值.情绪基调,
        表达动机: this.人物性格值.表达动机,
        防御或互动姿态: this.人物性格值.防御或互动姿态,
      },
      对话场景: { ...this.对话场景值 },
      记录时间戳: this.记录时间戳值,
      来源标签: this.来源标签值,
    }
  }
}
