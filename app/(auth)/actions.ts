'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

export interface AuthState {
  error?: string
  message?: string
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid credentials.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    // Generic message — never reveal whether the email exists.
    return { error: 'Invalid email or password.' }
  }

  redirect('/home')
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid credentials.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp(parsed.data)
  if (error) {
    return { error: 'Could not create the account. Try a different email.' }
  }

  // With email confirmation enabled, no session exists yet.
  if (!data.session) {
    return { message: 'Check your email to confirm your account, then sign in.' }
  }

  redirect('/home')
}

export async function signout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
