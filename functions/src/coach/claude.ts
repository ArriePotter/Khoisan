import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { COACH_MODEL } from "../config";
import { validateProposal, type GuardContext } from "../engine/guardrails";
import { INTENSITIES, SESSION_TYPES, type Proposal } from "../types";
import { COACH_SYSTEM_PROMPT, PROPOSAL_JSON_SCHEMA } from "./prompts";

const ProposalSchema = z.object({
  targetKm: z.number().nonnegative(),
  targetVertM: z.number().nonnegative(),
  rationale: z.string().min(1),
  sessions: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      type: z.enum(SESSION_TYPES),
      title: z.string(),
      distanceKm: z.number().nonnegative(),
      vertM: z.number().nonnegative(),
      durationMin: z.number().nonnegative(),
      intensity: z.enum(INTENSITIES),
      description: z.string(),
      note: z.string().max(100),
    }),
  ),
});

export interface CoachResult {
  proposal: Proposal | null;
  /** Guardrail / parse errors from each rejected attempt. */
  rejected: string[][];
  model: string | null;
}

const MAX_ATTEMPTS = 2;

/**
 * Ask Claude for a week (or rest-of-week) plan and only return it if it passes
 * schema validation and every guardrail. Callers fall back to the deterministic
 * template when `proposal` is null.
 */
export async function proposePlan(
  client: Anthropic,
  request: { task: string; context: unknown },
  guard: GuardContext,
): Promise<CoachResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `${request.task}\n\nAthlete data (JSON):\n${JSON.stringify(request.context)}`,
    },
  ];
  const rejected: string[][] = [];
  let model: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await client.beta.messages.create({
      model: COACH_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: PROPOSAL_JSON_SCHEMA as unknown as Record<string, unknown> },
      },
      system: [{ type: "text", text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
    });
    model = response.model;

    if (response.stop_reason === "refusal") {
      rejected.push([`Model declined: ${response.stop_details?.category ?? "unknown"}`]);
      break;
    }
    if (response.stop_reason === "max_tokens") {
      rejected.push(["Response truncated (max_tokens)."]);
      continue;
    }

    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
    let errors: string[];
    let proposal: Proposal | null = null;
    try {
      const parsed = ProposalSchema.safeParse(JSON.parse(text));
      if (parsed.success) {
        proposal = roundProposal(parsed.data);
        errors = validateProposal(proposal, guard);
      } else {
        errors = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      }
    } catch {
      errors = ["Output was not valid JSON."];
    }

    if (errors.length === 0 && proposal) return { proposal, rejected, model };

    rejected.push(errors);
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: `That plan was rejected by the safety checks:\n- ${errors.join("\n- ")}\n\nReturn a corrected plan that satisfies every limit.`,
    });
  }
  return { proposal: null, rejected, model };
}

function roundProposal(p: Proposal): Proposal {
  return {
    ...p,
    targetKm: Math.round(p.targetKm * 10) / 10,
    targetVertM: Math.round(p.targetVertM),
    sessions: [...p.sessions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({
        ...s,
        distanceKm: Math.round(s.distanceKm * 10) / 10,
        vertM: Math.round(s.vertM),
        durationMin: Math.round(s.durationMin),
      })),
  };
}
