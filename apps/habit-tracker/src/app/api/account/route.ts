import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Delete all habits; checkins cascade. RLS scopes this to the caller's rows.
  const { error: delError } = await supabase.from("habits").delete().eq("user_id", user.id);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // Delete the auth user when service role is configured. Without it, the
  // user's data is gone and the client signs out; the auth record remains
  // but holds no data.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    try {
      const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: adminError } = await admin.auth.admin.deleteUser(user.id);
      if (adminError) {
        return NextResponse.json({ warning: `Data deleted, but auth deletion failed: ${adminError.message}` });
      }
    } catch (e) {
      return NextResponse.json({ warning: `Data deleted, but auth deletion threw: ${(e as Error).message}` });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
