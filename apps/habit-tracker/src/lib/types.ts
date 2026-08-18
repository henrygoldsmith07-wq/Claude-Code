/** Row shapes as Supabase returns them (snake_case, as in the schema). */
export interface DbHabit {
  id: string;
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
