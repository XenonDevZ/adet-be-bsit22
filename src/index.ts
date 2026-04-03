import { serve } from '@hono/node-server'
import { app } from './app.js'
import { env } from './config/env.js'
import './config/db.js'   // triggers connection test on startup

const port = Number(env.PORT)

serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀  ACBS API running on http://localhost:${port}`)
})