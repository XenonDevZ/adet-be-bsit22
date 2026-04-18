-- ============================================================
-- ACBS Database Schema  (Academic Consultation Booking System)
-- Version: 2.0  —  Updated 2026-04-17
--
-- Usage:
--   mysql -u root -p < schema.sql
--
-- Tables
--   users, teachers, availability, bookings,
--   notifications, booking_files, feedback, chat_messages

-- Run once: mysql -u root -p acbs_db < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS acbs_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE acbs_db;

-- ── Users ────────────────────────────────────────────────────
-- Stores all system users (students, teachers, admins).
-- course / year_level / department are student-profile fields;
-- department is also used for teachers (stored here for quick access).
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  google_id   VARCHAR(255)     NOT NULL UNIQUE,
  email       VARCHAR(255)     NOT NULL UNIQUE,
  name        VARCHAR(255)     NOT NULL,
  picture     TEXT,
  role        ENUM('STUDENT','TEACHER','ADMIN') NOT NULL DEFAULT 'STUDENT',

  -- Student profile fields (nullable for TEACHER/ADMIN)
  course      VARCHAR(255)     NULL,
  year_level  VARCHAR(50)      NULL,
  department  VARCHAR(255)     NULL,

  created_at  TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Teachers ─────────────────────────────────────────────────
