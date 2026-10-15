import { z } from 'zod'

export const ALLOWED_EMAIL_DOMAIN = 'divinevisioninfra.com'
export const WORK_EMAIL_ERROR = `Use your @${ALLOWED_EMAIL_DOMAIN} work email.`

export function isAllowedWorkEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  return at > 0 && normalized.slice(at + 1) === ALLOWED_EMAIL_DOMAIN
}

export const workEmailSchema = z
  .string()
  .trim()
  .min(1, 'Work email is required')
  .email('Enter a valid email address')
  .refine(isAllowedWorkEmail, WORK_EMAIL_ERROR)

