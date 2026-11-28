import assert from 'node:assert/strict'
import test from 'node:test'
import OpenAI from 'openai'
import {
  buildFormalLogicDocument,
  collectConstants,
  ExtractedProposition,
  findFreeVariables,
  FormalLogicDocument,
  FormalLogicDocumentSnapshotInput,
  FormalLogicExtractionResult,
  formalLogicExtractionResultSchema,
  FormalLogicLens,
  FormalProposition,
  formatFormula,
  FormulaNode,
  parseFormula,
} from '../src/index.js'

function 原子命题(名称: string): FormulaNode {
  return { kind: 'atom', predicate: 名称, args: [] }
}

void test('parseFormula 应能解析原子命题与谓词应用', () => {
  assert.deepEqual(parseFormula('P'), { kind: 'atom', predicate: 'P', args: [] })
  assert.deepEqual(parseFormula('下雨'), { kind: 'atom', predicate: '下雨', args: [] })
  assert.deepEqual(parseFormula('人(苏格拉底)'), { kind: 'atom', predicate: '人', args: ['苏格拉底'] })
  assert.deepEqual(parseFormula('喜欢(张三, 李四)'), { kind: 'atom', predicate: '喜欢', args: ['张三', '李四'] })
})

void test('parseFormula 应按优先级与结合性解析联结词', () => {
  assert.deepEqual(parseFormula('P ∧ Q ∨ R'), {
    kind: 'or',
    left: { kind: 'and', left: 原子命题('P'), right: 原子命题('Q') },
    right: 原子命题('R'),
  })
  assert.deepEqual(parseFormula('P ∨ Q ∧ R'), {
    kind: 'or',
    left: 原子命题('P'),
    right: { kind: 'and', left: 原子命题('Q'), right: 原子命题('R') },
  })
  // → 右结合
  assert.deepEqual(parseFormula('P → Q → R'), {
    kind: 'implies',
    left: 原子命题('P'),
    right: { kind: 'implies', left: 原子命题('Q'), right: 原子命题('R') },
  })
  // ↔ 优先级低于 →
  assert.deepEqual(parseFormula('P → Q ↔ R'), {
    kind: 'iff',
    left: { kind: 'implies', left: 原子命题('P'), right: 原子命题('Q') },
    right: 原子命题('R'),
  })
  assert.deepEqual(parseFormula('¬P ∧ Q'), {
    kind: 'and',
    left: { kind: 'not', operand: 原子命题('P') },
    right: 原子命题('Q'),
  })
  assert.deepEqual(parseFormula('¬(P ∧ Q)'), {
    kind: 'not',
    operand: { kind: 'and', left: 原子命题('P'), right: 原子命题('Q') },
  })
  assert.deepEqual(parseFormula('(P ∨ Q) → R'), {
    kind: 'implies',
    left: { kind: 'or', left: 原子命题('P'), right: 原子命题('Q') },
    right: 原子命题('R'),
  })
})

void test('parseFormula 应支持文档约定的符号别名', () => {
  assert.deepEqual(parseFormula('~P'), parseFormula('¬P'))
  assert.deepEqual(parseFormula('!P'), parseFormula('¬P'))
  assert.deepEqual(parseFormula('P & Q'), parseFormula('P ∧ Q'))
  assert.deepEqual(parseFormula('P && Q'), parseFormula('P ∧ Q'))
  assert.deepEqual(parseFormula('P | Q'), parseFormula('P ∨ Q'))
  assert.deepEqual(parseFormula('P || Q'), parseFormula('P ∨ Q'))
  assert.deepEqual(parseFormula('P -> Q'), parseFormula('P → Q'))
  assert.deepEqual(parseFormula('P <-> Q'), parseFormula('P ↔ Q'))
  assert.deepEqual(parseFormula('forall x P(x)'), parseFormula('∀x P(x)'))
  assert.deepEqual(parseFormula('exists x P(x)'), parseFormula('∃x P(x)'))
})

