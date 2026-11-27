import { z } from 'zod'
import { parseFormula } from './formula/parser.js'

/**
 * 形式逻辑透镜的输入。
 */
export let formalLogicInputSchema = z.object({
  text: z.string().trim().min(1, 'Input text must not be empty'),
  context: z.string().trim().min(1).nullable().optional(),
  sourceLabel: z.string().trim().min(1).nullable().optional(),
})

export type FormalLogicInput = z.infer<typeof formalLogicInputSchema>

/**
 * A proposition as returned by the extraction model, before local validation and ID mapping.
 * `formula` is a formal-logic formula string in the documented syntax; malformed formulas are
 * rejected here so the extraction agent can retry and repair them during structured output
 * validation, before any local document is built.
 */
export let extractedPropositionSchema = z.object({
  key: z.string().trim().min(1).describe('Temporary identifier unique within this extraction, e.g. "p1"'),
  content: z
    .string()
    .trim()
    .min(1)
    .describe('Concise, self-contained restatement of the asserted statement, in the same language as the source text'),
  evidence: z.object({
    quote: z.string().min(1).describe('Verbatim contiguous quote copied exactly from the source text'),
    occurrence: z
      .number()
      .int()
      .min(1)
      .describe('1-based occurrence index used when the same quote appears multiple times in the text'),
  }),
  formula: z
    .string()
    .trim()
    .min(1)
    .superRefine((公式源码, 上下文) => {
      try {
        parseFormula(公式源码)
      } catch (错误) {
        上下文.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Malformed formula: ${错误 instanceof Error ? 错误.message : String(错误)}`,
        })
      }
    })
    .describe(
      'Formal-logic formula translating the statement, e.g. "∀x (人(x) → 会死(x))". Identifiers start with a letter; connectives ¬ ∧ ∨ → ↔; quantifiers ∀x / ∃x bind single lowercase Latin variables; every variable must be bound',
    ),
})

export type ExtractedProposition = z.infer<typeof extractedPropositionSchema>

/**
 * Structured result expected from the extraction model.
 */
export let formalLogicExtractionResultSchema = z.object({
  propositions: z
    .array(extractedPropositionSchema)
    .describe('All explicitly asserted statements translated into formulas; empty when the text asserts nothing'),
})

export type FormalLogicExtractionResult = z.infer<typeof formalLogicExtractionResultSchema>

/**
 * Exact location of a verbatim quote inside the original text, as a [start, end) character range.
 */
export let evidenceAnchorSchema = z
  .object({ quote: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive() })
  .refine((锚点) => 锚点.end > 锚点.start, { message: 'Evidence anchor end must be greater than start' })

export type EvidenceAnchor = z.infer<typeof evidenceAnchorSchema>

/**
 * Persisted form of a single formal proposition. Only the formula source string is stored;
 * the AST is deterministically rebuilt (and re-validated) on restoration.
 */
export let formalPropositionSnapshotSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  evidence: evidenceAnchorSchema,
  formula: z.string().min(1),
})

export type FormalPropositionSnapshot = z.infer<typeof formalPropositionSnapshotSchema>

/**
 * Records which model and prompt version produced the extraction, for audit and reproducibility.
 */
export let extractionProvenanceSchema = z.object({
  model: z.string().min(1),
  promptVersion: z.number().int().positive(),
})

export type ExtractionProvenance = z.infer<typeof extractionProvenanceSchema>

/**
 * Persisted form of a fully analyzed formal-logic document.
 */
export let formalLogicDocumentSnapshotSchema = z.object({
  snapshotVersion: z.literal(1),
  id: z.string().min(1),
  text: z.string().min(1),
  propositions: z.array(formalPropositionSnapshotSchema),
  sourceLabel: z.string().nullable(),
  recordedAt: z.number().int().nonnegative(),
  provenance: extractionProvenanceSchema,
})

export type FormalLogicDocumentSnapshot = z.infer<typeof formalLogicDocumentSnapshotSchema>
