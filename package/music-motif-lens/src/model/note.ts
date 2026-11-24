import { 音高 } from './pitch.js'

/**
 * 音符是音轨中最小的时间与音高发声单元。
 * 内部包含规范化的音高对象以及经过校验的按下时间与弹起时间。
 * 支持计算自身持续时长、到后续音符的起始时间间隔（IOI）、休止间隙以及时间重叠判定。
 */
export class 音符 {
  private readonly 音高值: 音高
  private readonly 按下时间值: number
  private readonly 弹起时间值: number

  public constructor(音名或音高: string | 音高, 按下时间: number, 弹起时间: number) {
    if (Number.isFinite(按下时间) === false || 按下时间 < 0) {
      throw new Error(`音符按下时间必须为非负有限数字，实际为: ${String(按下时间)}`)
    }
    if (Number.isFinite(弹起时间) === false || 弹起时间 <= 按下时间) {
      throw new Error(`音符弹起时间(${String(弹起时间)})必须严格大于按下时间(${String(按下时间)})`)
    }
    this.音高值 = typeof 音名或音高 === 'string' ? new 音高(音名或音高) : 音名或音高
    this.按下时间值 = 按下时间
    this.弹起时间值 = 弹起时间
  }

  public 获得音高(): 音高 {
    return this.音高值
  }

  public 获得按下时间(): number {
    return this.按下时间值
  }

  public 获得弹起时间(): number {
    return this.弹起时间值
  }

  public 获得持续时长(): number {
    return this.弹起时间值 - this.按下时间值
  }

  /**
   * 计算从当前音符按下到下一个音符按下的起始时间间隔（IOI）。
   */
  public 到下一音起始间隔(下一音: 音符): number {
    return Math.max(0, 下一音.按下时间值 - this.按下时间值)
  }

  /**
   * 计算当前音符弹起后到下一个音符按下之间的休止间隙（重叠时返回 0）。
   */
  public 到下一音休止间隙(下一音: 音符): number {
    return Math.max(0, 下一音.按下时间值 - this.弹起时间值)
  }

  /**
   * 判断两个音符在发声时间区间上是否存在交叉重叠。
   */
  public 是否时间重叠(其他: 音符, 容差 = 1e-6): boolean {
    return this.按下时间值 < 其他.弹起时间值 - 容差 && 其他.按下时间值 < this.弹起时间值 - 容差
  }

  /**
   * 返回移调后的新音符，保持时间区间不变。
   */
  public 移调(半音偏移: number): 音符 {
    return new 音符(this.音高值.移调(半音偏移), this.按下时间值, this.弹起时间值)
  }
}
