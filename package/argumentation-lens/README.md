# @lsby/lens-box-argumentation-lens

基于**大模型结构化提取与本地有向论证图**的文本论证结构剖析透镜。

## 观察视角

不同于统计词汇分布的语义学视角或剖析人物心理的心理学视角，本透镜把文本当作一场**显式的论证活动**来观察，回答三个问题：

1. **文本明确提出了哪些主张、理由与证据？**（中心论点、子论点、前提、证据、反方观点、回应观点）
2. **它们之间如何支持与攻击？**（有向的 `support` / `attack` 关系构成的论证图）
3. **论证结构在哪些地方存在缺口或异常？**（未显式支持的论点、未被回应的反方观点、支持环）

职责划分：**LLM 只负责识别文本中显式出现的论证结构**；原文定位、结构校验、建图、查询、诊断与快照恢复全部由本地确定性代码完成。

## 核心领域概念

- **`ArgumentProposition`**：一条被识别出的命题实体，内聚论证角色（`centralClaim` / `subClaim` / `premise` / `evidence` / `objection` / `rebuttal`）、规范化内容与**逐字原文依据**（`quote` + `[start, end)` 字符区间），支持关键词匹配与快照导出。
- **`ArgumentRelation`**：连接两条命题的有向纯数据关系（`sourceId` / `targetId` / `support` / `attack`）；约定 `objection —attack→ claim`，`rebuttal —attack→ objection`。
- **`ArgumentGraph`**：单篇文本的论证网络，构造时强制图不变量（标识唯一、端点存在、禁止自环与重复关系），提供命题检索、直接支持/攻击来源查询，以及三类**结构诊断**：`findClaimsWithoutExplicitSupport()`、`findObjectionsWithoutRebuttal()`、`findSupportCycles()`。
- **`ArgumentDocument`**：一次剖析的完整结果，聚合原文、论证图、来源标签、记录时间与提取来源（模型与提示词版本），恢复快照时会重新校验每条原文依据与原文逐字一致。
- **`ArgumentationLens`**：无状态对外入口，基于 `@lsby/ai-agent`（接收标准 OpenAI 兼容客户端与模型配置）发起结构化提取并返回 `ArgumentDocument`。
- **`buildArgumentDocument`**：纯本地构建函数，将固定提取结果离线构建为 `ArgumentDocument`，供测试与自定义提取通道复用。

## 最小示例

```ts
import OpenAI from 'openai'
import { ArgumentationLens } from '@lsby/lens-box-argumentation-lens'

let 透镜 = new ArgumentationLens({
  openaiClient: new OpenAI({ apiKey: 'ollama', baseURL: 'http://127.0.0.1:11434/v1' }),
  model: 'gpt-oss-20b',
  supportsFunctionCalling: true,
})

let 篇章 = await 透镜.analyze({ text: '……一段包含论点与理由的文章……' })
let 图 = 篇章.getGraph()

图.getCentralClaims() // 中心论点
图.findClaimsWithoutExplicitSupport() // 未显式支持的论点
图.findObjectionsWithoutRebuttal() // 未被回应的反方观点
图.findSupportCycles() // 支持环（如 ['a', 'b', 'a']）
```

完整可运行示例见 [demo/basic-demo.ts](demo/basic-demo.ts)。

## 错误语义与副作用

- `analyze()` 会通过网络调用 OpenAI 兼容模型，**可能产生模型费用**；构建、查询、诊断与快照恢复均为纯本地操作。
- 输入为空、模型无法给出有效结构化结果、提取结果引用未知临时标识、原文摘录无法按出现序号定位、快照中的依据与原文不一致等场景均**立即抛错**（Fail-Fast），不做静默兜底；网络、限流与中断异常原样向上传播。
- 重复调用 `analyze()` 会为相同文本生成新的文档标识与记录时间；透镜不自动持久化任何结果。
- 快照携带 `snapshotVersion: 1` 与 `provenance`（模型名 + 提示词版本 `ARGUMENTATION_PROMPT_VERSION`），便于审计与复现；不会保存可能包含敏感信息的额外请求参数。
- 结构诊断只描述**文本中显式呈现的结构**：缺少显式支持不等于论点为假，存在支持环也不直接等价于循环论证谬误。

## 适用边界

- **擅长**：议论文、评论、政策分析、辩论记录等显式论证结构的提取、可视化建模与结构缺口诊断。
- **不擅长**：事实真伪核查、隐含前提自动补全、论证说服力评分；对不含论证结构的纯叙述文本会返回空论证图而非编造结构。
