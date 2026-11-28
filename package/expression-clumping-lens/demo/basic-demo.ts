import { 成团语料 } from '../src/index.js'
import { 日常日记, 群聊记录 } from './synthetic-corpus.js'

let 日记语料 = new 成团语料(日常日记())
console.log('=== 场景一：日常日记（对比集中成团与分散出现） ===')
for (let 表达 of ['咖啡', '散步', '露营', '极光', '滑雪']) {
  let 结果 = 日记语料.观察(表达)
  console.log(JSON.stringify({ 表达, ...结果 }))
}

let 全部群聊 = 群聊记录()
let 团建群聊 = 全部群聊.slice(0, 6)
console.log('\n=== 场景二：群聊记录（对比语料范围变化对成团分数的影响） ===')
for (let [范围, 文档] of [
  ['全部群聊（团建 + 加班）', 全部群聊],
  ['仅团建群聊', 团建群聊],
] as [string, string[]][]) {
  let 结果 = new 成团语料(文档).观察('帐篷')
  console.log(JSON.stringify({ 范围, 表达: '帐篷', ...结果 }))
}
