import type { Context } from 'hono'
import * as availabilityService from '../services/availability.service.js'
import * as teachersService from '../services/teachers.service.js'
import { ok, err } from '../utils/response.js'
import { CreateAvailabilitySchema } from '../validators/index.js'

// POST /availability
export const createSlot = async (c: Context) => {
  try {
    const jwtUser = c.get('user')

    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) {
      return c.json(err('Teacher profile not found. Contact an admin.'), 403)
    }

    const body = await c.req.json()

    // Validate input
    const parsed = CreateAvailabilitySchema.safeParse(body)
    if (!parsed.success) {
      return c.json(err(parsed.error.errors[0].message), 400)
    }

    const slot = await availabilityService.create({
      teacher_id:  teacherProfile.id,
      ...parsed.data,
    })

    return c.json(ok(slot), 201)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create slot'
    console.error('[createSlot]', message)
    return c.json(err(message), 500)
  }
}

// GET /availability/:teacherId
export const getSlots = async (c: Context) => {
  const teacherId = Number(c.req.param('teacherId'))
  if (isNaN(teacherId)) return c.json(err('Invalid teacher id'), 400)

  const slots = await availabilityService.findByTeacher(teacherId)
  return c.json(ok(slots, { total: slots.length }))
}

// DELETE /availability/:id
export const deleteSlot = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const id = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid slot id'), 400)

    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) return c.json(err('Teacher profile not found'), 403)

    await availabilityService.deactivate(id, teacherProfile.id)
    return c.json(ok({ message: 'Slot deactivated' }))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to deactivate slot'
    return c.json(err(message), 400)
  }
}
