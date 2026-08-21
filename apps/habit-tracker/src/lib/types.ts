/** Row shapes as Supabase returns them (snake_case, as in the schema). */
export interface DbHabit {
  id: string;
  user_id: string;
  name: string;
  target_per_week: number;
  colour: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface DbCheckin {
  id: string;
  habit_id: string;
  /** The local calendar day — Supabase returns `date` columns as "YYYY-MM-DD". */
  day: string;
  completed: boolean;
  created_at: string;
}

/** Export bundle shape (versioned) for import/export and backup. */
export interface HabitExportV1 {
  version: 1;
  exportedAt: string;
  userId?: string;
  habits: DbHabit[];
  checkins: DbCheckin[];
  settings: {
    pulseOptIn: boolean;
  };
}
