/**
 * 形式逻辑公式的抽象语法树（AST）节点定义与纯函数工具。
 *
 * 语法契约（与解析器、系统提示词、README 保持一致）：
 * - 原子：裸标识符（0 元原子命题，如 `P`、`下雨`）或谓词应用 `标识符(项, ...)`（如 `人(苏格拉底)`）；
 * - 项：标识符；其中**单个小写拉丁字母**（`x`、`y`、`z`……）视为变量，其余标识符视为常量；
 * - 联结词优先级（高 → 低）：`¬` > `∧` > `∨` > `→` > `↔`，`→` 与 `↔` 右结合；
 * - 量词 `∀x` / `∃x` 与 `¬` 同级，仅约束紧随其后的子公式；
 * - 闭公式约束：变量出现必须被量词绑定，常量无需绑定。
 *
 * 本模块只做公式结构的表示与局部校验，不做矛盾检测、真值表求值或推理有效性分析——
 * 此类进一步推断交由上层调用方（如 LLM）按需自行处理。
 */

/**
 * 原子节点：0 元时为原子命题，否则为谓词应用。
 */
export type AtomNode = { kind: 'atom'; predicate: string; args: string[] }

/**
 * 否定节点。
 */
export type NotNode = { kind: 'not'; operand: FormulaNode }

/**
 * 二元联结词节点：`and`（∧）、`or`（∨）、`implies`（→）、`iff`（↔）。
 */
export type BinaryNode = { kind: 'and' | 'or' | 'implies' | 'iff'; left: FormulaNode; right: FormulaNode }

/**
 * 量词节点：`forall`（∀）、`exists`（∃）。
 */
export type QuantifierNode = { kind: 'forall' | 'exists'; variable: string; body: FormulaNode }

/**
 * 形式逻辑公式的有穷判别联合。分支处理时必须使用穷尽 `switch`，禁止 `default` 兜底。
 */
export type FormulaNode = AtomNode | NotNode | BinaryNode | QuantifierNode

let 联结词符号表: Record<'and' | 'or' | 'implies' | 'iff', string> = { and: '∧', or: '∨', implies: '→', iff: '↔' }

/**
 * 判断一个标识符是否为本语法约定下的变量名（单个小写拉丁字母）。
 */
export function 是合法变量名(标识符: string): boolean {
  return /^[a-z]$/.test(标识符)
}

function 获得优先级(节点: FormulaNode): number {
  switch (节点.kind) {
    case 'atom':
      return 5
    case 'not':
    case 'forall':
    case 'exists':
      return 4
    case 'and':
      return 3
    case 'or':
      return 2
    case 'implies':
      return 1
    case 'iff':
      return 0
  }
}

function 渲染子式(子式: FormulaNode, 需要括号: boolean): string {
  let 文本 = 渲染公式(子式)
  return 需要括号 ? `(${文本})` : 文本
}

function 渲染公式(节点: FormulaNode): string {
  switch (节点.kind) {
    case 'atom':
      return 节点.args.length === 0 ? 节点.predicate : `${节点.predicate}(${节点.args.join(', ')})`
    case 'not':
      return `¬${渲染子式(节点.operand, 获得优先级(节点.operand) < 4)}`
    case 'forall':
      return `∀${节点.variable} ${渲染子式(节点.body, 获得优先级(节点.body) < 4)}`
    case 'exists':
      return `∃${节点.variable} ${渲染子式(节点.body, 获得优先级(节点.body) < 4)}`
    case 'and':
    case 'or': {
      // 左结合：右侧同优先级子式必须加括号才能保持原结构
      let 优先级 = 获得优先级(节点)
      let 左 = 渲染子式(节点.left, 获得优先级(节点.left) < 优先级)
      let 右 = 渲染子式(节点.right, 获得优先级(节点.right) <= 优先级)
      return `${左} ${联结词符号表[节点.kind]} ${右}`
    }
    case 'implies':
    case 'iff': {
      // 右结合：左侧同优先级子式必须加括号才能保持原结构
      let 优先级 = 获得优先级(节点)
      let 左 = 渲染子式(节点.left, 获得优先级(节点.left) <= 优先级)
      let 右 = 渲染子式(节点.right, 获得优先级(节点.right) < 优先级)
      return `${左} ${联结词符号表[节点.kind]} ${右}`
    }
  }
}

/**
 * 将公式 AST 渲染为规范化的公式字符串（按优先级最小化括号）。
 * 渲染结果重新经 `parseFormula` 解析后与原 AST 结构一致。
 */
export function formatFormula(节点: FormulaNode): string {
  return 渲染公式(节点)
}

function 收集自由变量(节点: FormulaNode, 已绑定: ReadonlySet<string>, 自由变量: Set<string>): void {
  switch (节点.kind) {
    case 'atom':
      for (let 项 of 节点.args) {
        if (是合法变量名(项) && 已绑定.has(项) === false) {
          自由变量.add(项)
        }
      }
      return
    case 'not':
      收集自由变量(节点.operand, 已绑定, 自由变量)
      return
    case 'and':
    case 'or':
    case 'implies':
    case 'iff':
      收集自由变量(节点.left, 已绑定, 自由变量)
      收集自由变量(节点.right, 已绑定, 自由变量)
      return
    case 'forall':
    case 'exists': {
      let 新绑定 = new Set(已绑定)
      新绑定.add(节点.variable)
      收集自由变量(节点.body, 新绑定, 自由变量)
      return
    }
  }
}

/**
 * 收集公式中的自由变量（未被任何量词绑定的变量名），返回排序后的去重列表。
 * 空列表表示该公式为闭公式，可以作为一条形式逻辑命题成立。
 */
export function findFreeVariables(节点: FormulaNode): string[] {
  let 自由变量 = new Set<string>()
  收集自由变量(节点, new Set<string>(), 自由变量)
  return [...自由变量].sort()
}

function 收集谓词元数(节点: FormulaNode, 元数表: Map<string, number>): void {
  switch (节点.kind) {
    case 'atom': {
      let 已有元数 = 元数表.get(节点.predicate)
      if (已有元数 !== undefined && 已有元数 !== 节点.args.length) {
        throw new Error(
          `谓词 "${节点.predicate}" 以 ${String(已有元数)} 元与 ${String(节点.args.length)} 元两种元数出现，元数必须一致`,
        )
      }
      元数表.set(节点.predicate, 节点.args.length)
      return
    }
    case 'not':
      收集谓词元数(节点.operand, 元数表)
      return
    case 'and':
    case 'or':
    case 'implies':
    case 'iff':
      收集谓词元数(节点.left, 元数表)
      收集谓词元数(节点.right, 元数表)
      return
    case 'forall':
    case 'exists':
      收集谓词元数(节点.body, 元数表)
      return
  }
}

/**
 * 收集公式中全部谓词符号及其元数（0 元原子命题的元数为 0）。
 * 同一谓词符号在公式内以不同元数出现时立即抛错。
 */
export function collectPredicateArities(节点: FormulaNode): Map<string, number> {
  let 元数表 = new Map<string, number>()
  收集谓词元数(节点, 元数表)
  return 元数表
}
