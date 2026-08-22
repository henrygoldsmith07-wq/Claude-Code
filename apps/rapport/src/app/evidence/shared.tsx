"use client";

import { Field } from "@/components/ui";
import { SKILLS } from "@/domain/skills";
import { BEHAVIOUR_KEYS } from "@/domain/types";
import type { BehaviourKey } from "@/domain/types";
import type { HumanDecision, HumanEvidenceState } from "@/domain/human-evidence";

export const selectStyle = {
  background: "var(--surface)",
  borderColor: "var(--border-strong)",
  color: "var(--text)",
};

export const CONTROL_CLASS = "w-full rounded-[10px] border px-3 py-2 text-[15px] outline-none";

export function SkillSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <Field id={id} label={label}><select id={id} className={CONTROL_CLASS} style={selectStyle} value={value} onChange={(event) => onChange(event.target.value)}>{SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></Field>;
}

export function BehaviourSelect({ id, label, value, onChange }: { id: string; label: string; value: BehaviourKey; onChange: (value: BehaviourKey) => void }) {
  return <Field id={id} label={label}><select id={id} className={CONTROL_CLASS} style={selectStyle} value={value} onChange={(event) => onChange(event.target.value as BehaviourKey)}>{BEHAVIOUR_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}</select></Field>;
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-xs" style={{ color: "var(--text-faint)" }}>{label}</dt><dd className="mt-1 text-lg font-semibold tracking-tight">{value}</dd></div>;
}

export function raterNameFor(state: HumanEvidenceState, id: string): string {
  return state.raters.find((rater) => rater.id === id)?.displayName ?? id;
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${Math.round(value * 100)}pp`;
}

export function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rater";
}

export function boundedWholeNumber(value: string, lower: number, upper: number): number {
  const number = Math.round(Number(value));
  return Math.max(lower, Math.min(upper, Number.isFinite(number) ? number : lower));
}

export function defaultDraft(score: number): AdjudicationDraft {
  return { decision: "uncertain", score: score.toFixed(2), rationale: "", evidence: "" };
}

export interface AdjudicationDraft {
  decision: HumanDecision;
  score: string;
  rationale: string;
  evidence: string;
}
