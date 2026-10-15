import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Magic links are requested server-side (lift-magic-link), so PKCE can't be used.
    flowType: 'implicit',
    storageKey: 'lift-auth',
  },
})

export const T = {
  exercises: 'lift_exercises',
  templates: 'lift_workout_templates',
  templateExercises: 'lift_template_exercises',
  sessions: 'lift_workout_sessions',
  sets: 'lift_workout_sets',
  programs: 'lift_workout_programs',
  programDays: 'lift_program_days',
} as const

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Not signed in')
  return id
}
