// 每个读数占一行，便于手工复算，也避免把相邻读数拼成新的参照字串。
export function 合成工单(): string[] {
  return Array.from({ length: 8 }, (_, 篇号) => {
    let 记录 = ['称重', '测温', '点数', '复核', '封箱', '签收']
    if (篇号 < 2) 记录.push(...Array<string>(4).fill('釉裂'))
    if (篇号 < 4) 记录.push('返修', '返修')
    if (篇号 === 0) 记录.push('缺角')
    return 记录.join('\n')
  })
}

// 两种表单各八份。它们共用十二个字段代码，其余六个字段各用一种语言填写两次。
export function 合成双语表单(): string[] {
  let 共用字段 = [...'ABCDEFGHIJKL'].map((字母) => 字母 + '0')
  return Array.from({ length: 16 }, (_, 篇号) => {
    let 本地字段 =
      篇号 < 8 ? ['点検', '入荷', '出荷', '発送', '伝票', '備考'] : ['检查', '收货', '发货', '寄出', '单据', '备注']
    return [...共用字段, ...本地字段, ...本地字段].join('\n')
  })
}
