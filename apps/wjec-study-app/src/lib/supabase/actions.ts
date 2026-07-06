"use server";

import { createClient } from "./server";
import { reviewCard } from "@/lib/fsrs";
import { computeStreak } from "@/lib/stats";
import {
  XP_LESSON_COMPLETE_BONUS,
  XP_PER_CARD_GRADE,
  XP_PER_LESSON_SECTION,
  XP_PER_QUIZ_CORRECT,
  XP_PER_STUDY_DAY,
} from "@/lib/gamification";
import type { Flashcard, RecallGrade, SessionKind, SubjectId, TaskStatus } from "@/lib/types";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, userId: user.id };
}

async function addXp(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, amount: number) {
  const { data } = await supabase.from("profiles").select("xp").eq("id", userId).single();
  await supabase
    .from("profiles")
    .update({ xp: (data?.xp ?? 0) + amount, updated_at: new Date().toISOString() })
    .eq("id", userId);
}

// Records today as a study day (idempotent) and awards the once-per-day XP the
// first time it happens, keeping longest_streak in sync.
async function recordStudyDay(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const today = toDateOnly(new Date());
  const { data: existing } = await supabase
    .from("study_days")
    .select("day")
    .eq("user_id", userId)
    .eq("day", today)
    .maybeSingle();
  if (existing) return;

  await supabase.from("study_days").insert({ user_id: userId, day: today });
  await addXp(supabase, userId, XP_PER_STUDY_DAY);

  const { data: days } = await supabase.from("study_days").select("day").eq("user_id", userId);
  const streak = computeStreak((days ?? []).map((d) => d.day));
  const { data: profile } = await supabase
    .from("profiles")
    .select("longest_streak")
    .eq("id", userId)
    .single();
  await supabase
    .from("profiles")
    .update({
      current_streak: streak,
      longest_streak: Math.max(profile?.longest_streak ?? 0, streak),
      last_study_date: today,
    })
    .eq("id", userId);
}

export async function gradeCardAction(cardProgressId: string, grade: RecallGrade) {
  const { supabase, userId } = await requireUser();

  const { data: progress } = await supabase
    .from("flashcard_progress")
    .select("*, flashcard_content!inner(subject_id, topic_id, front, back)")
    .eq("id", cardProgressId)
    .eq("user_id", userId)
    .single();
  if (!progress) throw new Error("Card not found");

  const content = progress.flashcard_content as unknown as {
    subject_id: string;
    topic_id: string;
    front: string;
    back: string;
  };
  const card: Flashcard = {
    id: progress.id,
    subjectId: content.subject_id as SubjectId,
    topicId: content.topic_id,
    front: content.front,
    back: content.back,
    dueDate: progress.due_date,
    stability: progress.stability,
    difficulty: progress.difficulty,
    reps: progress.reps,
    lapses: progress.lapses,
    state: progress.state,
    lastReviewedAt: progress.last_reviewed_at,
  };

  const updated = reviewCard(card, grade);
  await supabase
    .from("flashcard_progress")
    .update({
      due_date: updated.dueDate,
      stability: updated.stability,
      difficulty: updated.difficulty,
      reps: updated.reps,
      lapses: updated.lapses,
      state: updated.state,
      last_reviewed_at: updated.lastReviewedAt,
    })
    .eq("id", cardProgressId)
    .eq("user_id", userId);

  const { data: profile } = await supabase
    .from("profiles")
    .select("total_reviews")
    .eq("id", userId)
    .single();
  await supabase
    .from("profiles")
    .update({ total_reviews: (profile?.total_reviews ?? 0) + 1 })
    .eq("id", userId);
  await addXp(supabase, userId, XP_PER_CARD_GRADE[grade]);
  await recordStudyDay(supabase, userId);
}

export async function recordQuizAttemptAction(
  subjectId: SubjectId,
  topicId: string,
  score: number,
  total: number,
) {
  const { supabase, userId } = await requireUser();
  await supabase.from("quiz_attempts").insert({
    user_id: userId,
    subject_id: subjectId,
    topic_id: topicId,
    score,
    total,
  });
  await addXp(supabase, userId, score * XP_PER_QUIZ_CORRECT);
  await recordStudyDay(supabase, userId);
}

export async function completeLessonAction(topicId: string, sectionCount: number) {
  const { supabase, userId } = await requireUser();
  const { data: existing } = await supabase
    .from("lesson_completions")
    .select("topic_id")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .maybeSingle();
  if (!existing) {
    await supabase.from("lesson_completions").insert({ user_id: userId, topic_id: topicId });
  }
  await addXp(supabase, userId, sectionCount * XP_PER_LESSON_SECTION + XP_LESSON_COMPLETE_BONUS);
  await recordStudyDay(supabase, userId);
}

export async function setExamDateAction(subjectId: SubjectId, date: string) {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("exam_dates")
    .upsert({ user_id: userId, subject_id: subjectId, exam_date: date });
}

export async function clearExamDateAction(subjectId: SubjectId) {
  const { supabase, userId } = await requireUser();
  await supabase.from("exam_dates").delete().eq("user_id", userId).eq("subject_id", subjectId);
}

