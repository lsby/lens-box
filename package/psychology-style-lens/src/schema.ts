import { z } from 'zod'

/**
 * 社交距离枚举：刻画说话者与倾听者之间的心理距离。
 */
export let 社交距离Schema = z.enum(['亲密', '熟络', '礼貌', '疏离', '对抗'])

export type 社交距离 = z.infer<typeof 社交距离Schema>

/**
 * 权力位阶枚举：刻画说话者在当前对话中所处的相对地位。
 */
export let 权力位阶Schema = z.enum(['上位', '平级', '下位', '模糊'])

export type 权力位阶 = z.infer<typeof 权力位阶Schema>

/**
 * 人物性格画像 Schema。
 */
export let 人物性格画像Schema = z.object({
  主导特质: z.array(z.string().min(1)).min(1).describe('说话者表现出的核心性格特质列表，例如：["克制", "傲娇"]'),
  情绪基调: z.string().min(1).describe('说话者当下的情绪底色，例如：克制中带有轻微嘲讽'),
  表达动机: z.string().min(1).describe('说话者当下想达成的心理目的'),
  防御或互动姿态: z.string().min(1).describe('心理防御或人际互动姿态，例如：高姿态试探、主动示弱、理性隔离等'),
})

export type 人物性格画像 = z.infer<typeof 人物性格画像Schema>

/**
 * 对话场景环境 Schema。
 */
export let 对话场景环境Schema = z.object({
  场景类型: z.string().min(1).describe('当前对话所处的心理与人际场景类型，例如：熟人间的玩笑式博弈'),
  社交距离: 社交距离Schema.describe('说话者与倾听者之间的心理距离'),
  权力位阶: 权力位阶Schema.describe('说话者在当前对话中所处的相对地位'),
  气氛张力: z.string().min(1).describe('对话氛围中的心理张力，例如：表面轻松但暗含较劲'),
})

export type 对话场景环境 = z.infer<typeof 对话场景环境Schema>

/**
 * 模型单次观察返回的心理学分析结果 Schema。
 */
export let 心理学观察结果Schema = z.object({ 人物性格: 人物性格画像Schema, 对话场景: 对话场景环境Schema })

export type 心理学观察结果 = z.infer<typeof 心理学观察结果Schema>

/**
 * 心理学观察输入 Schema。
 */
export let 心理学观察输入Schema = z.object({
  文本: z.string().trim().min(1, '输入例句文本不能为空'),
  上下文提示: z.string().trim().min(1).nullable().optional(),
  来源标签: z.string().trim().min(1).nullable().optional(),
})

export type 心理学观察输入 = z.infer<typeof 心理学观察输入Schema>

/**
 * 心理学文风样本的纯数据快照 Schema，用于序列化持久化或跨边界传输。
 */
export let 心理学文风样本快照Schema = z.object({
  样本标识: z.string().min(1),
  原文: z.string().min(1),
  人物性格: 人物性格画像Schema,
  对话场景: 对话场景环境Schema,
  记录时间戳: z.number().int().nonnegative(),
  来源标签: z.string().nullable(),
})

export type 心理学文风样本快照 = z.infer<typeof 心理学文风样本快照Schema>

/**
 * 样本查询条件。
 */
export type 心理学样本查询条件 = {
  性格特质关键词?: string
  情绪基调关键词?: string
  场景关键词?: string
  社交距离?: 社交距离
  权力位阶?: 权力位阶
  来源标签?: string
}
