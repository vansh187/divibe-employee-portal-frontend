import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { signup, verifySignupOtp, resendSignupOtp, type SignupInput } from '@/features/auth/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { InlineError } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'

const detailsSchema = z
  .object({
    name: z.string().min(1, 'Full name is required').max(200, 'Name is too long'),
    email: z.string().min(1, 'Work email is required').email('Enter a valid email address'),
    employeeId: z
      .string()
      .min(1, 'Employee ID is required')
      .max(50, 'Employee ID is too long')
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Use letters, numbers and . _ / - only'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type DetailsValues = z.infer<typeof detailsSchema>

const otpSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
})

type OtpValues = z.infer<typeof otpSchema>

const RESEND_COOLDOWN_SECONDS = 30

export default function SignupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  const detailsForm = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema) })
  const otpForm = useForm<OtpValues>({ resolver: zodResolver(otpSchema) })

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
    const timer = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(timer)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const onSubmitDetails = async (values: DetailsValues) => {
    setFormError(null)
    const input: SignupInput = {
      name: values.name,
      email: values.email,
      employeeId: values.employeeId,
      password: values.password,
    }
    try {
      const res = await signup(input)
      setPendingEmail(res.email)
      setDevOtp(res.devOtp ?? null)
      startCooldown()
      setStep('otp')
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) {
        setFormError(err.fields.map((f) => f.message).join(' '))
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Unable to sign up right now. Please try again.')
      }
    }
  }

  const onSubmitOtp = async (values: OtpValues) => {
    setFormError(null)
    try {
      await verifySignupOtp({ email: pendingEmail, otp: values.otp })
      navigate('/login', { replace: true, state: { signupVerified: true } })
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to verify this code right now. Please try again.')
    }
  }

  const onResend = async () => {
    setFormError(null)
    setResending(true)
    try {
      const res = await resendSignupOtp(pendingEmail)
      setDevOtp(res.devOtp ?? null)
      startCooldown()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to resend the code right now. Please try again.')
    } finally {
      setResending(false)
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
        </div>

        <p className="text-xs text-cream-100/50">est. 2005 · Karnal, Ganaur, Kurukshetra</p>
      </aside>

      <main className="flex items-center justify-center bg-cream-100 px-6 py-12">
        <div className="w-full max-w-sm">
          {step === 'details' ? (
            <>
              <h2 className="font-display text-2xl text-ink-900">Create your account</h2>
              <p className="mt-1 text-sm text-ink-500">We'll email you a code to verify it's really you.</p>

              <form className="mt-8 flex flex-col gap-5" onSubmit={detailsForm.handleSubmit(onSubmitDetails)} noValidate>
                {formError && <InlineError message={formError} />}

                <Input
                  label="Full name"
                  autoComplete="name"
                  error={detailsForm.formState.errors.name?.message}
                  {...detailsForm.register('name')}
                />
                <Input
                  label="Work email"
                  type="email"
                  placeholder="firstname@divinevisioninfra.com"
                  autoComplete="username"
                  error={detailsForm.formState.errors.email?.message}
                  {...detailsForm.register('email')}
                />
                <Input
                  label="Employee ID"
                  placeholder="DVI-1234"
                  error={detailsForm.formState.errors.employeeId?.message}
                  {...detailsForm.register('employeeId')}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  error={detailsForm.formState.errors.password?.message}
                  {...detailsForm.register('password')}
                />
                <Input
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  error={detailsForm.formState.errors.confirmPassword?.message}
                  {...detailsForm.register('confirmPassword')}
                />

                <Button type="submit" isLoading={detailsForm.formState.isSubmitting} className="w-full">
                  Send verification code
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl text-ink-900">Verify your email</h2>
              <p className="mt-1 text-sm text-ink-500">
                Enter the 6-digit code we sent to <span className="font-semibold text-ink-900">{pendingEmail}</span>.
              </p>

              {devOtp && (
                <div className="mt-4 rounded-md border border-gold-500/40 bg-gold-500/10 px-4 py-3 text-sm text-ink-900">
                  Mock mode — no email was actually sent. Your code is{' '}
                  <span className="font-mono font-semibold">{devOtp}</span>.
                </div>
              )}

              <form className="mt-6 flex flex-col gap-5" onSubmit={otpForm.handleSubmit(onSubmitOtp)} noValidate>
                {formError && <InlineError message={formError} />}

                <Input
                  label="Verification code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  error={otpForm.formState.errors.otp?.message}
                  {...otpForm.register('otp')}
                />

                <Button type="submit" isLoading={otpForm.formState.isSubmitting} className="w-full">
                  Verify email
                </Button>

                <button
                  type="button"
                  onClick={onResend}
                  disabled={resendCooldown > 0 || resending}
                  className="text-center text-sm text-gold-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-500/60 disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>

                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="text-center text-xs text-ink-500 hover:underline"
                >
                  Back to details
                </button>
              </form>
            </>
          )}

          <div className="my-6 flex items-center gap-3 text-xs text-ink-500">
            <span className="h-px flex-1 bg-forest-800/10" />
            or
            <span className="h-px flex-1 bg-forest-800/10" />
          </div>

          <p className="text-center text-sm text-ink-500">
            Already have an account?{' '}
            <Link to="/login" className="text-gold-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
