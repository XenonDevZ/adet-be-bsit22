import type { Context } from 'hono'
import * as usersService from '../services/users.service.js'
import * as teachersService from '../services/teachers.service.js'
import { ok, err } from '../utils/response.js'
import { UpdateRoleSchema } from '../validators/index.js'


// GET /users  (admin only)
export const listUsers = async (c: Context) => {
  const users = await usersService.findAll()
  return c.json(ok(users, { total: users.length }))
}

// PATCH /users/:id/role  (admin only)
export const changeRole = async (c: Context) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json(err('Invalid user id'), 400)

  const body = await c.req.json()

  // Validate input
  const parsed = UpdateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(err(parsed.error.errors[0].message), 400)
  }

  const { role } = parsed.data

  const caller = c.get('user')

  // Prevent self-demotion
  if (caller.sub === id && role !== 'ADMIN') {
    return c.json(err('Admins cannot demote themselves'), 400)
  }

  if (caller.sub !== id) {
    const target = await usersService.findById(id)
    if (!target) return c.json(err('User not found'), 404)
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

// PATCH /users/:id/department  (admin only)
export const setDepartment = async (c: Context) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json(err('Invalid user id'), 400)

  const body = await c.req.json()
  const department: string = (body.department ?? '').trim()
  if (!department) return c.json(err('Department is required'), 400)

  try {
    let teacher = await teachersService.findByUserId(id)
    if (!teacher) {
      const user = await usersService.findById(id)
      if (user?.role !== 'TEACHER') {
        return c.json(err('User is not a teacher'), 400)
      }
      teacher = await teachersService.createProfile(id, department)
    } else {
      await teachersService.updateProfile(id, { department, bio: teacher.bio })
      teacher = await teachersService.findByUserId(id)
    }

    return c.json(ok(teacher))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to update department'
    return c.json(err(message), 400)
  }
}

