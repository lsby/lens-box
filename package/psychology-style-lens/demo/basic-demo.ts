import OpenAI from 'openai'
import { 心理学文风透镜 } from '../src/index.js'

// 默认连接本地 Ollama 的 gpt-oss 模型
let 模型配置 = {
  apiKey: 'ollama',
  baseURL: 'http://127.0.0.1:11434/v1',
  模型名称: 'gpt-oss-20b',
  是否支持函数调用: true,
}

async function 运行心理学观察演示(): Promise<void> {
  if (模型配置.apiKey.trim().length === 0 || 模型配置.模型名称.trim().length === 0) {
    throw new Error('请先在 demo/basic-demo.ts 中填写模型配置（apiKey、baseURL、模型名称）后再运行')
  }

  let 客户端 = new OpenAI({
    apiKey: 模型配置.apiKey,
    ...(模型配置.baseURL.trim().length > 0 ? { baseURL: 模型配置.baseURL } : {}),
  })

  let 透镜 = new 心理学文风透镜({
    openai客户端: 客户端,
    模型名称: 模型配置.模型名称,
    是否支持函数调用: 模型配置.是否支持函数调用,
  })

  let 样本 = await 透镜.观察({
    文本: '不会吧？这么简单的问题也要问我吗？记好了，我可不想解释第二遍～',
    上下文提示: '熟人之间带点小得意的教学对话',
    来源标签: '手动演示',
  })

  console.log('=== 心理学剖析样本 ===')
  console.log(JSON.stringify(样本.导出快照(), null, 2))
}

void 运行心理学观察演示()
