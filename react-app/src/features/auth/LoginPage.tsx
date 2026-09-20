import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '@/features/auth/api'
import { useAuthStore } from '@/features/auth/store'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { InlineError } from '@/components/ui/States'
import { REDIRECT_QUERY_PARAM } from '@/lib/constants'
import { ApiError } from '@/lib/api/client'

const schema = z.object({
  email: z.string().min(1, 'Work email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  keepSignedIn: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const signIn = useAuthStore((s) => s.signIn)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      const res = await login(values.email, values.password)
      signIn(res)
      const redirect = searchParams.get(REDIRECT_QUERY_PARAM)
      navigate(redirect || '/dashboard', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message)
      else setFormError('Unable to sign in right now. Please try again.')
    }
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <aside className="flex flex-col justify-between bg-forest-800 px-10 py-12 text-cream-100 md:px-14">
        <div>
          <p className="font-display text-lg font-semibold tracking-wide text-gold-400">DIVINE VISION INFRATECH</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cream-100/70">Field &amp; Site Operations</p>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight text-cream-50 md:text-5xl">
            Every site visit, held to one standard.
          </h1>

          <div className="mt-10 border-t border-cream-100/15 pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-cream-100/70">Active developments</span>
              <span className="font-mono text-gold-400">03</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-cream-100/85">OPS Divine Greens · Karnal</span>
              <span className="font-mono text-gold-400">369 plots</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-cream-100/85">Suraksha Enclave · Ganaur</span>
              <span className="font-mono text-gold-400">Phase 2</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-cream-100/50">est. 2005 · Karnal, Ganaur, Kurukshetra</p>
      </aside>

      <main className="flex items-center justify-center bg-cream-100 px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl text-ink-900">Employee sign in</h2>
          <p className="mt-1 text-sm text-ink-500">Access site visits, attendance and your weekly Day Off.</p>

          <form className="mt-8 flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            {formError && <InlineError message={formError} />}

            <Input
              label="Work email"
              type="email"
              placeholder="firstname@divinevisioninfra.com"
              autoComplete="username"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-700">
                <input type="checkbox" className="size-4 rounded border-forest-800/30" {...register('keepSignedIn')} />
                Keep me signed in
              </label>
              <a href="#" className="text-gold-600 hover:underline">
                Forgot password
              </a>
            </div>

            <Button type="submit" isLoading={isSubmitting} className="w-full">
              Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-500">
            <span className="h-px flex-1 bg-forest-800/10" />
            or
            <span className="h-px flex-1 bg-forest-800/10" />
          </div>

          <p className="text-center text-sm text-ink-500">
            New employee?{' '}
            <a href="#" className="text-gold-600 hover:underline">
              Request access from your manager
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
