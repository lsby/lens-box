let 半音字母表: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

let 标准升号音名表: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/**
 * 音高是音乐动机透镜中用于表达十二平均律音高的值对象。
 * 内部维护规范化音名与对应的 MIDI 半音编号，保证音高解析与半音换算的一致性。
 * 支持计算到其他音高的有向半音音程、按半音移调以及判断八度等价关系。
 */
export class 音高 {
  /**
   * 由 MIDI 半音编号直接构造音高对象（例如 60 对应 C4）。
   */
  public static 从半音编号创建(半音编号: number): 音高 {
    if (Number.isInteger(半音编号) === false || 半音编号 < 0 || 半音编号 > 127) {
      throw new Error(`非法 MIDI 半音编号: ${String(半音编号)}，有效范围为 0..127`)
    }
    let 音级索引 = 半音编号 % 12
    let 八度 = Math.floor(半音编号 / 12) - 1
    let 音级名 = 标准升号音名表[音级索引]
    if (音级名 === undefined) {
      throw new Error(`无法映射半音编号: ${String(半音编号)}`)
    }
    return new 音高(`${音级名}${String(八度)}`)
  }
  private static 解析音名(原始音名: string): { 规范音名: string; 半音编号: number } {
    let 文本 = 原始音名.trim()
    let 匹配 = /^([A-Ga-g])(#|b|♯|♭)?(-?\d+)$/.exec(文本)
    if (匹配 === null) {
      throw new Error(`非法十二平均律音名: "${原始音名}"，示例格式为 C4、F#4、Bb3`)
    }
    let 字母 = 匹配[1]
    let 升降号 = 匹配[2] ?? ''
    let 八度文本 = 匹配[3]
    if (字母 === undefined || 八度文本 === undefined) {
      throw new Error(`音名解析失败: "${原始音名}"`)
    }

    let 大写字母 = 字母.toUpperCase()
    let 基础半音 = 半音字母表[大写字母]
    if (基础半音 === undefined) {
      throw new Error(`未知音名字母: "${字母}"`)
    }

    let 偏移 = 0
    if (升降号 === '#' || 升降号 === '♯') {
      偏移 = 1
    } else if (升降号 === 'b' || 升降号 === '♭') {
      偏移 = -1
    }

    let 八度 = Number.parseInt(八度文本, 10)
    let 半音编号 = (八度 + 1) * 12 + 基础半音 + 偏移
    if (半音编号 < 0 || 半音编号 > 127) {
      throw new Error(`音名 "${原始音名}" 超出十二平均律 MIDI 范围 (0..127)`)
    }

    let 标准升降 = 偏移 === 1 ? '#' : 偏移 === -1 ? 'b' : ''
    return { 规范音名: `${大写字母}${标准升降}${String(八度)}`, 半音编号 }
  }
  private readonly 规范音名: string
  private readonly 半音编号: number

  public constructor(原始音名: string) {
    let { 规范音名, 半音编号 } = 音高.解析音名(原始音名)
    this.规范音名 = 规范音名
    this.半音编号 = 半音编号
  }

  public 获得规范音名(): string {
    return this.规范音名
  }

  public 获得半音编号(): number {
    return this.半音编号
  }

  /**
   * 计算从当前音高到目标音高的有向半音音程（正数表示上行，负数表示下行）。
   */
  public 到目标音程(目标: 音高): number {
    return 目标.半音编号 - this.半音编号
  }

  /**
   * 按指定半音数进行移调并返回一个新的音高对象。
   */
  public 移调(半音偏移: number): 音高 {
    return 音高.从半音编号创建(this.半音编号 + 半音偏移)
  }

  /**
   * 判断两个音高是否在十二平均律上等价（忽略等音异名差异，如 C#4 与 Db4 等价）。
   */
  public 是否同音(其他: 音高): boolean {
    return this.半音编号 === 其他.半音编号
  }
}
