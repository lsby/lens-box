import OpenAI from 'openai'
import { ArgumentationLens } from '../src/index.js'

// 默认连接本地 Ollama 的 gpt-oss 模型
let 模型配置 = {
  apiKey: 'ollama',
  baseURL: 'http://127.0.0.1:11434/v1',
  模型名称: 'gpt-oss-20b',
  是否支持函数调用: true,
}

async function 运行论证剖析演示(): Promise<void> {
  if (模型配置.apiKey.trim().length === 0 || 模型配置.模型名称.trim().length === 0) {
    throw new Error('请先在 demo/basic-demo.ts 中填写模型配置（apiKey、baseURL、模型名称）后再运行')
  }

  let 客户端 = new OpenAI({
    apiKey: 模型配置.apiKey,
    ...(模型配置.baseURL.trim().length > 0 ? { baseURL: 模型配置.baseURL } : {}),
  })

  let 透镜 = new ArgumentationLens({
    openaiClient: 客户端,
    model: 模型配置.模型名称,
    supportsFunctionCalling: 模型配置.是否支持函数调用,
  })

  let 文章 = [
    '远程办公应当成为科技公司的默认选项。',
    '远程办公能显著降低通勤成本，让员工把精力投入到更有价值的工作中。',
    '一项覆盖五千名程序员的调查显示，远程工作者的产出平均提升了百分之十三。',
    '当然，有人担心远程办公会削弱团队凝聚力，导致沟通效率下降。',
    '但这种担心被夸大了：定期的线下聚会与明确的异步沟通规范，足以维持甚至增强团队协作。',
  ].join('\n')

  let 篇章 = await 透镜.analyze({ text: 文章, sourceLabel: '手动演示' })
  let 图 = 篇章.getGraph()

  console.log('=== 论证命题 ===')
  for (let 命题 of 图.getPropositions()) {
    console.log(`[${命题.getType()}] ${命题.getContent()}`)
    console.log(`    依据: "${命题.getEvidence().quote}"`)
  }

  console.log('\n=== 论证关系 ===')
  for (let 关系 of 图.getRelations()) {
    console.log(`${关系.sourceId} -[${关系.type}]-> ${关系.targetId}`)
  }

  console.log('\n=== 结构诊断 ===')
  console.log({
    中心论点: 图.getCentralClaims().map((命题) => 命题.getContent()),
    未显式支持的论点: 图.findClaimsWithoutExplicitSupport().map((命题) => 命题.getContent()),
    未被回应的反方观点: 图.findObjectionsWithoutRebuttal().map((命题) => 命题.getContent()),
    支持环: 图.findSupportCycles(),
  })
}

void 运行论证剖析演示()
