import assert from 'node:assert/strict'
import test from 'node:test'
import OpenAI from 'openai'
import {
  ArgumentationLens,
  ArgumentDocument,
  ArgumentExtractionResult,
  ArgumentGraph,
  ArgumentPropositionSnapshot,
  buildArgumentDocument,
  PropositionType,
} from '../src/index.js'

let 示例文章 = [
  '远程办公应当成为科技公司的默认选项。',
  '远程办公能显著降低通勤成本，让员工专注工作。',
  '一项覆盖五千名程序员的调查显示，远程工作者的产出平均提升了百分之十三。',
  '有人担心远程办公会削弱团队凝聚力。',
  '定期线下聚会与明确的异步沟通规范足以维持团队协作。',
].join('\n')

let 示例提取结果: ArgumentExtractionResult = {
  propositions: [
    {
      key: 'p1',
      type: 'centralClaim',
      content: '远程办公应成为科技公司的默认选项',
      evidence: { quote: '远程办公应当成为科技公司的默认选项。', occurrence: 1 },
    },
    {
      key: 'p2',
      type: 'premise',
      content: '远程办公降低通勤成本并提升专注度',
      evidence: { quote: '远程办公能显著降低通勤成本，让员工专注工作。', occurrence: 1 },
    },
    {
      key: 'p3',
      type: 'evidence',
      content: '调查显示远程工作者产出提升',
      evidence: { quote: '一项覆盖五千名程序员的调查显示，远程工作者的产出平均提升了百分之十三。', occurrence: 1 },
    },
    {
      key: 'p4',
      type: 'objection',
      content: '远程办公可能削弱团队凝聚力',
      evidence: { quote: '有人担心远程办公会削弱团队凝聚力。', occurrence: 1 },
    },
    {
      key: 'p5',
      type: 'rebuttal',
      content: '线下聚会与异步沟通规范足以维持协作',
      evidence: { quote: '定期线下聚会与明确的异步沟通规范足以维持团队协作。', occurrence: 1 },
    },
  ],
  relations: [
    { sourceKey: 'p2', targetKey: 'p1', type: 'support' },
    { sourceKey: 'p3', targetKey: 'p2', type: 'support' },
    { sourceKey: 'p4', targetKey: 'p1', type: 'attack' },
    { sourceKey: 'p5', targetKey: 'p4', type: 'attack' },
  ],
}

function 构造命题快照(标识: string, 类型: PropositionType = 'subClaim'): ArgumentPropositionSnapshot {
  return { id: 标识, type: 类型, content: `命题 ${标识}`, evidence: { quote: 'x', start: 0, end: 1 } }
}

void test('buildArgumentDocument 应能从固定提取结果离线构建可查询的论证篇章', () => {
  let 篇章 = buildArgumentDocument({
    text: 示例文章,
    extraction: 示例提取结果,
    model: 'offline-fixture',
    promptVersion: 1,
    sourceLabel: '离线测试',
  })
  let 图 = 篇章.getGraph()

  assert.equal(图.getPropositions().length, 5)
  assert.equal(图.getRelations().length, 4)

  let 中心论点们 = 图.getCentralClaims()
  assert.equal(中心论点们.length, 1)
  let 中心论点 = 中心论点们[0]
  assert.ok(中心论点 !== undefined)
  assert.equal(中心论点.getContent(), '远程办公应成为科技公司的默认选项')

  // 临时 key 应被映射为全新的内部标识
  for (let 命题 of 图.getPropositions()) {
    assert.ok(命题.getId() !== 'p1')
    assert.ok(命题.getId().length > 0)
  }

  // 每条依据都应能在原文中按区间逐字还原
  for (let 命题 of 图.getPropositions()) {
    let 依据 = 命题.getEvidence()
    assert.equal(示例文章.slice(依据.start, 依据.end), 依据.quote)
  }

  let 支持来源 = 图.getDirectSupporters(中心论点.getId())
  assert.equal(支持来源.length, 1)
  assert.equal(支持来源[0]?.getType(), 'premise')

  let 攻击来源 = 图.getDirectAttackers(中心论点.getId())
  assert.equal(攻击来源.length, 1)
  assert.equal(攻击来源[0]?.getType(), 'objection')

  assert.equal(图.findClaimsWithoutExplicitSupport().length, 0)
  assert.equal(图.findObjectionsWithoutRebuttal().length, 0)
  assert.equal(图.findSupportCycles().length, 0)

  assert.equal(篇章.getProvenance().model, 'offline-fixture')
  assert.equal(篇章.getProvenance().promptVersion, 1)
  assert.equal(篇章.getSourceLabel(), '离线测试')
  assert.equal(篇章.getText(), 示例文章)

  // 关键词检索（忽略大小写；空白关键词返回全部）
  assert.equal(图.searchPropositions('凝聚力').length, 1)
  assert.equal(图.searchPropositions('').length, 5)
})

