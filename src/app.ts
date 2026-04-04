import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './config/env.js'
import { authRoutes } from './routes/auth.routes.js'
import { usersRoutes } from './routes/users.routes.js'
import { teachersRoutes } from './routes/teachers.routes.js'
import { availabilityRoutes } from './routes/availability.routes.js'
import { bookingsRoutes } from './routes/bookings.routes.js'
import { err } from './utils/response.js'

export const app = new Hono()

// ── Global middleware ────────────────────────────────────
app.use(logger())

app.use('*', cors({
  origin:      env.FRONTEND_URL,
  credentials: true,
  allowMethods:  ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders:  ['Content-Type', 'Authorization'],
}))

// ── Health check ─────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Routes ───────────────────────────────────────────────
app.route('/auth',         authRoutes)
app.route('/users',        usersRoutes)
app.route('/teachers',     teachersRoutes)
app.route('/availability', availabilityRoutes)
app.route('/bookings',     bookingsRoutes)

// ── 404 fallback ─────────────────────────────────────────
app.notFound((c) => c.json(err('Route not found'), 404))

// ── Global error handler ─────────────────────────────────
app.onError((e, c) => {
  console.error('[Unhandled Error]', e)
  return c.json(err('Internal server error'), 500)
})