void test('parseFormula 应解析量词且量词只约束紧随的子公式', () => {
  assert.deepEqual(parseFormula('∀x 人(x)'), {
    kind: 'forall',
    variable: 'x',
    body: { kind: 'atom', predicate: '人', args: ['x'] },
  })
  assert.deepEqual(parseFormula('∃x (人(x) ∧ 会死(x))'), {
    kind: 'exists',
    variable: 'x',
    body: {
      kind: 'and',
      left: { kind: 'atom', predicate: '人', args: ['x'] },
      right: { kind: 'atom', predicate: '会死', args: ['x'] },
    },
  })
  assert.deepEqual(parseFormula('∀x P(x) → Q(x)'), {
    kind: 'implies',
    left: { kind: 'forall', variable: 'x', body: { kind: 'atom', predicate: 'P', args: ['x'] } },
    right: { kind: 'atom', predicate: 'Q', args: ['x'] },
  })
})

void test('parseFormula 应对非法输入立即抛错并携带位置信息', () => {
  assert.throws(() => parseFormula(''), /公式不能为空/)
  assert.throws(() => parseFormula('   '), /公式不能为空/)
  assert.throws(() => parseFormula('(P ∧ Q'), /缺少匹配的右括号/)
  assert.throws(() => parseFormula('P ∧'), /意外结束/)
  assert.throws(() => parseFormula('P Q'), /多余内容/)
  assert.throws(() => parseFormula('P ∧ Q)'), /多余内容/)
  assert.throws(() => parseFormula('P()'), /至少需要一个项/)
  assert.throws(() => parseFormula('∀xy P(x)'), /单个小写拉丁字母/)
  assert.throws(() => parseFormula('∀ 人 P(人)'), /单个小写拉丁字母/)
  assert.throws(() => parseFormula('@P'), /无法识别的符号/)
})

void test('findFreeVariables 应识别自由变量并允许常量与量词遮蔽', () => {
  assert.deepEqual(findFreeVariables(parseFormula('∀x (人(x) → 会死(x))')), [])
  assert.deepEqual(findFreeVariables(parseFormula('人(苏格拉底)')), [])
  assert.deepEqual(findFreeVariables(parseFormula('人(x)')), ['x'])
  assert.deepEqual(findFreeVariables(parseFormula('∀x P(x) ∧ Q(y)')), ['y'])
  assert.deepEqual(findFreeVariables(parseFormula('∀x (P(x) ∧ ∃x Q(x))')), [])
  assert.deepEqual(findFreeVariables(parseFormula('∀x P(x) → Q(x)')), ['x'])
})

void test('formatFormula 应以完整括号规范化渲染且与 parseFormula 往返一致', () => {
  assert.equal(formatFormula(parseFormula('(P ∧ Q) → R')), '((P ∧ Q) → R)')
  assert.equal(formatFormula(parseFormula('P → (Q → R)')), '(P → (Q → R))')
  assert.equal(formatFormula(parseFormula('(P → Q) → R')), '((P → Q) → R)')
  assert.equal(formatFormula(parseFormula('¬(P ∧ Q)')), '¬(P ∧ Q)')
  assert.equal(formatFormula(parseFormula('P <-> Q')), '(P ↔ Q)')
  assert.equal(formatFormula(parseFormula('∀x (人(x) → 会死(x))')), '∀x (人(x) → 会死(x))')
  assert.equal(formatFormula(parseFormula('P ∧ Q ∨ R')), '((P ∧ Q) ∨ R)')
  assert.equal(formatFormula(parseFormula('¬∀x P(x)')), '¬∀x P(x)')

  // 链式蕴含必须带完整括号，避免读者误读结合方向
  assert.equal(
    formatFormula(parseFormula('((¬去(小王) → (去(小张) → 去(小李))) ∧ (去(小张) ∧ ¬去(小李))) → 去(小王)')),
    '(((¬去(小王) → (去(小张) → 去(小李))) ∧ (去(小张) ∧ ¬去(小李))) → 去(小王))',
  )

  let 样例列表 = [
    'P',
    '人(苏格拉底)',
    'P ∧ Q ∨ R',
    '¬P → Q ↔ R',
    '∀x (人(x) → 会死(x))',
    '∃x (P(x) ∧ Q(x))',
    '¬∀x P(x)',
  ]
  for (let 源码 of 样例列表) {
    let 语法树 = parseFormula(源码)
    assert.deepEqual(parseFormula(formatFormula(语法树)), 语法树)
  }
})

