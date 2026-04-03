-- ============================================================
-- ACBS Database Schema
-- Run once: mysql -u root -p acbs_db < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS acbs_db;
USE acbs_db;

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_id   VARCHAR(255) NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  name        VARCHAR(255) NOT NULL,
  picture     TEXT,
  role        ENUM('STUDENT','TEACHER','ADMIN') NOT NULL DEFAULT 'STUDENT',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Teachers (extends users with role=TEACHER) ─────────────
CREATE TABLE IF NOT EXISTS teachers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL UNIQUE,
  department  VARCHAR(255),
  bio         TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teacher_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- ── Availability (recurring weekly slots per teacher) ──────
CREATE TABLE IF NOT EXISTS availability (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id   INT UNSIGNED NOT NULL,
  day_of_week  ENUM('MON','TUE','WED','THU','FRI','SAT') NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_avail_teacher FOREIGN KEY (teacher_id)
    REFERENCES teachers(id) ON DELETE CASCADE,
  CONSTRAINT chk_avail_time CHECK (end_time > start_time),
  INDEX idx_avail_teacher (teacher_id)
);

-- ── Bookings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id      INT UNSIGNED NOT NULL,
  teacher_id      INT UNSIGNED NOT NULL,
  availability_id INT UNSIGNED NOT NULL,
  scheduled_date  DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  status          ENUM('PENDING','APPROVED','COMPLETED','CANCELLED')
                  NOT NULL DEFAULT 'PENDING',
  student_notes   TEXT,
  teacher_notes   TEXT,
  meet_link       VARCHAR(500),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_student  FOREIGN KEY (student_id)  REFERENCES users(id),
  CONSTRAINT fk_booking_teacher  FOREIGN KEY (teacher_id)  REFERENCES teachers(id),
  CONSTRAINT fk_booking_avail    FOREIGN KEY (availability_id) REFERENCES availability(id),
  -- Core double-booking prevention at DB level
  UNIQUE KEY uq_no_double_book (teacher_id, scheduled_date, start_time),
  INDEX idx_booking_student (student_id),
  INDEX idx_booking_teacher (teacher_id),
  INDEX idx_booking_date    (scheduled_date)
);

-- ── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  booking_id  INT UNSIGNED,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user    FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE SET NULL,
  INDEX idx_notif_user (user_id)
);