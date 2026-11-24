import { z } from 'zod'

/**
 * 单个音符的原始输入校验 Schema。
 */
export let 音符输入Schema = z
  .object({
    音名: z.string().trim().min(2, '音名不能为空'),
    按下时间: z.number().finite('按下时间必须为有限数字').min(0, '按下时间不能为负数'),
    弹起时间: z.number().finite('弹起时间必须为有限数字').gt(0, '弹起时间必须大于 0'),
  })
  .refine((数据) => 数据.弹起时间 > 数据.按下时间, { message: '音符弹起时间必须严格大于按下时间' })

/**
 * 单条音轨的原始输入校验 Schema。
 */
export let 音轨输入Schema = z.object({
  音轨名称: z.string().trim().min(1, '音轨名称不能为空'),
  音符列表: z.array(音符输入Schema).min(1, '每条音轨至少需要包含 1 个音符'),
})

/**
 * 整首音乐作品剖析的原始输入校验 Schema。
 */
export let 作品剖析输入Schema = z.object({
  作品名称: z.string().trim().min(1).optional(),
  音轨列表: z.array(音轨输入Schema).min(1, '作品至少需要包含 1 条音轨'),
})

export type 音符输入 = z.infer<typeof 音符输入Schema>
export type 音轨输入 = z.infer<typeof 音轨输入Schema>
export type 作品剖析输入 = z.infer<typeof 作品剖析输入Schema>

/**
 * Parsons 轮廓码符号：上行 U、下行 D、同音 R。
 */
export type 轮廓方向 = 'U' | 'D' | 'R'

/**
 * 识别出的变奏手法枚举。
 */
export type 变奏手法 = '原样重复' | '严格移调' | '调内模进' | '倒影' | '逆行' | '节奏缩放' | '加花变奏' | '简缩变奏'

/**
 * 片段在作品中的精确位置定位。
 */
export type 片段定位 = {
  音轨名称: string
  乐句序号: number
  起始音符下标: number
  结束音符下标: number
  起始时间: number
  结束时间: number
}

/**
 * 乐句的旋律几何形态摘要。
 */
export type 旋律形态摘要 = {
  音符数: number
  总时长: number
  音域跨度半音: number
  最低音名: string
  最高音名: string
  级进比例: number
  跳进比例: number
  同音重复比例: number
}

/**
 * 音符的时间重叠处理策略：保留全部音符，或按 Skyline 策略在重叠时段提取最高音。
 */
export type 重音处理策略 = '保留全部' | '提取最高音'
