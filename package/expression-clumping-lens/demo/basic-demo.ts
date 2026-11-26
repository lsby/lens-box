import { 成团语料 } from '../src/index.js'
import { 合成双语表单, 合成工单 } from './synthetic-corpus.js'

let 语料 = new 成团语料(合成工单())
for (let 表达 of ['签收', '返修', '釉裂', '缺角', '换轴']) {
  let 结果 = 语料.观察(表达)
  console.log(JSON.stringify({ 表达, ...结果 }))
}

let 表单 = 合成双语表单()
for (let [范围, 文档] of [
  ['全部表单', 表单],
  ['日文表单', 表单.slice(0, 8)],
] as const) {
  console.log(JSON.stringify({ 范围, 表达: '点検', ...new 成团语料(文档).观察('点検') }))
}
