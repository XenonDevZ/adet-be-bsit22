import { createMiddleware } from 'hono/factory'
import { verifyJwt } from '../utils/jwt.js'
import { err } from '../utils/response.js'
import type { Variables } from '../types/index.js'

export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(err('Missing or malformed Authorization header'), 401)
    }

    const token = authHeader.split(' ')[1]
    const payload = verifyJwt(token)

    if (!payload) {
      return c.json(err('Invalid or expired token'), 401)
    }

    c.set('user', payload)
    await next()
  }
)