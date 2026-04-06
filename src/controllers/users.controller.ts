import type { Context } from 'hono'
import * as usersService from '../services/users.service.js'
import * as teachersService from '../services/teachers.service.js'
import { ok, err } from '../utils/response.js'
import { UpdateRoleSchema, UpdateSubjectsSchema } from '../validators/index.js'


// GET /users  (admin only)
export const listUsers = async (c: Context) => {
  const users = await usersService.findAll()
  return c.json(ok(users, { total: users.length }))
}

// PATCH /users/:id/role  (admin only)
export const changeRole = async (c: Context) => {
  const id   = Number(c.req.param('id'))
  if (isNaN(id)) return c.json(err('Invalid user id'), 400)

  const body = await c.req.json()

  // Validate input
  const parsed = UpdateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(err(parsed.error.errors[0].message), 400)
  }

  const { role } = parsed.data

  // Prevent self-demotion
  const caller = c.get('user')
  if (caller.sub === id && role !== 'ADMIN') {
    return c.json(err('Admins cannot demote themselves'), 400)
  }

  try {
    await usersService.updateRole(id, role)

    // Auto-create teacher profile on promotion
    if (role === 'TEACHER') {
      await teachersService.createProfile(id)
    }

    const updated = await usersService.findById(id)
    return c.json(ok(updated))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update role'
    return c.json(err(message), 400)
  }
}

// PATCH /users/:id/subjects  (admin only)
export const updateSubjects = async (c: Context) => {
  try {
    const id   = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid user id'), 400)

    const body   = await c.req.json()
    const parsed = UpdateSubjectsSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    await teachersService.updateSubjects(id, parsed.data.subjects)
    return c.json(ok({ message: 'Subjects updated successfully' }))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update subjects'
    return c.json(err(message), 400)
  }
}