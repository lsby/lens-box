import { 音符 } from '../model/note.js'
import { 变奏手法, 轮廓方向 } from '../schema.js'

/**
 * 旋律片段的变换不变特征快照。
 */
export type 旋律特征编码 = { 起始半音: number; 音程序列: number[]; 轮廓序列: 轮廓方向[]; 时长比例序列: number[] }

/**
 * 变奏匹配评估结果。
 */
export type 变奏匹配结果 = { 手法: 变奏手法; 相似度: number; 移调半音数: number; 说明: string }

/**
 * 变奏匹配超参数配置。
 */
export type 变奏匹配配置 = {
  最低相似度阈值?: number | undefined
  调内模进半音容差?: number | undefined
  节奏缩放判定阈值?: number | undefined
  对齐音程权重?: number | undefined
}

/**
 * 从音符序列提取相对音程序列、Parsons 轮廓码与归一化时长比例序列。
 */
export function 提取旋律特征编码(音符列表: readonly 音符[]): 旋律特征编码 {
  let 首音 = 音符列表[0]
  if (首音 === undefined) {
    return { 起始半音: 0, 音程序列: [], 轮廓序列: [], 时长比例序列: [] }
  }

  let 音程序列: number[] = []
  let 轮廓序列: 轮廓方向[] = []
  let 时长列表: number[] = []

  for (let 索引 = 0; 索引 < 音符列表.length; 索引 += 1) {
    let 当前 = 音符列表[索引]
    if (当前 === undefined) {
      continue
    }
    let 下一个 = 音符列表[索引 + 1]
    if (下一个 !== undefined) {
      let 音程 = 当前.获得音高().到目标音程(下一个.获得音高())
      音程序列.push(音程)
      轮廓序列.push(音程 > 0 ? 'U' : 音程 < 0 ? 'D' : 'R')
      let 间隔 = 当前.到下一音起始间隔(下一个)
      时长列表.push(间隔 > 1e-6 ? 间隔 : 当前.获得持续时长())
    } else {
      时长列表.push(当前.获得持续时长())
    }
  }

  let 基准时长 = 1
  let 正时长 = 时长列表.filter((值) => 值 > 1e-6)
  if (正时长.length > 0) {
    let 排序 = [...正时长].sort((甲, 乙) => 甲 - 乙)
    基准时长 = 排序[0] ?? 1
  }
  let 时长比例序列 = 时长列表.map((值) => Number((值 / 基准时长).toFixed(2)))

  return { 起始半音: 首音.获得音高().获得半音编号(), 音程序列, 轮廓序列, 时长比例序列 }
}

function 序列完全相等(甲: readonly number[], 乙: readonly number[], 容差 = 0): boolean {
  if (甲.length !== 乙.length) {
    return false
  }
  for (let 索引 = 0; 索引 < 甲.length; 索引 += 1) {
    let 左值 = 甲[索引]
    let 右值 = 乙[索引]
    if (左值 === undefined || 右值 === undefined || Math.abs(左值 - 右值) > 容差) {
      return false
    }
  }
  return true
}

function 轮廓完全相等(甲: readonly 轮廓方向[], 乙: readonly 轮廓方向[]): boolean {
  if (甲.length !== 乙.length) {
    return false
  }
  for (let 索引 = 0; 索引 < 甲.length; 索引 += 1) {
    if (甲[索引] !== 乙[索引]) {
      return false
    }
  }
  return true
}

function 计算节奏比例相似度(甲: readonly number[], 乙: readonly number[]): number {
  if (甲.length === 0 && 乙.length === 0) {
    return 1
  }
  if (甲.length !== 乙.length) {
    let 较短 = Math.min(甲.length, 乙.length)
    let 较长 = Math.max(甲.length, 乙.length)
    return 较长 === 0 ? 1 : (较短 / 较长) * 0.7
  }
  let 累计分 = 0
  for (let 索引 = 0; 索引 < 甲.length; 索引 += 1) {
    let 左值 = 甲[索引] ?? 1
    let 右值 = 乙[索引] ?? 1
    let 最大值 = Math.max(左值, 右值, 1e-6)
    累计分 += 1 - Math.abs(左值 - 右值) / 最大值
  }
  return 累计分 / 甲.length
}

/**
 * 基于 Mongeau-Sankoff / Smith-Waterman 局部对齐思想计算两条音程序列的归一化相似度（支持加花与简缩）。
 */
export function 计算局部序列对齐度(原型音程: readonly number[], 目标音程: readonly number[]): number {
  let 行数 = 原型音程.length
  let 列数 = 目标音程.length
  if (行数 === 0 || 列数 === 0) {
    return 0
  }

  let 得分矩阵: number[][] = Array.from({ length: 行数 + 1 }, () => Array.from({ length: 列数 + 1 }, () => 0))
  let 最高分 = 0

  for (let 行 = 1; 行 <= 行数; 行 += 1) {
    for (let 列 = 1; 列 <= 列数; 列 += 1) {
      let 原型值 = 原型音程[行 - 1] ?? 0
      let 目标值 = 目标音程[列 - 1] ?? 0
      let 音程差 = Math.abs(原型值 - 目标值)

      let 替换分 = -1.5
      if (音程差 === 0) {
        替换分 = 2.0
      } else if (音程差 <= 2 && Math.sign(原型值) === Math.sign(目标值)) {
        // 调内大小二度微调给予正向容差分
        替换分 = 1.2
      } else if (Math.sign(原型值) === Math.sign(目标值)) {
        替换分 = 0.2
      }

      let 左上 = 得分矩阵[行 - 1]?.[列 - 1] ?? 0
      let 上方 = 得分矩阵[行 - 1]?.[列] ?? 0
      let 左方 = 得分矩阵[行]?.[列 - 1] ?? 0

      let 当前最高 = Math.max(0, 左上 + 替换分, 上方 - 1.0, 左方 - 1.0)
      let 当前行 = 得分矩阵[行]
      if (当前行 !== undefined) {
        当前行[列] = 当前最高
      }
      if (当前最高 > 最高分) {
        最高分 = 当前最高
      }
    }
  }

  let 理论满分 = Math.max(行数, 列数) * 2.0
  return Math.min(1, 最高分 / 理论满分)
}

