import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  PORT:             z.string().default('3000'),
  DB_HOST:          z.string(),
  DB_PORT:          z.string().default('3306'),
  DB_NAME:          z.string(),
  DB_USER:          z.string(),
  DB_PASSWORD:      z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  JWT_SECRET:       z.string().min(32),
  FRONTEND_URL:     z.string().default('http://localhost:4200'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌  Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data