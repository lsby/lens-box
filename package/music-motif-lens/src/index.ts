import { 乐句切分配置, 切分乐句序列, 规范化音轨音符 } from './algorithm/lbdm.js'
import {
  动机挖掘配置,
  挖掘核心动机,
  曲式聚类配置,
  识别跨轨变奏关系,
  识别轨内变奏关系,
} from './algorithm/motif-miner.js'
import { 变奏匹配配置 } from './algorithm/variation-matcher.js'
import { 音符 } from './model/note.js'
import { 乐句 } from './model/phrase.js'
import { 音轨 } from './model/track.js'
import { 音乐作品 } from './model/work.js'
import { 作品剖析输入, 作品剖析输入Schema, 重音处理策略 } from './schema.js'

export type { 乐句切分配置 } from './algorithm/lbdm.js'
export type { 动机挖掘配置, 曲式聚类配置 } from './algorithm/motif-miner.js'
export type { 变奏匹配结果, 变奏匹配配置 } from './algorithm/variation-matcher.js'
export * from './model/motif.js'
export * from './model/note.js'
export * from './model/phrase.js'
export * from './model/pitch.js'
export * from './model/track.js'
export * from './model/variation.js'
export * from './model/work.js'
export * from './schema.js'

/**
 * 构造音乐动机透镜所需的分析策略与超参数配置。
 */
export type 音乐动机透镜配置 = {
  重音处理策略?: 重音处理策略
  乐句切分配置?: 乐句切分配置
  动机挖掘配置?: 动机挖掘配置
  变奏匹配配置?: 变奏匹配配置
  跨轨变奏配置?: 变奏匹配配置
  曲式聚类配置?: 曲式聚类配置
}

/**
 * 音乐动机透镜是从计算音乐学与符号序列视角剖析多音轨乐谱的无状态非大模型认知工具。
 * 里面组合了重音主旋律抽取策略、LBDM 乐句切分配置、动机挖掘参数、变奏匹配超参数与曲式聚类参数。
 * 主要负责将十二平均律音符输入流转化为包含动机基因与轨内/跨轨变奏轨迹的充血音乐作品对象。
 */
export class 音乐动机透镜 {
  private readonly 重音策略: 重音处理策略
  private readonly 切分配置: 乐句切分配置 | undefined
  private readonly 挖掘配置: 动机挖掘配置 | undefined
  private readonly 变奏配置: 变奏匹配配置 | undefined
  private readonly 跨轨配置: 变奏匹配配置 | undefined
  private readonly 曲式配置: 曲式聚类配置 | undefined

  public constructor(配置?: 音乐动机透镜配置) {
    let 阈值 = 配置?.变奏匹配配置?.最低相似度阈值 ?? 0.68
    if (阈值 <= 0 || 阈值 > 1) {
      throw new Error(`变奏相似度阈值必须在 (0, 1] 范围内，实际为: ${String(阈值)}`)
    }
    this.重音策略 = 配置?.重音处理策略 ?? '提取最高音'
    this.切分配置 = 配置?.乐句切分配置
    this.挖掘配置 = 配置?.动机挖掘配置
    this.变奏配置 = 配置?.变奏匹配配置
    this.跨轨配置 = 配置?.跨轨变奏配置 ?? 配置?.变奏匹配配置
    this.曲式配置 = 配置?.曲式聚类配置
  }

  /**
   * 对输入的符号化多音轨作品进行完整剖析，返回充血的音乐作品对象。
   */
  public 剖析作品(原始输入: 作品剖析输入): 音乐作品 {
    let 输入 = 作品剖析输入Schema.parse(原始输入)
    let 构建音轨列表: 音轨[] = []
    let 全部乐句: 乐句[] = []

    for (let 轨输入 of 输入.音轨列表) {
      let 原始音符们 = 轨输入.音符列表.map((项) => new 音符(项.音名, 项.按下时间, 项.弹起时间))
      let 规范音符们 = 规范化音轨音符(原始音符们, this.重音策略)
      let 乐句音符组 = 切分乐句序列(规范音符们, this.切分配置)

      let 轨内乐句列表: 乐句[] = []
      let 当前音符偏移 = 0
      for (let 序号 = 0; 序号 < 乐句音符组.length; 序号 += 1) {
        let 句音符 = 乐句音符组[序号]
        if (句音符 === undefined || 句音符.length === 0) {
          continue
        }
        let 新乐句 = new 乐句({
          序号: 序号 + 1,
          音轨名称: 轨输入.音轨名称,
          起始音符下标: 当前音符偏移,
          音符列表: 句音符,
        })
        轨内乐句列表.push(新乐句)
        全部乐句.push(新乐句)
        当前音符偏移 += 句音符.length
      }

      let 轨内动机 = 挖掘核心动机(轨内乐句列表, this.挖掘配置)
      let 轨内变奏 = 识别轨内变奏关系(轨内乐句列表, this.变奏配置)

      构建音轨列表.push(
        new 音轨({
          名称: 轨输入.音轨名称,
          音符列表: 规范音符们,
          乐句列表: 轨内乐句列表,
          核心动机列表: 轨内动机,
          轨内变奏列表: 轨内变奏,
          曲式聚类配置: this.曲式配置,
        }),
      )
    }

    let 全曲动机 = 挖掘核心动机(全部乐句, this.挖掘配置)
    let 跨轨变奏 = 识别跨轨变奏关系(全部乐句, this.跨轨配置)

    return new 音乐作品({
      作品名称: 输入.作品名称,
      音轨列表: 构建音轨列表,
      全曲动机列表: 全曲动机,
      跨轨变奏列表: 跨轨变奏,
    })
  }
}