/**
 * 综合判断目标旋律片段相对于原型片段是否构成变奏，并给出精确手法与相似度。
 */
export function 评估变奏关系(
  原型: 旋律特征编码,
  目标: 旋律特征编码,
  配置?: number | 变奏匹配配置,
): 变奏匹配结果 | null {
  if (原型.音程序列.length < 2 || 目标.音程序列.length < 2) {
    return null
  }

  let 最低相似度阈值 = typeof 配置 === 'number' ? 配置 : (配置?.最低相似度阈值 ?? 0.68)
  let 调内模进半音容差 = typeof 配置 === 'number' ? 2 : (配置?.调内模进半音容差 ?? 2)
  let 节奏缩放判定阈值 = typeof 配置 === 'number' ? 0.85 : (配置?.节奏缩放判定阈值 ?? 0.85)
  let 对齐音程权重 = typeof 配置 === 'number' ? 0.75 : (配置?.对齐音程权重 ?? 0.75)
  let 对齐节奏权重 = 1 - 对齐音程权重

  let 移调半音数 = 目标.起始半音 - 原型.起始半音
  let 节奏相似度 = 计算节奏比例相似度(原型.时长比例序列, 目标.时长比例序列)

  // 1. 原样重复 / 严格移调 / 节奏缩放
  if (序列完全相等(原型.音程序列, 目标.音程序列, 0)) {
    if (移调半音数 === 0 && 节奏相似度 >= 0.9) {
      return { 手法: '原样重复', 相似度: 1, 移调半音数: 0, 说明: '音程与节奏完全一致' }
    }
    if (节奏相似度 < 节奏缩放判定阈值) {
      let 综合分 = Number((0.75 + 节奏相似度 * 0.25).toFixed(3))
      return {
        手法: '节奏缩放',
        相似度: 综合分,
        移调半音数,
        说明: `音程序列完全一致，时值比例发生缩放（移调 ${String(移调半音数)} 半音）`,
      }
    }
    return {
      手法: '严格移调',
      相似度: Number((0.85 + 节奏相似度 * 0.15).toFixed(3)),
      移调半音数,
      说明: `整体严格移调 ${String(移调半音数)} 半音`,
    }
  }

  // 2. 倒影（音程正负号反转）
  let 倒影音程 = 原型.音程序列.map((音程) => -音程)
  if (序列完全相等(倒影音程, 目标.音程序列, 0)) {
    return {
      手法: '倒影',
      相似度: Number((0.82 + 节奏相似度 * 0.15).toFixed(3)),
      移调半音数,
      说明: '音程方向完全反转形成倒影变奏',
    }
  }

  // 3. 逆行（音程序列倒序）
  let 逆行音程 = [...原型.音程序列].reverse().map((音程) => -音程)
  if (序列完全相等(逆行音程, 目标.音程序列, 0)) {
    return {
      手法: '逆行',
      相似度: Number((0.8 + 节奏相似度 * 0.15).toFixed(3)),
      移调半音数,
      说明: '音高序列从后往前倒序呈现逆行变奏',
    }
  }

  // 4. 调内模进（长度一致、升降轮廓完全一致、局部音程差在容差内）
  if (
    原型.音程序列.length === 目标.音程序列.length &&
    轮廓完全相等(原型.轮廓序列, 目标.轮廓序列) &&
    序列完全相等(原型.音程序列, 目标.音程序列, 调内模进半音容差)
  ) {
    let 局部对齐 = 计算局部序列对齐度(原型.音程序列, 目标.音程序列)
    let 综合分 = Number((局部对齐 * 0.65 + 节奏相似度 * 0.35).toFixed(3))
    if (综合分 >= 最低相似度阈值) {
      return {
        手法: '调内模进',
        相似度: 综合分,
        移调半音数,
        说明: `轮廓与节奏型一致，按调内音阶微调移位 ${String(移调半音数)} 半音`,
      }
    }
  }

  // 5. 加花变奏 / 简缩变奏：要求音符数量严格增减，避免等长无关序列误判
  if (目标.音程序列.length === 原型.音程序列.length) {
    return null
  }

  let 对齐分 = 计算局部序列对齐度(原型.音程序列, 目标.音程序列)
  let 综合相似度 = Number((对齐分 * 对齐音程权重 + 节奏相似度 * 对齐节奏权重).toFixed(3))
  if (综合相似度 >= 最低相似度阈值) {
    let 手法: 变奏手法 = 目标.音程序列.length > 原型.音程序列.length ? '加花变奏' : '简缩变奏'
    return {
      手法,
      相似度: 综合相似度,
      移调半音数,
      说明: 手法 === '加花变奏' ? '保留核心音程骨架并插入过渡/装饰音' : '保留核心轮廓并删减了部分过渡音',
    }
  }

  return null
}
