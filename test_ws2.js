import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import mysql from 'mysql2/promise';

async function test() {
  const dotEnv = fs.readFileSync('.env', 'utf8');
  const jwtSecretMatch = dotEnv.match(/JWT_SECRET=(.*)/);
  const jwtSecret = jwtSecretMatch ? jwtSecretMatch[1] : 'my_super_secret_key';

  const userMatch = dotEnv.match(/DB_USER=(.*)/);
  const passMatch = dotEnv.match(/DB_PASSWORD=(.*)/);
  const nameMatch = dotEnv.match(/DB_NAME=(.*)/);
  
  const user = userMatch ? userMatch[1] : 'root';
  const pass = passMatch ? passMatch[1] : '';
  const dbName = nameMatch ? nameMatch[1] : 'acbs_db';

  const db = await mysql.createPool({ user, password: pass, database: dbName });
  const [bookings] = await db.query("SELECT * FROM bookings WHERE status = 'APPROVED' AND consultation_type = 'ONLINE' LIMIT 1");
  if (bookings.length === 0) { console.log('No booking found'); process.exit(0); }
  const booking = bookings[0];

  const token = jwt.sign({ sub: booking.student_id, name: 'Test', role: 'STUDENT' }, jwtSecret);
  
  const ws = new WebSocket(`ws://localhost:3000/ws/chat?token=${token}&bookingId=${booking.id}`);
  ws.on('open', () => {
    console.log('OPENED SUCCESSFULLY!');
    setTimeout(() => { ws.close(); process.exit(0); }, 500);
  });
  ws.on('error', e => console.error('ERROR:', e.message));
  ws.on('close', (code, reason) => {
    console.log('CLOSE', code, reason.toString());
    process.exit(0);
  });
}
test();
