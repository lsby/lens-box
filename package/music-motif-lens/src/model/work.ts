import { 动机 } from './motif.js'
import { 音轨 } from './track.js'
import { 变奏关系 } from './variation.js'

/**
 * 音乐作品是整首多音轨符号化乐曲经过动机与变奏分析后的充血整体模型。
 * 内部组合了作品名称、全部音轨实例、全曲核心动机集合以及跨音轨的变奏模仿关系。
 * 支持按名称查找音轨、获取跨轨模仿网络以及与另一首作品对比动机重合度。
 */
export class 音乐作品 {
  private readonly 作品名称值: string
  private readonly 音轨列表: readonly 音轨[]
  private readonly 全曲动机列表: readonly 动机[]
  private readonly 跨轨变奏列表: readonly 变奏关系[]

  public constructor(参数: {
    作品名称?: string | undefined
    音轨列表: readonly 音轨[]
    全曲动机列表: readonly 动机[]
    跨轨变奏列表: readonly 变奏关系[]
  }) {
    if (参数.音轨列表.length === 0) {
      throw new Error('音乐作品至少需要包含 1 条音轨')
    }
    this.作品名称值 = 参数.作品名称 ?? '未命名作品'
    this.音轨列表 = [...参数.音轨列表]
    this.全曲动机列表 = [...参数.全曲动机列表]
    this.跨轨变奏列表 = [...参数.跨轨变奏列表]
  }

  public 获得作品名称(): string {
    return this.作品名称值
  }

  public 获得音轨列表(): readonly 音轨[] {
    return [...this.音轨列表]
  }

  public 获得音轨(音轨名称: string): 音轨 | undefined {
    return this.音轨列表.find((轨) => 轨.获得名称() === 音轨名称)
  }

  public 获得全曲核心动机(): readonly 动机[] {
    return [...this.全曲动机列表]
  }

  public 获得跨轨变奏关系(): readonly 变奏关系[] {
    return [...this.跨轨变奏列表]
  }

  /**
   * 汇总全曲所有的变奏演化关系（包含各音轨内部变奏与跨音轨模仿关系）。
   */
  public 获得全部变奏关系(): 变奏关系[] {
    let 结果: 变奏关系[] = []
    for (let 轨 of this.音轨列表) {
      结果.push(...轨.获得轨内变奏列表())
    }
    结果.push(...this.跨轨变奏列表)
    return 结果
  }

  /**
   * 对比当前作品与另一首作品在核心动机上的重合度（范围 0..1）。
   */
  public 对比动机重合度(
    另一作品: 音乐作品,
    相似度阈值 = 0.72,
  ): { 重合度: number; 匹配动机对: Array<{ 本作品动机: 动机; 对方动机: 动机; 手法: string; 相似度: number }> } {
    let 对方动机列表 = 另一作品.获得全曲核心动机()
    if (this.全曲动机列表.length === 0 || 对方动机列表.length === 0) {
      return { 重合度: 0, 匹配动机对: [] }
    }

    let 匹配动机对: Array<{ 本作品动机: 动机; 对方动机: 动机; 手法: string; 相似度: number }> = []
    for (let 甲 of this.全曲动机列表) {
      for (let 乙 of 对方动机列表) {
        let 匹配 = 甲.与另一动机比对(乙, 相似度阈值)
        if (匹配 !== null) {
          匹配动机对.push({ 本作品动机: 甲, 对方动机: 乙, 手法: 匹配.手法, 相似度: 匹配.相似度 })
        }
      }
    }

    let 基准总数 = Math.max(this.全曲动机列表.length, 对方动机列表.length)
    let 重合度 = Number(Math.min(1, 匹配动机对.length / 基准总数).toFixed(3))
    return { 重合度, 匹配动机对 }
  }
}
