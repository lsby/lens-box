import OpenAI from 'openai'
import type { Fetch } from 'openai/core.js'
import { FormalLogicLens, formatFormula } from '../src/index.js'

// 默认连接本地 Ollama 的 gpt-oss 模型，可通过环境变量覆盖（DEMO_API_KEY / DEMO_BASE_URL / DEMO_MODEL）
let 模型配置 = {
  apiKey: process.env['DEMO_API_KEY'] ?? 'ollama',
  baseURL: process.env['DEMO_BASE_URL'] ?? 'http://127.0.0.1:11434/v1',
  模型名称: process.env['DEMO_MODEL'] ?? 'gpt-oss-20b',
  是否支持函数调用: true,
}

async function 运行形式逻辑剖析演示(): Promise<void> {
  if (模型配置.apiKey.trim().length === 0 || 模型配置.模型名称.trim().length === 0) {
    throw new Error('请通过环境变量（DEMO_API_KEY、DEMO_BASE_URL、DEMO_MODEL）提供模型配置后再运行')
  }

  let 客户端 = new OpenAI({
    apiKey: 模型配置.apiKey,
    ...(模型配置.baseURL.trim().length > 0 ? { baseURL: 模型配置.baseURL } : {}),
    // Node 24 下 SDK 默认的 node-fetch v2 在长 SSE 流式响应上易触发 ERR_STREAM_PREMATURE_CLOSE，改用 Node 内置 fetch；
    // SDK 的 Fetch 类型基于 node-fetch v2，与内置 fetch（undici）静态类型不兼容但运行时语义一致，此处一次性显式桥接
    fetch: globalThis.fetch as unknown as Fetch,
  })

  let 透镜 = new FormalLogicLens({
    openaiClient: 客户端,
    model: 模型配置.模型名称,
    supportsFunctionCalling: 模型配置.是否支持函数调用,
  })

  let 发言 = [
    '如果明天下雨，我就不去爬山。',
    '所有认真准备的人都能通过考核。',
    '张三是认真准备的人。',
    '只要坚持训练，就一定会进步。',
    // 复杂嵌套命题
    '如果小王不迟到，那么他要么坐地铁，要么骑车。',
    '只有既努力学习又方法正确，才能取得好成绩。',
    // 多重复合
    '除非公司既提高薪资又改善工作条件，否则员工不会满意，而且可能离职。',
    // 推理
    '如果小王不去，那么只有小李去，小张才去；但事实上小张去了而小李没去，所以小王去了。',
    // 并非只要……就……
    '并非只要报名就能参加考试；只有完成资格审核并且缴纳费用的人，才能参加考试。',
    // 量词 + 除非
    '没有一个通过初试但没有通过复试的人会被最终录用，除非有特别批准。',
    // 量词 + 复合谓词
    '所有参加面试的候选人中，有些表现优秀但缺乏经验，而所有缺乏经验的人都需要培训，除非他们已有相关证书。',
    // 关系命题
    '甲认识乙，乙认识丙，但甲不认识丙；如果认识关系具有传递性，那么上述命题不一致。',
    // 嵌套条件句
    '如果明天不下雨，我们就去爬山；否则，如果天气凉爽，我们就去博物馆，除非博物馆闭馆。',
    // 范围歧义
    '除非你道歉，否则我不原谅你，也不合作。',
  ].join('\n')

  let 篇章 = await 透镜.analyze({ text: 发言, sourceLabel: '手动演示' })

  console.log('=== 形式逻辑命题 ===')
  for (let 命题 of 篇章.getPropositions()) {
    console.log(`[命题] ${命题.getContent()}`)
    console.log(`    公式: ${命题.getFormulaSource()}`)
    console.log(`    规范化: ${formatFormula(命题.getFormulaAst())}`)
    console.log(`    依据: "${命题.getEvidence().quote}"`)
    let 备注 = 命题.getNote()
    if (备注 !== null) {
      console.log(`    备注: ${备注}`)
    }
  }

  console.log('\n=== 谓词符号表 ===')
  for (let 符号 of 篇章.listPredicateSymbols()) {
    console.log(`${符号.symbol} / ${String(符号.arity)} 元`)
  }

  console.log('\n=== 常量表 ===')
  console.log(篇章.listConstants().join('、'))
}

void 运行形式逻辑剖析演示()
