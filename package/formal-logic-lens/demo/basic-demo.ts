import OpenAI from 'openai'
import { FormalLogicLens, formatFormula } from '../src/index.js'

// 默认连接本地 Ollama 的 gpt-oss 模型
let 模型配置 = {
  apiKey: 'ollama',
  baseURL: 'http://127.0.0.1:11434/v1',
  模型名称: 'gpt-oss-20b',
  是否支持函数调用: true,
}

async function 运行形式逻辑剖析演示(): Promise<void> {
  if (模型配置.apiKey.trim().length === 0 || 模型配置.模型名称.trim().length === 0) {
    throw new Error('请先在 demo/basic-demo.ts 中填写模型配置（apiKey、baseURL、模型名称）后再运行')
  }

  let 客户端 = new OpenAI({
    apiKey: 模型配置.apiKey,
    ...(模型配置.baseURL.trim().length > 0 ? { baseURL: 模型配置.baseURL } : {}),
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
  ].join('\n')

  let 篇章 = await 透镜.analyze({ text: 发言, sourceLabel: '手动演示' })

  console.log('=== 形式逻辑命题 ===')
  for (let 命题 of 篇章.getPropositions()) {
    console.log(`[命题] ${命题.getContent()}`)
    console.log(`    公式: ${命题.getFormulaSource()}`)
    console.log(`    规范化: ${formatFormula(命题.getFormulaAst())}`)
    console.log(`    依据: "${命题.getEvidence().quote}"`)
  }

  console.log('\n=== 谓词符号表 ===')
  for (let 符号 of 篇章.listPredicateSymbols()) {
    console.log(`${符号.symbol} / ${String(符号.arity)} 元`)
  }
}

void 运行形式逻辑剖析演示()
