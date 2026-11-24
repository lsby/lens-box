import { 曲式聚类配置, 生成自相似曲式标签 } from '../algorithm/motif-miner.js'
import { 动机 } from './motif.js'
import { 音符 } from './note.js'
import { 乐句 } from './phrase.js'
import { 变奏关系 } from './variation.js'

/**
 * 音轨是音乐作品中一条独立的声部线或乐器声部。
 * 内部组合了音轨名称、规范化后的有序音符序列、LBDM 切分后的乐句列表、轨内核心动机以及轨内变奏关系。
 * 支持按时间范围查询音符、获取曲式自相似结构标签以及定位本轨的音高最高点（高潮点）。
 */
export class 音轨 {
  private readonly 名称值: string
  private readonly 音符列表: readonly 音符[]
  private readonly 乐句列表: readonly 乐句[]
  private readonly 动机列表: readonly 动机[]
  private readonly 轨内变奏列表: readonly 变奏关系[]
  private readonly 默认曲式配置: 曲式聚类配置 | undefined

  public constructor(参数: {
    名称: string
    音符列表: readonly 音符[]
    乐句列表: readonly 乐句[]
    核心动机列表: readonly 动机[]
    轨内变奏列表: readonly 变奏关系[]
    曲式聚类配置?: 曲式聚类配置 | undefined
  }) {
    if (参数.音符列表.length === 0) {
      throw new Error(`音轨 "${参数.名称}" 至少需要包含 1 个音符`)
    }
    this.名称值 = 参数.名称
    this.音符列表 = [...参数.音符列表]
    this.乐句列表 = [...参数.乐句列表]
    this.动机列表 = [...参数.核心动机列表]
    this.轨内变奏列表 = [...参数.轨内变奏列表]
    this.默认曲式配置 = 参数.曲式聚类配置
  }

  public 获得名称(): string {
    return this.名称值
  }

  public 获得音符列表(): readonly 音符[] {
    return [...this.音符列表]
  }

  public 获得乐句列表(): readonly 乐句[] {
    return [...this.乐句列表]
  }

  public 获得核心动机列表(): readonly 动机[] {
    return [...this.动机列表]
  }

  public 获得轨内变奏列表(): readonly 变奏关系[] {
    return [...this.轨内变奏列表]
  }

  /**
   * 查询与指定时间区间有交集的音符列表。
   */
  public 查询时间区间音符(起始时间: number, 结束时间: number): 音符[] {
    return this.音符列表.filter((音) => 音.获得弹起时间() > 起始时间 && 音.获得按下时间() < 结束时间)
  }

  /**
   * 获取基于自相似矩阵聚类生成的段落结构标签（如 ['A', 'B', "B'", "B'", 'A', 'B']）。
   */
  public 获得曲式结构标签(配置?: number | 曲式聚类配置): string[] {
    return 生成自相似曲式标签(this.乐句列表, 配置 ?? this.默认曲式配置)
  }

  /**
   * 定位本音轨的音高最高点（旋律高潮点）及其出现时间。
   */
  public 定位旋律高潮点(): { 音符对象: 音符; 音符下标: number; 时间进度比例: number } {
    let 最高音 = this.音符列表[0]
    if (最高音 === undefined) {
      throw new Error('音轨为空')
    }
    let 最高下标 = 0

    for (let 索引 = 1; 索引 < this.音符列表.length; 索引 += 1) {
      let 当前音 = this.音符列表[索引]
      if (当前音 === undefined) {
        continue
      }
      if (当前音.获得音高().获得半音编号() > 最高音.获得音高().获得半音编号()) {
        最高音 = 当前音
        最高下标 = 索引
      }
    }

    let 首音 = this.音符列表[0]
    let 尾音 = this.音符列表[this.音符列表.length - 1]
    let 起点 = 首音 !== undefined ? 首音.获得按下时间() : 0
    let 终点 = 尾音 !== undefined ? 尾音.获得弹起时间() : 起点 + 1
    let 总时长 = Math.max(终点 - 起点, 1e-6)
    let 时间进度比例 = Number(((最高音.获得按下时间() - 起点) / 总时长).toFixed(3))

    return { 音符对象: 最高音, 音符下标: 最高下标, 时间进度比例 }
  }
}
