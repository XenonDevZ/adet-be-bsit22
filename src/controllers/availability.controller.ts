import type { Context } from 'hono'
import * as availabilityService from '../services/availability.service.js'
import * as teachersService from '../services/teachers.service.js'
import { ok, err } from '../utils/response.js'
import type { DayOfWeek } from '../types/index.js'

// POST /availability
export const createSlot = async (c: Context) => {
  try {
    const jwtUser = c.get('user')

    // Resolve the teacher profile for the logged-in user
    const teacherProfile = await teachersService.findByUserId(jwtUser.sub)
    if (!teacherProfile) {
      return c.json(err('Teacher profile not found. Contact an admin.'), 403)
    }

    const { day_of_week, start_time, end_time } = await c.req.json() as {
      day_of_week: DayOfWeek
      start_time: string
      end_time: string
    }

    const validDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    if (!validDays.includes(day_of_week)) {
      return c.json(err(`day_of_week must be one of: ${validDays.join(', ')}`), 400)
    }

    if (!start_time || !end_time) {
      return c.json(err('start_time and end_time are required (HH:MM format)'), 400)
    }

    if (start_time >= end_time) {
      return c.json(err('end_time must be after start_time'), 400)
    }

    const slot = await availabilityService.create({
      teacher_id: teacherProfile.id,
      day_of_week,
      start_time,
      end_time,
    })

    return c.json(ok(slot), 201)
  } catch (e: any) {
    console.error('[createSlot]', e.message)
    return c.json(err(e.message), 500)
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
  } catch (e: any) {
    return c.json(err(e.message), 400)
  }
}