import { z } from 'zod'

// ── Auth ──────────────────────────────────────────────────
export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
})

// ── Users ─────────────────────────────────────────────────
export const UpdateRoleSchema = z.object({
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN'], {
    errorMap: () => ({ message: 'role must be STUDENT, TEACHER, or ADMIN' }),
  }),
})

// ── Availability ──────────────────────────────────────────
export const CreateAvailabilitySchema = z
  .object({
    day_of_week: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'], {
      errorMap: () => ({ message: 'day_of_week must be MON, TUE, WED, THU, FRI, or SAT' }),
    }),
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'start_time must be in HH:MM format'),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'end_time must be in HH:MM format'),
  })
  .refine((d) => d.start_time < d.end_time, {
    message: 'end_time must be after start_time',
    path: ['end_time'],
  })

// ── Bookings ──────────────────────────────────────────────
export const CreateBookingSchema = z.object({
  teacher_id: z
    .number({ invalid_type_error: 'teacher_id must be a number' })
    .int()
    .positive('teacher_id must be a positive integer'),
  availability_id: z
    .number({ invalid_type_error: 'availability_id must be a number' })
    .int()
    .positive('availability_id must be a positive integer'),
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'scheduled_date must be YYYY-MM-DD'),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'start_time must be HH:MM or HH:MM:SS'),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'end_time must be HH:MM or HH:MM:SS'),
  notes: z.string().max(1000, 'Notes cannot exceed 1000 characters').optional(),
})

export const UpdateBookingStatusSchema = z.object({
  status: z.enum(['APPROVED', 'COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'status must be APPROVED, COMPLETED, or CANCELLED' }),
  }),
})

export const AddNotesSchema = z.object({
  notes: z
    .string()
    .min(1, 'Notes cannot be empty')
    .max(2000, 'Notes cannot exceed 2000 characters'),
})

// ── Inferred TS types from schemas (use in controllers) ───
export type GoogleAuthInput        = z.infer<typeof GoogleAuthSchema>
export type UpdateRoleInput        = z.infer<typeof UpdateRoleSchema>
export type CreateAvailabilityInput = z.infer<typeof CreateAvailabilitySchema>
export type CreateBookingInput     = z.infer<typeof CreateBookingSchema>
export type UpdateBookingStatusInput = z.infer<typeof UpdateBookingStatusSchema>
export type AddNotesInput          = z.infer<typeof AddNotesSchema>
