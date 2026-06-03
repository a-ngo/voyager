import { AuthForm } from '@/components/auth/AuthForm'
import { login } from '../actions'

export default function LoginPage() {
  return (
    <AuthForm
      title="Sign in to Voyager"
      action={login}
      submitLabel="Sign in"
      altPrompt="No account?"
      altHref="/signup"
      altLabel="Create one"
    />
  )
}
