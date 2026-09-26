import { useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSiteVisit, type CreateSiteVisitInput } from '@/features/site-visits/api'
import { fetchProjects, fetchProperties } from '@/features/properties/api'
import { useAuthStore } from '@/features/auth/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { InlineError } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'
import type { PropertyUnit } from '@/lib/types/domain'
import { CONFLICT_MESSAGES } from '@/lib/constants'

// The live API is in IST; build visit_at as one local value with the India offset
// instead of converting to UTC, so a browser in another timezone can't shift the visit's date.
function toVisitAt(dateInput: string, timeInput: string): string {
  return `${dateInput}T${timeInput}:00+05:30`
}

// LOCKED (reserved) plots stay selectable — the API makes the final call and returns PROPERTY_LOCKED.
const isBookable = (p: PropertyUnit) => p.availability !== 'SOLD' && p.availability !== 'DEAL_LOCKED'

const schema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required'),
  phone: z.string().min(6, 'Enter a valid phone number'),
  email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
  projectId: z.string().min(1, 'Select a project/site'),
  plotNo: z.string().optional(),
  visitDate: z.string().min(1, 'Visit date is required'),
  visitTime: z.string().min(1, 'Visit time is required'),
  notes: z.string().optional(),
  outcome: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const OUTCOMES = [
  { value: '', label: 'Select outcome (optional)' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'FOLLOW_UP_REQUIRED', label: 'Follow-up required' },
  { value: 'PROPOSAL_REQUESTED', label: 'Proposal requested' },
  { value: 'NOT_INTERESTED', label: 'Not interested' },
  { value: 'NO_SHOW', label: 'No show' },
  { value: 'OTHER', label: 'Other' },
]

export default function NewSiteVisitPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const employee = useAuthStore((s) => s.employee)
  const [conflict, setConflict] = useState<{ code: string; message: string } | null>(null)
  // Generated once when the form opens; reused on retry (e.g. CONCURRENT_UPDATE) so a resubmit
  // doesn't create a duplicate visit.
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  const { data: projects, isLoading: projectsLoading } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      visitDate: new Date().toISOString().slice(0, 10),
      visitTime: new Date().toTimeString().slice(0, 5),
    },
  })

  const projectId = watch('projectId')
  const {
    data: properties,
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useQuery({
    queryKey: ['properties', projectId],
    queryFn: () => fetchProperties(projectId),
    enabled: !!projectId,
  })

  const bookablePlots = (properties ?? []).filter(isBookable)

  const mutation = useMutation({
    mutationFn: createSiteVisit,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['lead', result.lead.id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['site-visits'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/leads/${result.lead.id}`, { state: { justLogged: true } })
    },
    onError: (err) => {
      if (!(err instanceof ApiError)) {
        setConflict({ code: 'SERVER_ERROR', message: 'Unable to log this visit right now. Please try again.' })
        return
      }

      const emailFieldError = err.fields?.find((f) => f.field === 'body.email' || f.field === 'email')
      if (emailFieldError) {
        setError('email', { message: 'Enter a valid email address' })
      }

      if (err.code === 'VALIDATION_FAILED' && emailFieldError) return

      setConflict({ code: err.code, message: CONFLICT_MESSAGES[err.code] ?? err.message })
    },
  })

  const onSubmit = (values: FormValues) => {
    setConflict(null)

    let propertyId: string | undefined
    const typedPlot = values.plotNo?.trim()
    if (typedPlot) {
      const norm = (v: string) => v.replace(/\s+/g, '').replace(/^plot/i, '').toLowerCase()
      if (!properties) {
        setError('plotNo', {
          message: propertiesError ? "Couldn't load this project's plots. Please try again." : 'Plots are still loading. Please wait a moment.',
        })
        return
      }
      const match = properties.find((p) => norm(p.code) === norm(typedPlot))
      if (!match) {
        setError('plotNo', { message: 'No such plot in this project. Pick one from the suggestions.' })
        return
      }
      if (!isBookable(match)) {
        setError('plotNo', { message: 'This plot is no longer available.' })
        return
      }
      propertyId = match.id
    }

    mutation.mutate({
      visitorName: values.visitorName,
      phone: values.phone,
      email: values.email || undefined,
      projectId: values.projectId,
      propertyId,
      visitAt: toVisitAt(values.visitDate, values.visitTime),
      notes: values.notes || undefined,
      outcome: (values.outcome || undefined) as CreateSiteVisitInput['outcome'],
      idempotencyKey: idempotencyKeyRef.current,
    })
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Log a Site Visit" subtitle="Every submission creates or updates a Lead automatically." />

      <Card>
        <div className="mb-5 flex items-center gap-2 text-sm text-ink-500">
          <span className="rounded-full bg-forest-800/8 px-2.5 py-1 font-mono text-xs text-forest-800">
            {employee?.avatarInitials}
          </span>
          Logging as <span className="font-semibold text-ink-900">{employee?.name}</span>
        </div>

        {conflict && (
          <div className="mb-5">
            <InlineError message={conflict.message} />
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input label="Visitor name" error={errors.visitorName?.message} {...register('visitorName')} />
            <Input label="Phone" type="tel" placeholder="+91 XXXXX XXXXX" error={errors.phone?.message} {...register('phone')} />
          </div>

          <Input label="Email (optional)" type="email" error={errors.email?.message} {...register('email')} />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="projectId"
              render={({ field }) => (
                <Select
                  label="Project / Site"
                  error={errors.projectId?.message}
                  disabled={projectsLoading}
                  {...field}
                  onChange={(e) => {
                    field.onChange(e)
                    setValue('plotNo', '')
                  }}
                >
                  <option value="">Select a project</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.location}
                    </option>
                  ))}
                </Select>
              )}
            />
            <div>
              <Input
                label="Unit / Plot (optional)"
                placeholder={projectId ? 'Type plot number' : 'Select a project first'}
                list="plot-suggestions"
                autoComplete="off"
                disabled={!projectId || propertiesLoading}
                error={errors.plotNo?.message}
                {...register('plotNo')}
              />
              <datalist id="plot-suggestions">
                {bookablePlots.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.areaSqft ? `${p.areaSqft} sq ft` : ''}
                    {p.availability === 'LOCKED' ? ' (reserved)' : ''}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input label="Visit date" type="date" error={errors.visitDate?.message} {...register('visitDate')} />
            <Input label="Visit time" type="time" error={errors.visitTime?.message} {...register('visitTime')} />
          </div>

          <Controller
            control={control}
            name="outcome"
            render={({ field }) => (
              <Select label="Outcome" {...field}>
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Notes</label>
            <textarea
              rows={3}
              className="rounded-md border border-forest-800/15 bg-white px-3.5 py-2.5 text-sm text-ink-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/60"
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || mutation.isPending}>
              Log Visit
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
