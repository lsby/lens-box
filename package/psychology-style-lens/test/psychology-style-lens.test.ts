import assert from 'node:assert/strict'
import test from 'node:test'
import OpenAI from 'openai'
import { 心理学文风样本, 心理学文风透镜 } from '../src/index.js'

void test('心理学文风样本应支持多维语义匹配与快照导出恢复', () => {
  let 样本甲 = new 心理学文风样本({
    样本标识: 'sample-1',
    原文: '就这点本事也敢出来丢人现眼？真拿你没办法呀～',
    人物性格: {
      主导特质: ['嘴硬心软', '骄傲'],
      情绪基调: '调侃中带着轻微嫌弃',
      表达动机: '在保持高姿态的同时准备出手帮忙',
      防御或互动姿态: '玩笑式打压',
    },
    对话场景: { 场景类型: '熟人间的日常拌嘴', 社交距离: '熟络', 权力位阶: '平级', 气氛张力: '表面挑衅但实则亲近' },
    记录时间戳: 1700000000000,
    来源标签: '角色台词',
  })

  assert.equal(样本甲.匹配条件({ 性格特质关键词: '嘴硬' }), true)
  assert.equal(样本甲.匹配条件({ 社交距离: '礼貌', 权力位阶: '上位' }), false)
  assert.equal(样本甲.匹配条件({ 来源标签: '角色台词' }), true)

  let 恢复样本 = new 心理学文风样本(样本甲.导出快照())
  assert.equal(恢复样本.获得样本标识(), 'sample-1')
  assert.equal(恢复样本.获得原文(), 样本甲.获得原文())
})

void test('心理学文风透镜应能构建观察命令并拒绝空输入', () => {
  let 占位客户端 = new OpenAI({ apiKey: 'unused-for-offline-test' })
  let 透镜 = new 心理学文风透镜({ openai客户端: 占位客户端, 模型名称: 'unused-model' })

  let 命令 = 透镜.构建心理学观察命令({
    文本: '你该不会连这个都要我教吧？',
    上下文提示: '两人刚认识不久，对方在试探底线',
  })

  assert.ok(命令.includes('补充上下文：两人刚认识不久，对方在试探底线'))
  assert.ok(命令.includes('你该不会连这个都要我教吧？'))

  assert.throws(() => {
    透镜.构建心理学观察命令({ 文本: '   ' })
  }, /不能为空/)
})
