import { createMiddleware } from 'hono/factory'
import { err } from '../utils/response.js'
import type { Role, Variables } from '../types/index.js'

export const requireRole = (...roles: Role[]) =>
  createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json(err('Unauthorized'), 401)
    }

    if (!roles.includes(user.role)) {
      return c.json(
        err(`Access denied. Required role: ${roles.join(' or ')}`),
        403
      )
    }

    await next()
  })
