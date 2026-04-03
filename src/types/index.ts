// ── Roles ────────────────────────────────────────────────
export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN'

export type BookingStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'CANCELLED'

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'

// ── JWT payload stored in token ──────────────────────────
export interface JwtPayload {
  sub: number       // users.id
  email: string
  name: string
  picture: string
  role: Role
  iat?: number
  exp?: number
}

// ── DB row types ─────────────────────────────────────────
export interface User {
  id: number
  google_id: string
  email: string
  name: string
  picture: string
  role: Role
  created_at: Date
  updated_at: Date
}

export interface Teacher {
  id: number
  user_id: number
  department: string | null
  bio: string | null
  created_at: Date
}

export interface Availability {
  id: number
  teacher_id: number
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  is_active: boolean
  created_at: Date
}

export interface Booking {
  id: number
  student_id: number
  teacher_id: number
  availability_id: number
  scheduled_date: string
  start_time: string
  end_time: string
  status: BookingStatus
  student_notes: string | null
  teacher_notes: string | null
  meet_link: string | null
  created_at: Date
  updated_at: Date
}

// ── Hono context variable type (for c.get('user')) ───────
export interface Variables {
  user: JwtPayload
}