void test('collectConstants 应只收集项位置中的常量', () => {
  assert.deepEqual([...collectConstants(parseFormula('人(苏格拉底)'))].sort(), ['苏格拉底'])
  assert.deepEqual([...collectConstants(parseFormula('喜欢(张三, 李四)'))].sort(), ['张三', '李四'])
  assert.deepEqual([...collectConstants(parseFormula('∀x (认识(x, 甲) ∧ 认识(乙, x))'))].sort(), ['乙', '甲'])
  // 变量与谓词名不计入常量
  assert.deepEqual([...collectConstants(parseFormula('P'))], [])
  assert.deepEqual([...collectConstants(parseFormula('∀x P(x)'))], [])
  assert.deepEqual([...collectConstants(parseFormula('∃x (P(x) ∧ Q(y))'))], [])
})

void test('提取结果 Schema 应在结构化校验阶段拒绝非法公式', () => {
  let 非法结果 = formalLogicExtractionResultSchema.safeParse({
    propositions: [{ key: 'p1', content: '测试', evidence: { quote: '测试', occurrence: 1 }, formula: 'P ∧' }],
  })
  assert.equal(非法结果.success, false)

  let 合法结果 = formalLogicExtractionResultSchema.safeParse({
    propositions: [
      { key: 'p1', content: '测试', evidence: { quote: '测试', occurrence: 1 }, formula: '∀x (人(x) → 会死(x))' },
    ],
  })
  assert.equal(合法结果.success, true)
})

let 示例发言 = ['如果明天下雨，我就不去爬山。', '所有人都必须遵守规则。', '张三是人。'].join('\n')

let 命题一假言: ExtractedProposition = {
  key: 'p1',
  content: '明天下雨就不去爬山',
  evidence: { quote: '如果明天下雨，我就不去爬山。', occurrence: 1 },
  formula: '下雨 → ¬爬山',
}

let 命题二全称: ExtractedProposition = {
  key: 'p2',
  content: '所有人都必须遵守规则',
  evidence: { quote: '所有人都必须遵守规则。', occurrence: 1 },
  formula: '∀x (人(x) → 遵守规则(x))',
}

let 命题三原子: ExtractedProposition = {
  key: 'p3',
  content: '张三是人',
  evidence: { quote: '张三是人。', occurrence: 1 },
  formula: '人(张三)',
}

let 示例提取结果: FormalLogicExtractionResult = { propositions: [命题一假言, 命题二全称, 命题三原子] }

function 构建示例篇章(): FormalLogicDocument {
  return buildFormalLogicDocument({
    text: 示例发言,
    extraction: 示例提取结果,
    model: 'offline-fixture',
    promptVersion: 1,
    sourceLabel: '离线测试',
  })
}

void test('buildFormalLogicDocument 应能从固定提取结果离线构建可查询的篇章', () => {
  let 篇章 = 构建示例篇章()

  assert.equal(篇章.getPropositions().length, 3)
  assert.equal(篇章.getSourceLabel(), '离线测试')
  assert.deepEqual(篇章.getProvenance(), { model: 'offline-fixture', promptVersion: 1 })

  let 第一条 = 篇章.getPropositions()[0]
  if (第一条 === undefined) {
    throw new Error('构建结果缺少第一条命题')
  }
  assert.equal(第一条.getContent(), '明天下雨就不去爬山')
  assert.equal(第一条.getFormulaSource(), '下雨 → ¬爬山')
  let 依据 = 第一条.getEvidence()
  assert.equal(篇章.getText().slice(依据.start, 依据.end), 依据.quote)

  let 符号列表 = 篇章.listPredicateSymbols()
  assert.equal(符号列表.length, 4)
  assert.deepEqual(
    符号列表.find((项) => 项.symbol === '人'),
    { symbol: '人', arity: 1 },
  )
  assert.deepEqual(
    符号列表.find((项) => 项.symbol === '下雨'),
    { symbol: '下雨', arity: 0 },
  )

  assert.equal(篇章.getPropositionById(第一条.getId())?.getContent(), '明天下雨就不去爬山')
  assert.equal(篇章.getPropositionById('不存在的标识'), undefined)

  // 常量表：示例提取结果中只有 人(张三) 引入了常量
  assert.deepEqual(篇章.listConstants(), ['张三'])

  // getPropositions 返回拷贝，外部修改不影响内部状态
  let 外部列表 = 篇章.getPropositions()
  外部列表.pop()
  assert.equal(篇章.getPropositions().length, 3)
})

