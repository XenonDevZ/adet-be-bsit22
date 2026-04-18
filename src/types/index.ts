import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ── Re-export ResultSetHeader for services ───────────────
export type { ResultSetHeader };

// ── Domain types ─────────────────────────────────────────
export type Role = "STUDENT" | "TEACHER" | "ADMIN";
export type BookingStatus = "PENDING" | "APPROVED" | "COMPLETED" | "CANCELLED";
export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

// ── JWT payload stored in token ───────────────────────────
export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  picture: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ── Hono context variable type ────────────────────────────
export interface Variables {
  user: JwtPayload;
}

// ── DB Row types (extend RowDataPacket for mysql2) ────────

export interface UserRow extends RowDataPacket {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture: string;
  course: string | null; // ADD
  year_level: string | null; // ADD
  department: string | null; // ADD
  role: Role;
  created_at: Date;
  updated_at: Date;
}

export interface TeacherRow extends RowDataPacket {
  id: number;
  user_id: number;
  teacher_id: number;
  department: string | null;
  bio: string | null;
  name: string;
  email: string;
  picture: string;
  created_at: Date;
}

export interface AvailabilityRow extends RowDataPacket {
  id: number;
  teacher_id: number;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: Date;
}

export interface BookingRow extends RowDataPacket {
  id: number;
  student_id: number;
  teacher_id: number;
  availability_id: number;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  consultation_type: "ONLINE" | "FACE_TO_FACE"; // ADD
  student_notes: string | null;
  teacher_notes: string | null;
  student_name: string;
  student_email: string;
  teacher_name: string;
  teacher_user_id: number;
  student_user_id: number;
  created_at: Date;
  updated_at: Date;
  reschedule_date: string | null;
  reschedule_start_time: string | null;
  reschedule_end_time: string | null;
  reschedule_status: "REQUESTED" | "ACCEPTED" | "REJECTED" | null;
}

export interface NotificationRow extends RowDataPacket {
  id: number;
  user_id: number;
  booking_id: number | null;
  message: string;
  is_read: boolean;
  created_at: Date;
}

export interface BookingFileRow extends RowDataPacket {
  id: number;
  booking_id: number;
  user_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_at: Date;
  uploader_name: string;
}

export interface FeedbackRow extends RowDataPacket {
  id: number;
  booking_id: number;
  reviewer_id: number;
  reviewee_id: number;
  rating: number;
  comment: string | null;
  created_at: Date;
  reviewer_name: string;
}

export interface ChatMessageRow extends RowDataPacket {
  id: number;
  booking_id: number;
  sender_id: number;
  message: string | null;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  is_system: boolean;
  created_at: Date;
  sender_name: string;
  sender_picture: string;
  sender_role: Role;
}
