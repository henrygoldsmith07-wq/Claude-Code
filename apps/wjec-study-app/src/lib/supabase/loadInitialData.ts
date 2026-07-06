import { createClient } from "./server";
import type {
  AnchorDocument,
  AudioOverview,
  Flashcard,
  LessonSection,
  Note,
  QaMessage,
  QuizAttempt,
  QuizQuestion,
  SubjectId,
  Task,
  TimeSession,
} from "@/lib/types";

export interface InitialStudyData {
  profile: {
    displayName: string | null;
    xp: number;
    coins: number;
    currentStreak: number;
    longestStreak: number;
    totalReviews: number;
    accentTheme: string;
    unlockedThemes: string[];
  };
  cards: Record<string, Flashcard>;
  quizBank: Record<string, QuizQuestion[]>;
  quizAttempts: QuizAttempt[];
  lessonBank: Record<string, LessonSection[]>;
  lessonCompletions: string[];
  notebookLinks: Record<string, string>;
  examDates: Record<string, string>;
  studyDays: string[];
  notes: Note[];
  tasks: Task[];
  timeSessions: TimeSession[];
  qaHistory: QaMessage[];
  anchorDocuments: AnchorDocument[];
  audioOverviews: Record<string, AudioOverview>;
  badges: string[];
}

export async function loadInitialData(userId: string): Promise<InitialStudyData> {
  const supabase = await createClient();

  const [
    profileRes,
    contentRes,
    progressRes,
    quizContentRes,
    quizAttemptsRes,
    lessonContentRes,
    lessonCompletionsRes,
    notebookLinksRes,
    examDatesRes,
    studyDaysRes,
    notesRes,
    tasksRes,
    subtasksRes,
    timeSessionsRes,
    qaMessagesRes,
    anchorDocumentsRes,
    audioScriptRes,
    userAudioRes,
    badgesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("flashcard_content").select("id, subject_id, topic_id, front, back"),
    supabase.from("flashcard_progress").select("*").eq("user_id", userId),
    supabase.from("quiz_content").select("id, subject_id, topic_id, question, options, correct_index, explanation"),
    supabase.from("quiz_attempts").select("*").eq("user_id", userId),
    supabase.from("lesson_content").select("topic_id, sections"),
    supabase.from("lesson_completions").select("topic_id").eq("user_id", userId),
    supabase.from("notebook_links").select("topic_id, url").eq("user_id", userId),
    supabase.from("exam_dates").select("subject_id, exam_date").eq("user_id", userId),
    supabase.from("study_days").select("day").eq("user_id", userId),
    supabase.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("subtasks").select("*, tasks!inner(user_id)").eq("tasks.user_id", userId),
    supabase.from("time_sessions").select("*").eq("user_id", userId),
    supabase.from("qa_messages").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase
      .from("anchor_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("audio_script_content").select("topic_id, script"),
    supabase.from("user_audio_overviews").select("topic_id, audio_data_url").eq("user_id", userId),
    supabase.from("user_badges").select("badge_id").eq("user_id", userId),
  ]);

  const profile = profileRes.data!;
  const contentById = new Map((contentRes.data ?? []).map((c) => [c.id, c]));

  const cards: Record<string, Flashcard> = {};
  for (const p of progressRes.data ?? []) {
    const content = contentById.get(p.flashcard_content_id);
    if (!content) continue;
    cards[p.id] = {
      id: p.id,
      subjectId: content.subject_id as SubjectId,
      topicId: content.topic_id,
      front: content.front,
      back: content.back,
      dueDate: p.due_date,
      stability: p.stability,
      difficulty: p.difficulty,
      reps: p.reps,
      lapses: p.lapses,
      state: p.state,
      lastReviewedAt: p.last_reviewed_at,
    };
  }

  const quizBank: Record<string, QuizQuestion[]> = {};
  for (const q of quizContentRes.data ?? []) {
    const question: QuizQuestion = {
      id: q.id,
      subjectId: q.subject_id as SubjectId,
      topicId: q.topic_id,
      question: q.question,
      options: q.options as string[],
      correctIndex: q.correct_index,
      explanation: q.explanation,
    };
    (quizBank[q.topic_id] ??= []).push(question);
  }

  const lessonBank: Record<string, LessonSection[]> = {};
  for (const l of lessonContentRes.data ?? []) {
    lessonBank[l.topic_id] = l.sections as unknown as LessonSection[];
  }

  const notebookLinks: Record<string, string> = {};
  for (const n of notebookLinksRes.data ?? []) notebookLinks[n.topic_id] = n.url;

  const examDates: Record<string, string> = {};
  for (const e of examDatesRes.data ?? []) examDates[e.subject_id] = e.exam_date;

  const subtasksByTask = new Map<string, Task["subtasks"]>();
  for (const s of subtasksRes.data ?? []) {
    const list = subtasksByTask.get(s.task_id) ?? [];
    list.push({ id: s.id, title: s.title, done: s.done });
    subtasksByTask.set(s.task_id, list);
  }

  const audioScriptByTopic = new Map((audioScriptRes.data ?? []).map((a) => [a.topic_id, a.script]));
  const audioOverviews: Record<string, AudioOverview> = {};
  for (const a of userAudioRes.data ?? []) {
    const script = audioScriptByTopic.get(a.topic_id);
    if (!script) continue;
    audioOverviews[a.topic_id] = {
      topicId: a.topic_id,
      script: script as unknown as AudioOverview["script"],
      audioDataUrl: a.audio_data_url,
    };
  }

  return {
    profile: {
      displayName: profile.display_name,
      xp: profile.xp,
      coins: profile.coins,
      currentStreak: profile.current_streak,
      longestStreak: profile.longest_streak,
      totalReviews: profile.total_reviews,
      accentTheme: profile.accent_theme,
      unlockedThemes: profile.unlocked_themes,
    },
    cards,
    quizBank,
    quizAttempts: (quizAttemptsRes.data ?? []).map((a) => ({
      id: a.id,
      subjectId: a.subject_id as SubjectId,
      topicId: a.topic_id,
      score: a.score,
      total: a.total,
      completedAt: a.completed_at,
    })),
    lessonBank,
    lessonCompletions: (lessonCompletionsRes.data ?? []).map((l) => l.topic_id),
    notebookLinks,
    examDates,
    studyDays: (studyDaysRes.data ?? []).map((d) => d.day),
    notes: (notesRes.data ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      sketchDataUrl: n.sketch_data_url,
      audioDataUrl: n.audio_data_url,
      tags: n.tags,
      subjectId: n.subject_id as SubjectId | null,
      topicId: n.topic_id,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    })),
    tasks: (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as Task["status"],
      subtasks: subtasksByTask.get(t.id) ?? [],
      links: t.links,
      createdAt: t.created_at,
    })),
    timeSessions: (timeSessionsRes.data ?? []).map((s) => ({
      id: s.id,
      kind: s.kind as TimeSession["kind"],
      subjectId: s.subject_id as SubjectId | null,
      startedAt: s.started_at,
      durationMs: Number(s.duration_ms),
    })),
    qaHistory: (qaMessagesRes.data ?? []).map((m) => ({
      id: m.id,
      role: m.role as QaMessage["role"],
      content: m.content,
      createdAt: m.created_at,
    })),
    anchorDocuments: (anchorDocumentsRes.data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      sourceText: d.source_text,
      createdAt: d.created_at,
    })),
    audioOverviews,
    badges: (badgesRes.data ?? []).map((b) => b.badge_id),
  };
}
