import { AuthForm } from '@/components/auth/AuthForm'
import { signup } from '../actions'

export default function SignupPage() {
  return (
    <AuthForm
      title="Create your account"
      action={signup}
      submitLabel="Sign up"
      altPrompt="Already have an account?"
      altHref="/login"
      altLabel="Sign in"
    />
  )
}
