import { db } from './src/config/db.js';
import { createMeetLink } from './src/services/meet.service.js';

async function generate() {
  const [bookings] = await db.query(`
    SELECT b.*, u.name as student_name, u.email as student_email, tu.name as teacher_name
    FROM bookings b
    JOIN users u ON u.id = b.student_id
    JOIN teachers t ON t.id = b.teacher_id
    JOIN users tu ON tu.id = t.user_id
    WHERE b.status = 'APPROVED' AND b.consultation_type = 'ONLINE' AND b.meet_link IS NULL
  `) as any[];
  
  console.log(`Found ${bookings.length} APPROVED ONLINE bookings without meet links`);
  
  for (const booking of bookings) {
    try {
      // Fix date - use local date components
      const dateObj = booking.scheduled_date instanceof Date ? booking.scheduled_date : new Date(booking.scheduled_date);
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      const fmtDate = `${y}-${m}-${d}`;
      
      console.log(`  Booking ${booking.id}: date=${fmtDate} time=${booking.start_time}`);
      
      const link = await createMeetLink({
        title: `ACBS: ${booking.student_name} + ${booking.teacher_name}`,
        scheduledDate: fmtDate,
        startTime: booking.start_time,
        endTime: booking.end_time,
        studentEmail: booking.student_email,
        teacherEmail: `${booking.teacher_name.toLowerCase().replace(/\s/g, '.')}@liceo.edu.ph`,
      });
      
      await db.query('UPDATE bookings SET meet_link = ? WHERE id = ?', [link, booking.id]);
      console.log(`  ✅ Generated: ${link}`);
    } catch (e: any) {
      console.error(`  ❌ Booking ${booking.id} failed:`, e.message);
    }
  }
  process.exit(0);
}
generate();
