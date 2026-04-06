import type { Context } from 'hono'
import * as usersService from '../services/users.service.js'
import { ok, err } from '../utils/response.js'
import { UpdateProfileSchema } from '../validators/index.js'

// GET /profile
export const getProfile = async (c: Context) => {
  const jwtUser = c.get('user')
  const user    = await usersService.findById(jwtUser.sub)
  if (!user) return c.json(err('User not found'), 404)
  return c.json(ok(user))
}

// PATCH /profile
export const updateProfile = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const body    = await c.req.json()

    const parsed = UpdateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    const updated = await usersService.updateProfile(jwtUser.sub, parsed.data)
    return c.json(ok(updated))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update profile'
    return c.json(err(message), 400)
  }
}