void test('note 字段应能透传、缺省为 null 且兼容不含 note 的旧快照', () => {
  let 篇章 = buildFormalLogicDocument({
    text: '除非你道歉，否则我不原谅你，也不合作。',
    extraction: {
      propositions: [
        {
          key: 'p1',
          content: '除非你道歉，否则我不原谅你，也不合作',
          evidence: { quote: '除非你道歉，否则我不原谅你，也不合作。', occurrence: 1 },
          formula: '¬道歉(你) → (¬原谅(我, 你) ∧ ¬合作(我, 你))',
          note: '按读法一翻译：不原谅与不合作都受「除非道歉」约束；备选读法为 (¬道歉(你) → ¬原谅(我, 你)) ∧ ¬合作(我, 你)',
        },
        { key: 'p2', content: '我不合作', evidence: { quote: '也不合作', occurrence: 1 }, formula: '¬合作(我, 你)' },
      ],
    },
    model: 'offline-fixture',
    promptVersion: 2,
  })

  let 命题列表 = 篇章.getPropositions()
  let 带备注 = 命题列表[0]
  let 无备注 = 命题列表[1]
  if (带备注 === undefined || 无备注 === undefined) {
    throw new Error('构建结果缺少命题')
  }
  assert.equal(带备注.getNote()?.includes('备选读法'), true)
  assert.equal(无备注.getNote(), null)
  assert.deepEqual(篇章.listConstants().sort(), ['你', '我'])

  // 快照往返保留 note
  let 快照 = 篇章.toSnapshot()
  assert.equal(new FormalLogicDocument(快照).getPropositions()[0]?.getNote(), 带备注.getNote())

  // 不含 note 字段的旧版本快照仍可恢复，自动补 null
  let 旧式快照: FormalLogicDocumentSnapshotInput = {
    snapshotVersion: 1,
    id: 'doc-旧版',
    text: '张三是人。',
    propositions: [
      { id: 'p-1', content: '张三是人', evidence: { quote: '张三是人。', start: 0, end: 5 }, formula: '人(张三)' },
    ],
    sourceLabel: null,
    recordedAt: 0,
    provenance: { model: 'offline-fixture', promptVersion: 1 },
  }
  let 恢复篇章 = new FormalLogicDocument(旧式快照)
  assert.equal(恢复篇章.getPropositions()[0]?.getNote(), null)
  assert.equal(恢复篇章.toSnapshot().propositions[0]?.note, null)
})

void test('buildFormalLogicDocument 应能处理空提取结果与重复出现的摘录', () => {
  let 空篇章 = buildFormalLogicDocument({
    text: '今天天气不错。',
    extraction: { propositions: [] },
    model: 'offline-fixture',
    promptVersion: 1,
  })
  assert.equal(空篇章.getPropositions().length, 0)
  assert.deepEqual(空篇章.listPredicateSymbols(), [])

  let 重复篇章 = buildFormalLogicDocument({
    text: '下雨了。下雨了。',
    extraction: {
      propositions: [{ key: 'p1', content: '下雨了', evidence: { quote: '下雨了。', occurrence: 2 }, formula: '下雨' }],
    },
    model: 'offline-fixture',
    promptVersion: 1,
  })
  let 命题 = 重复篇章.getPropositions()[0]
  if (命题 === undefined) {
    throw new Error('构建结果缺少命题')
  }
  assert.deepEqual(命题.getEvidence(), { quote: '下雨了。', start: 4, end: 8 })
})

void test('buildFormalLogicDocument 应对重复键、无法定位摘录与元数冲突立即抛错', () => {
  assert.throws(
    () =>
      buildFormalLogicDocument({
        text: 示例发言,
        extraction: { propositions: [命题一假言, { ...命题一假言 }] },
        model: 'offline-fixture',
        promptVersion: 1,
      }),
    /Duplicate proposition key/,
  )

  assert.throws(
    () =>
      buildFormalLogicDocument({
        text: 示例发言,
        extraction: { propositions: [{ ...命题一假言, evidence: { quote: '原文中不存在的引文', occurrence: 1 } }] },
        model: 'offline-fixture',
        promptVersion: 1,
      }),
    /cannot be resolved/,
  )

  // 同一谓词跨命题元数不一致
  assert.throws(
    () =>
      buildFormalLogicDocument({
        text: 示例发言,
        extraction: { propositions: [命题二全称, { ...命题三原子, formula: '人(张三, 李四)' }] },
        model: 'offline-fixture',
        promptVersion: 1,
      }),
    /元数必须一致/,
  )

  // 同一谓词在单个公式内部元数不一致
  assert.throws(
    () =>
      buildFormalLogicDocument({
        text: 示例发言,
        extraction: {
          propositions: [
            {
              key: 'p1',
              content: '测试',
              evidence: { quote: '张三是人。', occurrence: 1 },
              formula: '∀x (人(x) ∧ 人(x, x))',
            },
          ],
        },
        model: 'offline-fixture',
        promptVersion: 1,
      }),
    /元数必须一致/,
  )

  assert.throws(
    () =>
      buildFormalLogicDocument({ text: '  ', extraction: 示例提取结果, model: 'offline-fixture', promptVersion: 1 }),
    /empty text/,
  )
})

