import { z } from 'zod'

/**
 * Argumentative role of a single proposition identified in a text.
 * - `centralClaim`: the main conclusion the text argues for.
 * - `subClaim`: an intermediate conclusion that supports the central claim.
 * - `premise`: a reason or assumption offered in support of a claim.
 * - `evidence`: an example, datum or citation offered in support of a claim or premise.
 * - `objection`: a counter-argument raised against a claim (or quoted from an opponent).
 * - `rebuttal`: the author's reply that attacks an objection.
 */
export let propositionTypeSchema = z.enum(['centralClaim', 'subClaim', 'premise', 'evidence', 'objection', 'rebuttal'])

export type PropositionType = z.infer<typeof propositionTypeSchema>

/**
 * Directed relation between two propositions. The source proposition acts on the target:
 * `support` backs the target, `attack` undermines it.
 */
export let argumentRelationTypeSchema = z.enum(['support', 'attack'])

export type ArgumentRelationType = z.infer<typeof argumentRelationTypeSchema>

/**
 * Input accepted by the argumentation lens.
 */
export let argumentationInputSchema = z.object({
  text: z.string().trim().min(1, 'Input text must not be empty'),
  context: z.string().trim().min(1).nullable().optional(),
  sourceLabel: z.string().trim().min(1).nullable().optional(),
})

export type ArgumentationInput = z.infer<typeof argumentationInputSchema>

/**
 * A proposition as returned by the extraction model, before local validation and ID mapping.
 */
export let extractedPropositionSchema = z.object({
  key: z.string().trim().min(1).describe('Temporary identifier unique within this extraction, e.g. "p1"'),
  type: propositionTypeSchema.describe('Argumentative role of the proposition'),
  content: z
    .string()
    .trim()
    .min(1)
    .describe('Concise, self-contained restatement of the proposition, in the same language as the source text'),
  evidence: z.object({
    quote: z.string().min(1).describe('Verbatim contiguous quote copied exactly from the source text'),
    occurrence: z
      .number()
      .int()
      .min(1)
      .describe('1-based occurrence index used when the same quote appears multiple times in the text'),
  }),
})

export type ExtractedProposition = z.infer<typeof extractedPropositionSchema>

/**
 * A directed support/attack relation as returned by the extraction model, referencing temporary keys.
 */
export let extractedRelationSchema = z.object({
  sourceKey: z.string().trim().min(1).describe('Temporary key of the proposition that acts'),
  targetKey: z.string().trim().min(1).describe('Temporary key of the proposition being acted on'),
  type: argumentRelationTypeSchema.describe('Whether the source supports or attacks the target'),
})

export type ExtractedRelation = z.infer<typeof extractedRelationSchema>

/**
 * Structured result expected from the extraction model.
 */
export let argumentExtractionResultSchema = z.object({
  propositions: z
    .array(extractedPropositionSchema)
    .describe('All explicitly stated propositions; empty when the text contains no argumentation'),
  relations: z.array(extractedRelationSchema).describe('Directed support/attack relations between the propositions'),
})

export type ArgumentExtractionResult = z.infer<typeof argumentExtractionResultSchema>

/**
 * Exact location of a verbatim quote inside the original text, as a [start, end) character range.
 */
export let evidenceAnchorSchema = z
  .object({ quote: z.string().min(1), start: z.number().int().nonnegative(), end: z.number().int().positive() })
  .refine((锚点) => 锚点.end > 锚点.start, { message: 'Evidence anchor end must be greater than start' })

export type EvidenceAnchor = z.infer<typeof evidenceAnchorSchema>

/**
 * Persisted form of a single argument proposition.
 */
export let argumentPropositionSnapshotSchema = z.object({
  id: z.string().min(1),
  type: propositionTypeSchema,
  content: z.string().min(1),
  evidence: evidenceAnchorSchema,
})

export type ArgumentPropositionSnapshot = z.infer<typeof argumentPropositionSnapshotSchema>

/**
 * Persisted form of a directed support/attack relation between two propositions.
 */
export let argumentRelationSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: argumentRelationTypeSchema,
})

export type ArgumentRelation = z.infer<typeof argumentRelationSchema>

/**
 * Persisted form of the whole argument graph.
 */
export let argumentGraphSnapshotSchema = z.object({
  propositions: z.array(argumentPropositionSnapshotSchema),
  relations: z.array(argumentRelationSchema),
})

export type ArgumentGraphSnapshot = z.infer<typeof argumentGraphSnapshotSchema>

/**
 * Records which model and prompt version produced the extraction, for audit and reproducibility.
 */
export let extractionProvenanceSchema = z.object({
  model: z.string().min(1),
  promptVersion: z.number().int().positive(),
})

export type ExtractionProvenance = z.infer<typeof extractionProvenanceSchema>

/**
 * Persisted form of a fully analyzed argument document.
 */
export let argumentDocumentSnapshotSchema = z.object({
  snapshotVersion: z.literal(1),
  id: z.string().min(1),
  text: z.string().min(1),
  graph: argumentGraphSnapshotSchema,
  sourceLabel: z.string().nullable(),
  recordedAt: z.number().int().nonnegative(),
  provenance: extractionProvenanceSchema,
})

export type ArgumentDocumentSnapshot = z.infer<typeof argumentDocumentSnapshotSchema>
