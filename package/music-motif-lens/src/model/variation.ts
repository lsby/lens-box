import { 变奏手法, 片段定位 } from '../schema.js'

/**
 * 变奏关系是描述原型音乐片段与衍生片段之间演化连接的领域关系概念。
 * 内部记录源片段定位、目标片段定位、变奏手法、移调半音数、相似度得分与变换说明。
 * 支持判定是否为跨音轨模仿关系以及生成结构化的变奏摘要文本。
 */
export class 变奏关系 {
  private readonly 源定位值: 片段定位
  private readonly 目标定位值: 片段定位
  private readonly 手法值: 变奏手法
  private readonly 移调半音数值: number
  private readonly 相似度值: number
  private readonly 说明值: string

  public constructor(参数: {
    源定位: 片段定位
    目标定位: 片段定位
    手法: 变奏手法
    移调半音数: number
    相似度: number
    说明: string
  }) {
    if (参数.相似度 < 0 || 参数.相似度 > 1) {
      throw new Error(`变奏相似度必须在 [0, 1] 范围内，实际为: ${String(参数.相似度)}`)
    }
    this.源定位值 = { ...参数.源定位 }
    this.目标定位值 = { ...参数.目标定位 }
    this.手法值 = 参数.手法
    this.移调半音数值 = 参数.移调半音数
    this.相似度值 = 参数.相似度
    this.说明值 = 参数.说明
  }

  public 获得源定位(): 片段定位 {
    return { ...this.源定位值 }
  }

  public 获得目标定位(): 片段定位 {
    return { ...this.目标定位值 }
  }

  public 获得变奏手法(): 变奏手法 {
    return this.手法值
  }

  public 获得移调半音数(): number {
    return this.移调半音数值
  }

  public 获得相似度(): number {
    return this.相似度值
  }

  public 获得说明(): string {
    return this.说明值
  }

  /**
   * 判断该变奏关系是否发生在不同音轨之间（例如声部呼应、卡农模仿）。
   */
  public 是否跨音轨(): boolean {
    return this.源定位值.音轨名称 !== this.目标定位值.音轨名称
  }

  public 生成摘要(): string {
    let 范围文本 = this.是否跨音轨() ? '跨轨模仿' : '轨内变奏'
    return `[${范围文本}] ${this.目标定位值.音轨名称}#乐句${String(this.目标定位值.乐句序号)} <- ${this.源定位值.音轨名称}#乐句${String(this.源定位值.乐句序号)} | ${this.手法值} (相似度 ${String(this.相似度值)})：${this.说明值}`
  }
}