-- Extended profile for users with role = TEACHER.
-- Created automatically when an admin promotes a user to TEACHER.
CREATE TABLE IF NOT EXISTS teachers (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED     NOT NULL UNIQUE,
  department  VARCHAR(255)     NULL,
  bio         TEXT             NULL,

  created_at  TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_teacher_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- ── Availability ─────────────────────────────────────────────
-- Recurring weekly time slots that a teacher makes available for bookings.
CREATE TABLE IF NOT EXISTS availability (
  id           INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  teacher_id   INT UNSIGNED     NOT NULL,
  day_of_week  ENUM('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
  start_time   TIME             NOT NULL,
  end_time     TIME             NOT NULL,
  is_active    TINYINT(1)       NOT NULL DEFAULT 1,

  created_at   TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_avail_teacher FOREIGN KEY (teacher_id)
    REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT chk_avail_time CHECK (end_time > start_time),
  INDEX idx_avail_teacher (teacher_id)
);

-- ── Bookings ─────────────────────────────────────────────────
-- Core table. Tracks the full lifecycle of a consultation request.
-- Reschedule fields are populated when a student requests a date change;
-- the teacher's response is recorded in reschedule_status.
-- chat_closed is set TRUE when a teacher/admin ends the in-session chat.
CREATE TABLE IF NOT EXISTS bookings (
  id                    INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  student_id            INT UNSIGNED     NOT NULL,
  teacher_id            INT UNSIGNED     NOT NULL,
  availability_id       INT UNSIGNED     NOT NULL,

  scheduled_date        DATE             NOT NULL,
  start_time            TIME             NOT NULL,
  end_time              TIME             NOT NULL,

  consultation_type     ENUM('ONLINE','FACE_TO_FACE') NOT NULL DEFAULT 'FACE_TO_FACE',
  status                ENUM('PENDING','APPROVED','COMPLETED','CANCELLED')
                        NOT NULL DEFAULT 'PENDING',

  student_notes         TEXT             NULL,
  teacher_notes         TEXT             NULL,
  meet_link             VARCHAR(500)     NULL,   -- auto-generated Google Meet URL

  -- Reschedule request (student → teacher)
  reschedule_date       DATE             NULL,
  reschedule_start_time TIME             NULL,
  reschedule_end_time   TIME             NULL,
  reschedule_status     ENUM('REQUESTED','ACCEPTED','REJECTED') NULL,

  -- Chat
  chat_closed           TINYINT(1)       NOT NULL DEFAULT 0,

  created_at            TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_booking_student  FOREIGN KEY (student_id)       REFERENCES users(id),
  CONSTRAINT fk_booking_teacher  FOREIGN KEY (teacher_id)        REFERENCES teachers(id),
  CONSTRAINT fk_booking_avail    FOREIGN KEY (availability_id)   REFERENCES availability(id),

  -- Prevent exact same slot for the same teacher from being double-booked
  UNIQUE KEY uq_no_double_book (teacher_id, scheduled_date, start_time),

  INDEX idx_booking_student  (student_id),
  INDEX idx_booking_teacher  (teacher_id),
  INDEX idx_booking_date     (scheduled_date),
  INDEX idx_booking_status   (status)
);

-- ── Notifications ─────────────────────────────────────────────
-- Push notifications delivered to individual users.
-- booking_id may be NULL for system-wide messages.
-- is_read is updated when the user opens the notification panel.
CREATE TABLE IF NOT EXISTS notifications (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED     NOT NULL,
  booking_id  INT UNSIGNED     NULL,
  message     TEXT             NOT NULL,
  is_read     TINYINT(1)       NOT NULL DEFAULT 0,

  created_at  TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notif_user    FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE SET NULL,

  INDEX idx_notif_user        (user_id),
  INDEX idx_notif_user_unread (user_id, is_read)
);

-- ── Booking Files ─────────────────────────────────────────────
-- File attachments uploaded against a booking (by student or teacher).
-- Physical files are stored in the /uploads directory on the server.
CREATE TABLE IF NOT EXISTS booking_files (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT UNSIGNED     NOT NULL,
  user_id     INT UNSIGNED     NOT NULL,
  file_name   VARCHAR(255)     NOT NULL,
  file_path   VARCHAR(500)     NOT NULL,   -- relative path inside /uploads
  file_type   VARCHAR(100)     NOT NULL,
  file_size   INT UNSIGNED     NOT NULL,   -- bytes

  uploaded_at TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_file_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_file_user   FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_file_booking (booking_id)
);

-- ── Feedback ──────────────────────────────────────────────────
-- Post-consultation ratings. One entry per reviewer per booking.
-- reviewer_id → the person submitting feedback (student or teacher).
-- reviewee_id → the person being rated (teacher or student).
CREATE TABLE IF NOT EXISTS feedback (
  id           INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  booking_id   INT UNSIGNED     NOT NULL,
  reviewer_id  INT UNSIGNED     NOT NULL,
  reviewee_id  INT UNSIGNED     NOT NULL,
  rating       TINYINT UNSIGNED NOT NULL,  -- 1–5 scale
  comment      TEXT             NULL,

  created_at   TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,

  -- One feedback per reviewer per booking
  UNIQUE KEY uq_feedback (booking_id, reviewer_id),

  CONSTRAINT fk_feedback_booking  FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_reviewer FOREIGN KEY (reviewer_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_reviewee FOREIGN KEY (reviewee_id)
    REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5),

  INDEX idx_feedback_booking (booking_id)
);

-- ── Chat Messages ─────────────────────────────────────────────
-- Real-time chat messages tied to a specific booking session.
-- is_system = TRUE for automated messages (e.g. "Chat has been closed").
-- file_url / file_name / file_type are populated for file-share messages.
CREATE TABLE IF NOT EXISTS chat_messages (
  id          INT UNSIGNED     AUTO_INCREMENT PRIMARY KEY,
  booking_id  INT UNSIGNED     NOT NULL,
  sender_id   INT UNSIGNED     NOT NULL,
  message     TEXT             NULL,
  file_url    VARCHAR(500)     NULL,
  file_name   VARCHAR(255)     NULL,
  file_type   VARCHAR(100)     NULL,
  is_system   TINYINT(1)       NOT NULL DEFAULT 0,

  created_at  TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_chat_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_sender  FOREIGN KEY (sender_id)
    REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_chat_booking (booking_id),
  INDEX idx_chat_created (booking_id, created_at)
);