import fs from 'fs';
import { db } from './src/config/db.js';

async function run() {
  const [notifs] = await db.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 10');
  console.log("NOTIFS:", notifs);
  const [users] = await db.query('SELECT * FROM users');
  console.log("USERS:", users);
  const [teachers] = await db.query('SELECT * FROM teachers');
  console.log("TEACHERS:", teachers);
  process.exit(0);
}
run();
