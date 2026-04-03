import type { Context } from 'hono'
import * as teachersService from '../services/teachers.service.js'
import { ok, err } from '../utils/response.js'

// GET /teachers
export const listTeachers = async (c: Context) => {
  const teachers = await teachersService.findAll()
  return c.json(ok(teachers, { total: teachers.length }))
}

// GET /teachers/:id
export const getTeacher = async (c: Context) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json(err('Invalid teacher id'), 400)

  const teacher = await teachersService.findById(id)
  if (!teacher) return c.json(err('Teacher not found'), 404)

  return c.json(ok(teacher))
}