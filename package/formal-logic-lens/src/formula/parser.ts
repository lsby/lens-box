import { FormulaNode, 是合法变量名 } from './ast.js'

/**
 * 词法单元。`offset` 为单元在公式源码中的起始字符位置，用于错误定位。
 */
type 词法单元 =
  | { type: 'leftParen' | 'rightParen' | 'comma'; offset: number }
  | { type: 'connective'; value: 'not' | 'and' | 'or' | 'implies' | 'iff'; offset: number }
  | { type: 'quantifier'; value: 'forall' | 'exists'; offset: number }
  | { type: 'identifier'; value: string; offset: number }

type 解析状态 = { 单元列表: 词法单元[]; 游标: number }

let 标识符正则 = /[\p{L}][\p{L}\p{N}_]*/uy

let 单字符联结词表 = new Map<string, 'not' | 'and' | 'or' | 'implies' | 'iff'>([
  ['¬', 'not'],
  ['~', 'not'],
  ['!', 'not'],
  ['∧', 'and'],
  ['&', 'and'],
  ['∨', 'or'],
  ['|', 'or'],
  ['→', 'implies'],
  ['↔', 'iff'],
])

let 单字符量词表 = new Map<string, 'forall' | 'exists'>([
  ['∀', 'forall'],
  ['∃', 'exists'],
])

function 匹配单字符单元(字符: string, 偏移: number): 词法单元 | undefined {
  if (字符 === '(') {
    return { type: 'leftParen', offset: 偏移 }
  }
  if (字符 === ')') {
    return { type: 'rightParen', offset: 偏移 }
  }
  if (字符 === ',') {
    return { type: 'comma', offset: 偏移 }
  }
  let 联结词 = 单字符联结词表.get(字符)
  if (联结词 !== undefined) {
    return { type: 'connective', value: 联结词, offset: 偏移 }
  }
  let 量词 = 单字符量词表.get(字符)
  if (量词 !== undefined) {
    return { type: 'quantifier', value: 量词, offset: 偏移 }
  }
  return undefined
}

function 分词(源码: string): 词法单元[] {
  let 单元列表: 词法单元[] = []
  let 游标 = 0
  while (游标 < 源码.length) {
    let 字符 = 源码.charAt(游标)
    if (/\s/.test(字符)) {
      游标 += 1
      continue
    }
    // 多字符联结词必须先于单字符匹配，避免 `<->`、`&&` 被拆碎
    if (源码.startsWith('<->', 游标)) {
      单元列表.push({ type: 'connective', value: 'iff', offset: 游标 })
      游标 += 3
      continue
    }
    if (源码.startsWith('->', 游标)) {
      单元列表.push({ type: 'connective', value: 'implies', offset: 游标 })
      游标 += 2
      continue
    }
    if (源码.startsWith('&&', 游标)) {
      单元列表.push({ type: 'connective', value: 'and', offset: 游标 })
      游标 += 2
      continue
    }
    if (源码.startsWith('||', 游标)) {
      单元列表.push({ type: 'connective', value: 'or', offset: 游标 })
      游标 += 2
      continue
    }
    let 单字符单元 = 匹配单字符单元(字符, 游标)
    if (单字符单元 !== undefined) {
      单元列表.push(单字符单元)
      游标 += 1
      continue
    }
    标识符正则.lastIndex = 游标
    if (标识符正则.test(源码)) {
      let 文本 = 源码.slice(游标, 标识符正则.lastIndex)
      if (文本 === 'forall') {
        单元列表.push({ type: 'quantifier', value: 'forall', offset: 游标 })
      } else if (文本 === 'exists') {
        单元列表.push({ type: 'quantifier', value: 'exists', offset: 游标 })
      } else {
        单元列表.push({ type: 'identifier', value: 文本, offset: 游标 })
      }
      游标 += 文本.length
      continue
    }
    throw new Error(`公式在位置 ${String(游标)} 处存在无法识别的符号: "${字符}"`)
  }
  return 单元列表
}

function 窥视单元(状态: 解析状态): 词法单元 | undefined {
  return 状态.单元列表[状态.游标]
}

function 解析iff层级(状态: 解析状态): FormulaNode {
  let 左 = 解析implies层级(状态)
  let 单元 = 窥视单元(状态)
  if (单元 !== undefined && 单元.type === 'connective' && 单元.value === 'iff') {
    状态.游标 += 1
    return { kind: 'iff', left: 左, right: 解析iff层级(状态) }
  }
  return 左
}

function 解析implies层级(状态: 解析状态): FormulaNode {
  let 左 = 解析or层级(状态)
  let 单元 = 窥视单元(状态)
  if (单元 !== undefined && 单元.type === 'connective' && 单元.value === 'implies') {
    状态.游标 += 1
    return { kind: 'implies', left: 左, right: 解析implies层级(状态) }
  }
  return 左
}

