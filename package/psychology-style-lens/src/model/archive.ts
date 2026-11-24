import { z } from 'zod'
import { 心理学文风样本快照Schema, 心理学样本查询条件, 心理学画像分布摘要, 权力位阶, 社交距离 } from '../schema.js'
import { 心理学文风样本 } from './sample.js'

/**
 * 心理学样本档案是一组已剖析文风样本的聚合容器。
 * 内部维护不重复的样本集合及其索引完整性。
 * 负责安全地收录新样本、按多维条件检索样本、归纳性格与场景分布，以及进行档案快照的导入导出。
 */
export class 心理学样本档案 {
  public static 从快照Json恢复(json文本: string): 心理学样本档案 {
    let 解析结果: unknown = JSON.parse(json文本)
    let 快照列表 = z.array(心理学文风样本快照Schema).parse(解析结果)
    let 样本实例列表 = 快照列表.map((快照) => new 心理学文风样本(快照))
    return new 心理学样本档案(样本实例列表)
  }

  private 样本列表: 心理学文风样本[]

  public constructor(初始样本列表?: 心理学文风样本[]) {
    this.样本列表 = []
    if (初始样本列表 !== undefined) {
      for (let 样本 of 初始样本列表) {
        this.收录(样本)
      }
    }
  }

  public 收录(样本: 心理学文风样本): void {
    let 已存在 = this.样本列表.some((已有) => 已有.获得样本标识() === 样本.获得样本标识())
    if (已存在 === true) {
      throw new Error(`样本标识重复，无法重复收录：${样本.获得样本标识()}`)
    }
    this.样本列表.push(样本)
  }

  public 获得样本数量(): number {
    return this.样本列表.length
  }

  public 获得全部样本(): 心理学文风样本[] {
    return [...this.样本列表]
  }

  public 按条件检索(条件: 心理学样本查询条件): 心理学文风样本[] {
    if (条件.最大数量 !== undefined && 条件.最大数量 < 0) {
      throw new Error('最大数量不能为负数')
    }

    let 匹配结果 = this.样本列表.filter((样本) => 样本.匹配条件(条件))
    if (条件.最大数量 !== undefined) {
      return 匹配结果.slice(0, 条件.最大数量)
    }
    return 匹配结果
  }

  public 按性格检索(特质关键词: string, 最大数量?: number): 心理学文风样本[] {
    let 查询条件: 心理学样本查询条件 =
      最大数量 === undefined ? { 性格特质关键词: 特质关键词 } : { 性格特质关键词: 特质关键词, 最大数量 }
    return this.按条件检索(查询条件)
  }

  public 按场景检索(
    条件: { 场景关键词?: string; 社交距离?: 社交距离; 权力位阶?: 权力位阶 },
    最大数量?: number,
  ): 心理学文风样本[] {
    let 查询条件: 心理学样本查询条件 = { ...条件 }
    if (最大数量 !== undefined) {
      查询条件.最大数量 = 最大数量
    }
    return this.按条件检索(查询条件)
  }

  public 归纳画像分布(): 心理学画像分布摘要 {
    let 特质计数 = new Map<string, number>()
    let 社交距离计数: Record<string, number> = {}
    let 权力位阶计数: Record<string, number> = {}

    for (let 样本 of this.样本列表) {
      for (let 特质 of 样本.获得主导特质()) {
        let 当前次数 = 特质计数.get(特质) ?? 0
        特质计数.set(特质, 当前次数 + 1)
      }

      let 距离键 = 样本.获得社交距离()
      社交距离计数[距离键] = (社交距离计数[距离键] ?? 0) + 1

      let 位阶键 = 样本.获得权力位阶()
      权力位阶计数[位阶键] = (权力位阶计数[位阶键] ?? 0) + 1
    }

    let 高频性格特质 = Array.from(特质计数.entries())
      .map(([名称, 次数]) => ({ 名称, 次数 }))
      .sort((甲, 乙) => 乙.次数 - 甲.次数)

    return { 样本总数: this.样本列表.length, 高频性格特质, 社交距离分布: 社交距离计数, 权力位阶分布: 权力位阶计数 }
  }

  public 导出快照Json(): string {
    let 快照列表 = this.样本列表.map((样本) => 样本.导出快照())
    return JSON.stringify(快照列表, null, 2)
  }
}
