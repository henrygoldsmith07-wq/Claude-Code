export type UserCredential = {
  id: string;
  user_id: string;
  service_name: string;
  encrypted_token: any; // JSONB type in DB, can be any structure
  scopes?: string[];
  expires_at?: string;
  created_at: string;
  updated_at: string;
};

export type AutomationLog = {
  id: string;
  user_id: string;
  loop_type: string;
  status: string;
  details?: any; // JSONB type in DB
  triggered_at: string;
  completed_at?: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  user_id: string;
  event_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  source: string;
  created_at: string;
};

export type HealthMetric = {
  id: string;
  user_id: string;
  metric_type: string;
  value: number;
  unit?: string;
  timestamp: string;
  source: string;
  details?: any; // JSONB type in DB
  created_at: string;
};

export type FinancialTransaction = {
  id: string;
  user_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  type: string;
  description?: string;
  timestamp: string;
  source: string;
  created_at: string;
};

export type KnowledgeItem = {
  id: string;
  user_id: string;
  title?: string;
  content: string;
  type?: string;
  source?: string;
  tags?: string[];
  metadata?: any;
  created_at?: string;
};

export type Notification = {
  id: string;
  user_id: string;
  message: string;
  channel: string;
  status: string;
  sent_at?: string;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: string;
  source: string;
  priority?: number;
  created_at: string;
  updated_at: string;
};

export type MediaListeningHistory = {
  id: string;
  user_id: string;
  item_id: string;
  title: string;
  artist_podcast?: string;
  listen_start_time?: string;
  listen_end_time?: string;
  source: string;
  created_at: string;
};

export type Setting = {
  id: string;
  user_id: string;
  key: string;
  value: any; // JSONB type in DB
  created_at: string;
  updated_at: string;
};

// Phase 2 Types
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  status?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
  };
}

export interface UpworkNotification {
  id: string;
  type: 'message' | 'invite' | 'contract_update';
  title: string;
  content: string;
  timestamp: string;
  url?: string;
  isUrgent: boolean;
}

export interface CalendarConflict {
  title: string;
  startTime: string;
  endTime: string;
  sources: string[];
}

// Phase 3 Types
export interface HevyWorkout {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  exercises: HevyExercise[];
}

export interface HevyExercise {
  id: string;
  title: string;
  sets: HevySet[];
}

export interface HevySet {
  index: number;
  reps: number;
  weight_kg: number;
  type: string;
}

export interface GoogleFitMetrics {
  steps: number;
  calories: number;
  sleepHours: number;
}

export interface StripeTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  description: string;
  timestamp: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  playedAt: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  podcast: string;
  duration: number;
  playedAt?: string;
  position?: number;
}

export interface DailyReflection {
  date: string;
  content: string;
  score: number;
  metrics: {
    steps: number;
    income: number;
    workoutDone: boolean;
  };
}

export interface ProductivityScore {
  score: number;
  reasoning: string;
  productivity: number;
  rest: number;
}