function 解析or层级(状态: 解析状态): FormulaNode {
  let 左 = 解析and层级(状态)
  let 继续 = true
  while (继续) {
    let 单元 = 窥视单元(状态)
    if (单元 !== undefined && 单元.type === 'connective' && 单元.value === 'or') {
      状态.游标 += 1
      左 = { kind: 'or', left: 左, right: 解析and层级(状态) }
    } else {
      继续 = false
    }
  }
  return 左
}

function 解析and层级(状态: 解析状态): FormulaNode {
  let 左 = 解析一元层级(状态)
  let 继续 = true
  while (继续) {
    let 单元 = 窥视单元(状态)
    if (单元 !== undefined && 单元.type === 'connective' && 单元.value === 'and') {
      状态.游标 += 1
      左 = { kind: 'and', left: 左, right: 解析一元层级(状态) }
    } else {
      继续 = false
    }
  }
  return 左
}

function 解析一元层级(状态: 解析状态): FormulaNode {
  let 单元 = 窥视单元(状态)
  if (单元 !== undefined && 单元.type === 'connective' && 单元.value === 'not') {
    状态.游标 += 1
    return { kind: 'not', operand: 解析一元层级(状态) }
  }
  if (单元 !== undefined && 单元.type === 'quantifier') {
    状态.游标 += 1
    let 变量单元 = 窥视单元(状态)
    if (变量单元 === undefined || 变量单元.type !== 'identifier') {
      throw new Error(`位置 ${String(单元.offset)} 处的量词之后必须紧跟一个变量名`)
    }
    if (是合法变量名(变量单元.value) === false) {
      throw new Error(
        `量词只能绑定单个小写拉丁字母变量（如 x、y、z），位置 ${String(变量单元.offset)} 处得到: "${变量单元.value}"`,
      )
    }
    状态.游标 += 1
    let 体 = 解析一元层级(状态)
    if (单元.value === 'forall') {
      return { kind: 'forall', variable: 变量单元.value, body: 体 }
    }
    return { kind: 'exists', variable: 变量单元.value, body: 体 }
  }
  return 解析初级层级(状态)
}

function 解析项列表(状态: 解析状态, 左括号偏移: number): string[] {
  let 项列表: string[] = []
  let 继续 = true
  while (继续) {
    let 项单元 = 窥视单元(状态)
    if (项单元 === undefined || 项单元.type !== 'identifier') {
      throw new Error(`位置 ${String(左括号偏移)} 处的谓词应用至少需要一个项；0 元原子命题请直接书写标识符并省略括号`)
    }
    项列表.push(项单元.value)
    状态.游标 += 1
    let 分隔单元 = 窥视单元(状态)
    if (分隔单元 !== undefined && 分隔单元.type === 'comma') {
      状态.游标 += 1
    } else if (分隔单元 !== undefined && 分隔单元.type === 'rightParen') {
      状态.游标 += 1
      继续 = false
    } else {
      throw new Error(`位置 ${String(左括号偏移)} 处的谓词应用括号未闭合`)
    }
  }
  return 项列表
}

function 解析初级层级(状态: 解析状态): FormulaNode {
  let 单元 = 窥视单元(状态)
  if (单元 === undefined) {
    throw new Error('公式意外结束：期望一个原子、量词或括号表达式')
  }
  if (单元.type === 'leftParen') {
    状态.游标 += 1
    let 内部 = 解析iff层级(状态)
    let 右括号单元 = 窥视单元(状态)
    if (右括号单元 === undefined || 右括号单元.type !== 'rightParen') {
      throw new Error(`位置 ${String(单元.offset)} 处的左括号缺少匹配的右括号`)
    }
    状态.游标 += 1
    return 内部
  }
  if (单元.type === 'identifier') {
    状态.游标 += 1
    let 后继单元 = 窥视单元(状态)
    if (后继单元 !== undefined && 后继单元.type === 'leftParen') {
      状态.游标 += 1
      return { kind: 'atom', predicate: 单元.value, args: 解析项列表(状态, 后继单元.offset) }
    }
    return { kind: 'atom', predicate: 单元.value, args: [] }
  }
  throw new Error(`位置 ${String(单元.offset)} 处期望一个原子、量词或括号表达式`)
}

/**
 * 将公式字符串解析为公式 AST（递归下降，按 `¬` > `∧` > `∨` > `→` > `↔` 优先级）。
 *
 * 支持的符号别名：`~`/`!`（¬）、`&`/`&&`（∧）、`|`/`||`（∨）、`->`（→）、`<->`（↔）、
 * `forall`/`exists`（∀/∃）。量词只能绑定单个小写拉丁字母变量。
 * 任何违反语法契约的输入都会立即抛出带位置信息的 Error（Fail-Fast），不做静默修复。
 */
export function parseFormula(source: string): FormulaNode {
  if (source.trim().length === 0) {
    throw new Error('公式不能为空')
  }
  let 状态: 解析状态 = { 单元列表: 分词(source), 游标: 0 }
  let 公式 = 解析iff层级(状态)
  let 剩余单元 = 窥视单元(状态)
  if (剩余单元 !== undefined) {
    throw new Error(`公式在位置 ${String(剩余单元.offset)} 处存在多余内容`)
  }
  return 公式
}