void test('重复摘录应能按出现序号定位，序号越界时应明确报错', () => {
  let 文本 = '增长是关键。增长是关键。'
  let 篇章 = buildArgumentDocument({
    text: 文本,
    extraction: {
      propositions: [
        { key: 'p1', type: 'centralClaim', content: '增长是关键', evidence: { quote: '增长是关键。', occurrence: 2 } },
      ],
      relations: [],
    },
    model: 'offline-fixture',
    promptVersion: 1,
  })

  let 命题 = 篇章.getGraph().getPropositions()[0]
  assert.ok(命题 !== undefined)
  assert.equal(命题.getEvidence().start, 6)
  assert.equal(命题.getEvidence().end, 12)
  assert.equal(文本.slice(6, 12), '增长是关键。')

  assert.throws(() => {
    buildArgumentDocument({
      text: 文本,
      extraction: {
        propositions: [
          {
            key: 'p1',
            type: 'centralClaim',
            content: '增长是关键',
            evidence: { quote: '增长是关键。', occurrence: 3 },
          },
        ],
        relations: [],
      },
      model: 'offline-fixture',
      promptVersion: 1,
    })
  }, /cannot be resolved/)
})

void test('构建与构图应对非法结构 Fail-Fast', () => {
  // 空文本与非法来源信息
  assert.throws(() => {
    buildArgumentDocument({
      text: '   ',
      extraction: { propositions: [], relations: [] },
      model: 'm',
      promptVersion: 1,
    })
  }, /empty text/)
  assert.throws(() => {
    buildArgumentDocument({ text: 'x', extraction: { propositions: [], relations: [] }, model: 'm', promptVersion: 0 })
  }, /promptVersion/)
  assert.throws(() => {
    buildArgumentDocument({ text: 'x', extraction: { propositions: [], relations: [] }, model: '  ', promptVersion: 1 })
  }, /model must not be empty/)

  // 重复临时 key
  assert.throws(() => {
    buildArgumentDocument({
      text: 示例文章,
      extraction: {
        propositions: [
          { key: 'p1', type: 'premise', content: '甲', evidence: { quote: '远程办公', occurrence: 1 } },
          { key: 'p1', type: 'premise', content: '乙', evidence: { quote: '通勤成本', occurrence: 1 } },
        ],
        relations: [],
      },
      model: 'offline-fixture',
      promptVersion: 1,
    })
  }, /Duplicate proposition key/)

  // 关系引用未知临时 key
  assert.throws(() => {
    buildArgumentDocument({
      text: 示例文章,
      extraction: {
        propositions: [{ key: 'p1', type: 'premise', content: '甲', evidence: { quote: '远程办公', occurrence: 1 } }],
        relations: [{ sourceKey: 'p1', targetKey: 'ghost', type: 'support' }],
      },
      model: 'offline-fixture',
      promptVersion: 1,
    })
  }, /unknown proposition key/)

  // 图中悬空端点、自环与重复关系
  assert.throws(() => {
    new ArgumentGraph({
      propositions: [构造命题快照('a')],
      relations: [{ sourceId: 'a', targetId: 'ghost', type: 'support' }],
    })
  }, /not found/)
  assert.throws(() => {
    new ArgumentGraph({
      propositions: [构造命题快照('a')],
      relations: [{ sourceId: 'a', targetId: 'a', type: 'attack' }],
    })
  }, /Self-referencing/)
  assert.throws(() => {
    new ArgumentGraph({
      propositions: [构造命题快照('a'), 构造命题快照('b')],
      relations: [
        { sourceId: 'a', targetId: 'b', type: 'support' },
        { sourceId: 'a', targetId: 'b', type: 'support' },
      ],
    })
  }, /Duplicate relation/)

  // 同一对命题允许同时存在支持与攻击
  let 双向图 = new ArgumentGraph({
    propositions: [构造命题快照('a'), 构造命题快照('b')],
    relations: [
      { sourceId: 'a', targetId: 'b', type: 'support' },
      { sourceId: 'a', targetId: 'b', type: 'attack' },
    ],
  })
  assert.equal(双向图.getRelations().length, 2)
})