void test('FormalProposition 应强制闭公式约束并隔离内部 AST', () => {
  assert.throws(
    () =>
      new FormalProposition({ id: 'a', content: '有人', evidence: { quote: 'x', start: 0, end: 1 }, formula: '人(x)' }),
    /闭公式/,
  )

  let 命题 = new FormalProposition({
    id: 'a',
    content: '张三是人',
    evidence: { quote: 'x', start: 0, end: 1 },
    formula: '人(张三)',
  })
  let 语法树 = 命题.getFormulaAst()
  if (语法树.kind === 'atom') {
    语法树.args.push('黑客')
  }
  assert.deepEqual(命题.getFormulaAst(), parseFormula('人(张三)'))

  assert.equal(命题.matchesKeyword('张三'), true)
  assert.equal(命题.matchesKeyword('人('), true)
  assert.equal(命题.matchesKeyword('不存在'), false)
  assert.equal(命题.matchesKeyword('  '), true)
})

void test('FormalLogicDocument 快照应能完整往返恢复', () => {
  let 篇章 = 构建示例篇章()
  let 快照 = 篇章.toSnapshot()
  let 恢复篇章 = new FormalLogicDocument(快照)
  assert.deepEqual(恢复篇章.toSnapshot(), 快照)
  assert.equal(恢复篇章.getPropositions().length, 3)
})

void test('FormalLogicDocument 应对被篡改的快照立即抛错', () => {
  let 快照 = 构建示例篇章().toSnapshot()
  let 第一条 = 快照.propositions[0]
  let 第二条 = 快照.propositions[1]
  let 第三条 = 快照.propositions[2]
  if (第一条 === undefined || 第二条 === undefined || 第三条 === undefined) {
    throw new Error('快照命题数量不足')
  }

  // 摘录与原文不一致
  assert.throws(
    () =>
      new FormalLogicDocument({
        ...快照,
        propositions: [{ ...第一条, evidence: { ...第一条.evidence, quote: '被篡改的引文' } }, 第二条, 第三条],
      }),
    /does not match/,
  )

  // 锚点越界
  assert.throws(
    () =>
      new FormalLogicDocument({
        ...快照,
        propositions: [{ ...第一条, evidence: { quote: 'x', start: 0, end: 99999 } }, 第二条, 第三条],
      }),
    /exceeds/,
  )

  // 命题标识重复
  assert.throws(
    () => new FormalLogicDocument({ ...快照, propositions: [第一条, { ...第二条, id: 第一条.id }, 第三条] }),
    /Duplicate proposition id/,
  )

  // 快照中的公式违反闭公式约束
  assert.throws(
    () => new FormalLogicDocument({ ...快照, propositions: [{ ...第一条, formula: '人(x)' }, 第二条, 第三条] }),
    /闭公式/,
  )
})

void test('FormalLogicLens 应构造符合契约的提示词并拒绝非法输入', async () => {
  let 透镜 = new FormalLogicLens({ openaiClient: new OpenAI({ apiKey: 'offline-test' }), model: 'offline-fixture' })

  let 提示词 = 透镜.buildPrompt({ text: '原文内容' })
  assert.equal(提示词.includes('原文内容'), true)
  assert.equal(提示词.includes('Text to analyze:'), true)
  assert.equal(提示词.includes('Additional context:'), false)

  let 带上下文提示词 = 透镜.buildPrompt({ text: '原文内容', context: '背景说明' })
  assert.equal(带上下文提示词.includes('Additional context: 背景说明'), true)

  // 输入校验失败时直接拒绝，不会发起任何网络请求
  await assert.rejects(透镜.analyze({ text: '' }))
})
