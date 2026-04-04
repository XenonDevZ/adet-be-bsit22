import mysql from 'mysql2/promise'
import { env } from './env.js'

export const db = mysql.createPool({
  host:               env.DB_HOST,
  port:               Number(env.DB_PORT),
  database:           env.DB_NAME,
  user:               env.DB_USER,
  password:           env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
})

// Test connection on startup
db.getConnection()
  .then(conn => {
    console.log('✅  MySQL connected')
    conn.release()
  })
  .catch(err => {
    console.error('❌  MySQL connection failed:', err.message)
    process.exit(1)
  })
