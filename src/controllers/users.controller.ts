import type { Context } from 'hono'
import * as usersService from '../services/users.service.js'
import * as teachersService from '../services/teachers.service.js'
import { ok, err } from '../utils/response.js'
import type { Role } from '../types/index.js'

// GET /users  (admin only)
export const listUsers = async (c: Context) => {
  const users = await usersService.findAll()
  return c.json(ok(users, { total: users.length }))
}

// PATCH /users/:id/role  (admin only)
export const changeRole = async (c: Context) => {
  const id   = Number(c.req.param('id'))
  const { role } = await c.req.json() as { role: Role }

  const validRoles: Role[] = ['STUDENT', 'TEACHER', 'ADMIN']
  if (!validRoles.includes(role)) {
    return c.json(err(`role must be one of: ${validRoles.join(', ')}`), 400)
  }

  // Prevent self-demotion
  const caller = c.get('user')
  if (caller.sub === id && role !== 'ADMIN') {
    return c.json(err('Admins cannot demote themselves'), 400)
  }

  await usersService.updateRole(id, role)

  // If promoted to TEACHER, auto-create teacher profile
  if (role === 'TEACHER') {
    await teachersService.createProfile(id)
  }

  const updated = await usersService.findById(id)
  return c.json(ok(updated))
}