export async function setNotebookLinkAction(topicId: string, url: string) {
  const { supabase, userId } = await requireUser();
  if (!url) {
    await supabase.from("notebook_links").delete().eq("user_id", userId).eq("topic_id", topicId);
    return;
  }
  await supabase.from("notebook_links").upsert({ user_id: userId, topic_id: topicId, url });
}

export async function bulkImportNotebookLinksAction(links: Record<string, string>) {
  const { supabase, userId } = await requireUser();
  const rows = Object.entries(links).map(([topic_id, url]) => ({ user_id: userId, topic_id, url }));
  if (rows.length > 0) await supabase.from("notebook_links").upsert(rows);
}

export async function logTimeSessionAction(
  kind: SessionKind,
  subjectId: SubjectId | null,
  durationMs: number,
) {
  if (durationMs <= 0) return;
  const { supabase, userId } = await requireUser();
  await supabase.from("time_sessions").insert({
    user_id: userId,
    kind,
    subject_id: subjectId,
    started_at: new Date(Date.now() - durationMs).toISOString(),
    duration_ms: durationMs,
  });
}

export async function addNoteAction(input: {
  title: string;
  body: string;
  sketchDataUrl: string | null;
  audioDataUrl: string | null;
  tags: string[];
  subjectId: SubjectId | null;
  topicId: string | null;
}): Promise<string> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      title: input.title,
      body: input.body,
      sketch_data_url: input.sketchDataUrl,
      audio_data_url: input.audioDataUrl,
      tags: input.tags,
      subject_id: input.subjectId,
      topic_id: input.topicId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteNoteAction(id: string) {
  const { supabase, userId } = await requireUser();
  await supabase.from("notes").delete().eq("id", id).eq("user_id", userId);
}

export async function addTaskAction(title: string): Promise<string> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, title })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteTaskAction(id: string) {
  const { supabase, userId } = await requireUser();
  await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);
}

export async function setTaskStatusAction(id: string, status: TaskStatus) {
  const { supabase, userId } = await requireUser();
  await supabase.from("tasks").update({ status }).eq("id", id).eq("user_id", userId);
}

export async function addSubtaskAction(taskId: string, title: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("subtasks")
    .insert({ task_id: taskId, title })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function toggleSubtaskAction(subtaskId: string, done: boolean) {
  const { supabase } = await requireUser();
  await supabase.from("subtasks").update({ done }).eq("id", subtaskId);
}

export async function addTaskLinkAction(taskId: string, links: string[]) {
  const { supabase, userId } = await requireUser();
  await supabase.from("tasks").update({ links }).eq("id", taskId).eq("user_id", userId);
}

export async function addQaMessageAction(role: "user" | "assistant", content: string) {
  const { supabase, userId } = await requireUser();
  await supabase.from("qa_messages").insert({ user_id: userId, role, content });
}

export async function clearQaHistoryAction() {
  const { supabase, userId } = await requireUser();
  await supabase.from("qa_messages").delete().eq("user_id", userId);
}

export async function addAnchorDocumentAction(title: string, sourceText: string): Promise<string> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("anchor_documents")
    .insert({ user_id: userId, title, source_text: sourceText })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function removeAnchorDocumentAction(id: string) {
  const { supabase, userId } = await requireUser();
  await supabase.from("anchor_documents").delete().eq("id", id).eq("user_id", userId);
}

export async function saveAudioOverviewAction(topicId: string, audioDataUrl: string) {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("user_audio_overviews")
    .upsert({ user_id: userId, topic_id: topicId, audio_data_url: audioDataUrl });
}

export async function setAccentThemeAction(accent: string, unlockedThemes: string[]) {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("profiles")
    .update({ accent_theme: accent, unlocked_themes: unlockedThemes })
    .eq("id", userId);
}

export async function setStudyPlanModeAction(mode: "list" | "calendar") {
  const { supabase, userId } = await requireUser();
  await supabase.from("profiles").update({ study_plan_mode: mode }).eq("id", userId);
}

export async function addCalendarBlockAction(input: {
  day: string;
  startHour: number;
  durationHours: number;
  title: string;
  subjectId: SubjectId | null;
  topicId: string | null;
}): Promise<string> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("calendar_blocks")
    .insert({
      user_id: userId,
      day: input.day,
      start_hour: input.startHour,
      duration_hours: input.durationHours,
      title: input.title,
      subject_id: input.subjectId,
      topic_id: input.topicId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function moveCalendarBlockAction(id: string, day: string, startHour: number) {
  const { supabase, userId } = await requireUser();
  await supabase
    .from("calendar_blocks")
    .update({ day, start_hour: startHour })
    .eq("id", id)
    .eq("user_id", userId);
}

export async function deleteCalendarBlockAction(id: string) {
  const { supabase, userId } = await requireUser();
  await supabase.from("calendar_blocks").delete().eq("id", id).eq("user_id", userId);
}

export async function recordChainFlashcardCompletionAction(chainId: string) {
  const { supabase, userId } = await requireUser();
  const { data: existing } = await supabase
    .from("chain_flashcard_progress")
    .select("times_completed")
    .eq("user_id", userId)
    .eq("chain_id", chainId)
    .maybeSingle();
  await supabase.from("chain_flashcard_progress").upsert({
    user_id: userId,
    chain_id: chainId,
    times_completed: (existing?.times_completed ?? 0) + 1,
    last_completed_at: new Date().toISOString(),
  });
}