void test('结构诊断应报告未显式支持的论点、未被回应的反方观点与支持环', () => {
  let 图 = new ArgumentGraph({
    propositions: [
      构造命题快照('claim-a', 'centralClaim'),
      构造命题快照('claim-b', 'subClaim'),
      构造命题快照('premise-a', 'premise'),
      构造命题快照('obj-a', 'objection'),
      构造命题快照('reb-a', 'rebuttal'),
      构造命题快照('obj-b', 'objection'),
    ],
    relations: [
      { sourceId: 'premise-a', targetId: 'claim-a', type: 'support' },
      { sourceId: 'obj-a', targetId: 'claim-a', type: 'attack' },
      { sourceId: 'reb-a', targetId: 'obj-a', type: 'attack' },
    ],
  })

  assert.deepEqual(
    图.findClaimsWithoutExplicitSupport().map((命题) => 命题.getId()),
    ['claim-b'],
  )
  assert.deepEqual(
    图.findObjectionsWithoutRebuttal().map((命题) => 命题.getId()),
    ['obj-b'],
  )
  assert.equal(图.findSupportCycles().length, 0)

  // 查询不存在的命题应明确报错而非返回空结果
  assert.throws(() => {
    图.getDirectSupporters('missing')
  }, /Proposition not found/)
  assert.throws(() => {
    图.getDirectAttackers('missing')
  }, /Proposition not found/)

  // 支持环：a → b → c → a 与 b → c → b，均按字典序最小起点规范化且不重复
  let 环图 = new ArgumentGraph({
    propositions: [构造命题快照('a'), 构造命题快照('b'), 构造命题快照('c')],
    relations: [
      { sourceId: 'a', targetId: 'b', type: 'support' },
      { sourceId: 'b', targetId: 'c', type: 'support' },
      { sourceId: 'c', targetId: 'a', type: 'support' },
      { sourceId: 'c', targetId: 'b', type: 'support' },
    ],
  })
  assert.deepEqual(环图.findSupportCycles(), [
    ['a', 'b', 'c', 'a'],
    ['b', 'c', 'b'],
  ])
})

void test('快照应能往返恢复，且篡改原文依据的快照应被拒绝', () => {
  let 篇章 = buildArgumentDocument({
    text: 示例文章,
    extraction: 示例提取结果,
    model: 'offline-fixture',
    promptVersion: 1,
    sourceLabel: '离线测试',
  })

  let 快照 = 篇章.toSnapshot()
  let 恢复篇章 = new ArgumentDocument(快照)
  assert.equal(恢复篇章.getGraph().getPropositions().length, 5)
  assert.deepEqual(恢复篇章.toSnapshot(), 快照)

  let 篡改摘录快照 = 篇章.toSnapshot()
  let 篡改命题 = 篡改摘录快照.graph.propositions[0]
  assert.ok(篡改命题 !== undefined)
  篡改命题.evidence.quote = '原文中不存在的摘录'
  assert.throws(() => {
    new ArgumentDocument(篡改摘录快照)
  }, /does not match the document text/)

  let 越界快照 = 篇章.toSnapshot()
  let 越界命题 = 越界快照.graph.propositions[0]
  assert.ok(越界命题 !== undefined)
  越界命题.evidence.end = 越界快照.text.length + 100
  assert.throws(() => {
    new ArgumentDocument(越界快照)
  }, /exceeds the document text length/)
})

void test('返回的数组与依据对象不应泄漏内部可变状态', () => {
  let 篇章 = buildArgumentDocument({
    text: 示例文章,
    extraction: 示例提取结果,
    model: 'offline-fixture',
    promptVersion: 1,
  })
  let 图 = 篇章.getGraph()

  let 命题列表 = 图.getPropositions()
  命题列表.length = 0
  assert.equal(图.getPropositions().length, 5)

  let 关系列表 = 图.getRelations()
  关系列表.length = 0
  assert.equal(图.getRelations().length, 4)

  let 中心论点 = 图.getCentralClaims()[0]
  assert.ok(中心论点 !== undefined)
  let 依据 = 中心论点.getEvidence()
  依据.start = 999
  assert.notEqual(中心论点.getEvidence().start, 999)

  let 快照 = 篇章.toSnapshot()
  快照.graph.relations.length = 0
  assert.equal(篇章.getGraph().getRelations().length, 4)
})

void test('无论证结构的文本应得到合法的空论证图', () => {
  let 篇章 = buildArgumentDocument({
    text: '今天天气不错，适合出门散步。',
    extraction: { propositions: [], relations: [] },
    model: 'offline-fixture',
    promptVersion: 1,
  })
  let 图 = 篇章.getGraph()
  assert.equal(图.getPropositions().length, 0)
  assert.equal(图.getCentralClaims().length, 0)
  assert.equal(图.findClaimsWithoutExplicitSupport().length, 0)
  assert.equal(图.findObjectionsWithoutRebuttal().length, 0)
  assert.equal(图.findSupportCycles().length, 0)
})

void test('ArgumentationLens 应能构建包含上下文的观察命令并拒绝空输入', () => {
  let 占位客户端 = new OpenAI({ apiKey: 'unused-for-offline-test' })
  let 透镜 = new ArgumentationLens({ openaiClient: 占位客户端, model: 'unused-model' })

  let 命令 = 透镜.buildPrompt({ text: '远程办公应当成为科技公司的默认选项。', context: '一篇关于工作制度的评论文章' })
  assert.ok(命令.includes('Additional context: 一篇关于工作制度的评论文章'))
  assert.ok(命令.includes('远程办公应当成为科技公司的默认选项。'))

  assert.throws(() => {
    透镜.buildPrompt({ text: '   ' })
  }, /must not be empty/)
})
