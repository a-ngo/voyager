'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AuthState } from '@/app/(auth)/actions'

interface AuthFormProps {
  title: string
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>
  submitLabel: string
  altPrompt: string
  altHref: string
  altLabel: string
}

export function AuthForm({
  title,
  action,
  submitLabel,
  altPrompt,
  altHref,
  altLabel,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="rounded-[var(--radius-card)] border border-border bg-panel-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="current-password"
              className="rounded-[var(--radius-card)] border border-border bg-panel-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
            />
          </label>

          {state.error && <p className="text-xs text-negative">{state.error}</p>}
          {state.message && <p className="text-xs text-positive">{state.message}</p>}

          <Button type="submit" variant="brand" disabled={pending} className="mt-1">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          {altPrompt}{' '}
          <Link href={altHref} className="text-brand hover:underline">
            {altLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
