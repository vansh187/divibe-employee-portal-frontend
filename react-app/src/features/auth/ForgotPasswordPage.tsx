import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { requestPasswordReset, resetPassword, verifyPasswordResetOtp } from '@/features/auth/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { InlineError } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'

const emailSchema = z.object({
  email: z.string().min(1, 'Work email is required').email('Enter a valid email address'),
})

type EmailValues = z.infer<typeof emailSchema>

const otpSchema = z.object({
  otp: z.string().length(6, 'Enter the 6-digit code'),
})

type OtpValues = z.infer<typeof otpSchema>

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type PasswordValues = z.infer<typeof passwordSchema>

const RESEND_COOLDOWN_SECONDS = 30

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email')
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  const emailForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema) })
  const otpForm = useForm<OtpValues>({ resolver: zodResolver(otpSchema) })
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const startCooldown = () => setResendCooldown(RESEND_COOLDOWN_SECONDS)

  const onSubmitEmail = async (values: EmailValues) => {
    setFormError(null)
    try {
      const res = await requestPasswordReset(values.email.trim())
      setPendingEmail(res.email ?? values.email.trim())
      setDevOtp(res.devOtp ?? null)
      otpForm.reset()
      startCooldown()
      setStep('otp')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to send a reset code right now. Please try again.')
    }
  }

  const onSubmitOtp = async (values: OtpValues) => {
    setFormError(null)
    try {
      const token = await verifyPasswordResetOtp({ email: pendingEmail, otp: values.otp.trim() })
      setResetToken(token)
      setStep('password')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to verify this code right now. Please try again.')
    }
  }

  const onSubmitPassword = async (values: PasswordValues) => {
    setFormError(null)
    try {
      await resetPassword({ resetToken, password: values.password })
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) {
        setFormError(err.fields.map((f) => f.message).join(' '))
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Unable to update your password right now. Please try again.')
      }
    }
  }

  const onResend = async () => {
    setFormError(null)
    setResending(true)
    try {
      const res = await requestPasswordReset(pendingEmail)
      setDevOtp(res.devOtp ?? null)
      startCooldown()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to resend the code right now. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const goToEmailStep = () => {
    setFormError(null)
    setDevOtp(null)
    setStep('email')
  }

  return (
    <div className="grid min-h-screen w-full grid-cols-1 grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-1">
      <aside className="flex flex-col justify-between bg-forest-800 px-6 py-5 text-cream-100 md:px-14 md:py-12">
        <div>
          <p className="font-display text-lg font-semibold tracking-wide text-gold-400">DIVINE VISION INFRATECH</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-cream-100/70">Field &amp; Site Operations</p>
        </div>

        <div className="hidden max-w-md md:block">
          <h1 className="font-display text-4xl leading-tight text-cream-50 md:text-5xl">
            Every site visit, held to one standard.
          </h1>
        </div>

        <p className="hidden text-xs text-cream-100/50 md:block">est. 2005 · Karnal, Ganaur, Kurukshetra</p>
      </aside>

      <main className="flex items-start justify-center bg-cream-100 px-4 py-8 sm:px-6 md:items-center md:py-12">
        <div className="w-full max-w-sm">
          {step === 'email' && (
            <>
              <h2 className="font-display text-2xl text-ink-900">Reset your password</h2>
              <p className="mt-1 text-sm text-ink-500">Enter your work email and we'll send you a 6-digit code.</p>

              <form className="mt-8 flex flex-col gap-5" onSubmit={emailForm.handleSubmit(onSubmitEmail)} noValidate>
                {formError && <InlineError message={formError} />}

                <Input
                  label="Work email"
                  type="email"
                  placeholder="firstname@divinevisioninfra.com"
                  autoComplete="username"
                  error={emailForm.formState.errors.email?.message}
                  {...emailForm.register('email')}
                />

                <Button type="submit" isLoading={emailForm.formState.isSubmitting} className="w-full">
                  Send reset code
                </Button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <h2 className="font-display text-2xl text-ink-900">Check your email</h2>
              <p className="mt-1 text-sm text-ink-500">
                If an account exists for <span className="font-semibold text-ink-900">{pendingEmail}</span>, we've sent
                a 6-digit code to it.
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
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  error={otpForm.formState.errors.otp?.message}
                  {...otpForm.register('otp')}
                />

                <Button type="submit" isLoading={otpForm.formState.isSubmitting} className="w-full">
                  Verify code
                </Button>

                <button
                  type="button"
                  onClick={onResend}
                  disabled={resendCooldown > 0 || resending}
                  className="text-center text-sm text-gold-600 hover:underline disabled:cursor-not-allowed disabled:text-ink-500/60 disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>

                <button type="button" onClick={goToEmailStep} className="text-center text-xs text-ink-500 hover:underline">
                  Use a different email
                </button>
              </form>
            </>
          )}

          {step === 'password' && (
            <>
              <h2 className="font-display text-2xl text-ink-900">Choose a new password</h2>
              <p className="mt-1 text-sm text-ink-500">
                Code verified for <span className="font-semibold text-ink-900">{pendingEmail}</span>.
              </p>

              <form className="mt-8 flex flex-col gap-5" onSubmit={passwordForm.handleSubmit(onSubmitPassword)} noValidate>
                {formError && <InlineError message={formError} />}

                <Input
                  label="New password"
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.password?.message}
                  {...passwordForm.register('password')}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register('confirmPassword')}
                />

                <Button type="submit" isLoading={passwordForm.formState.isSubmitting} className="w-full">
                  Update password
                </Button>
              </form>
            </>
          )}

          <div className="my-6 flex items-center gap-3 text-xs text-ink-500">
            <span className="h-px flex-1 bg-forest-800/10" />
            or
            <span className="h-px flex-1 bg-forest-800/10" />
          </div>

          <p className="text-center text-sm text-ink-500">
            Remembered it?{' '}
            <Link to="/login" className="text-gold-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
