import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';
import { UserCredential } from '@/types';

export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware refreshes sessions.
          }
        },
      },
    }
  );
};

// For server-to-server contexts with no user session (webhooks, crons, LLM
// routing across users) — bypasses RLS since there's no auth.uid() to match.
export const createServiceClient = () => {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

export async function getServiceCredential(userId: string, serviceName: string): Promise<UserCredential | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('user_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('service_name', serviceName)
    .single();

  if (error) {
    console.error(`Error fetching credential for ${serviceName}:`, error);
    return null;
  }
  return data as UserCredential;
}

export async function saveServiceCredential(credential: Omit<UserCredential, 'id' | 'created_at' | 'updated_at'>): Promise<UserCredential | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('user_credentials')
    .upsert(credential, { onConflict: 'user_id, service_name' })
    .select()
    .single();

  if (error) {
    console.error(`Error saving credential for ${credential.service_name}:`, error);
    return null;
  }
  return data as UserCredential;
}
