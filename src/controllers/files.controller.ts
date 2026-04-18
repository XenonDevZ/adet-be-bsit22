import type { Context } from 'hono'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import * as filesService from '../services/files.service.js'
import * as bookingsService from '../services/bookings.service.js'
import * as teachersService from '../services/teachers.service.js'
import { ok, err } from '../utils/response.js'

const UPLOAD_DIR = './uploads'
const MAX_SIZE   = 10 * 1024 * 1024   // 10 MB
const ALLOWED    = ['application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword', 'image/jpeg', 'image/png']

// POST /bookings/:id/files
export const uploadFile = async (c: Context) => {
  try {
    const jwtUser  = c.get('user')
    const id       = Number(c.req.param('id'))
    if (isNaN(id)) return c.json(err('Invalid booking id'), 400)

    // Verify user is part of this booking
    const booking = await bookingsService.findById(id)
    if (!booking) return c.json(err('Booking not found'), 404)

    let isAllowed = false
    if (jwtUser.role === 'STUDENT') {
      isAllowed = booking.student_id === jwtUser.sub
    } else if (jwtUser.role === 'TEACHER') {
      const tp = await teachersService.findByUserId(jwtUser.sub)
      isAllowed = !!tp && booking.teacher_id === tp.id
    } else if (jwtUser.role === 'ADMIN') {
      isAllowed = true
    }

    if (!isAllowed) return c.json(err('Not authorized to upload to this booking'), 403)

    // Parse multipart form
    const formData = await c.req.formData()
    const file     = formData.get('file') as File | null

    if (!file) return c.json(err('No file provided'), 400)
    if (file.size > MAX_SIZE) return c.json(err('File too large. Max 10MB.'), 400)
    if (!ALLOWED.includes(file.type)) {
      return c.json(err('Invalid file type. Allowed: PDF, DOCX, JPG, PNG'), 400)
    }

    // Save to disk
    await mkdir(UPLOAD_DIR, { recursive: true })
    const ext      = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const filePath = join(UPLOAD_DIR, fileName)

    const buffer = await file.arrayBuffer()
    await writeFile(filePath, Buffer.from(buffer))

    const record = await filesService.create({
      booking_id: id,
      user_id:    jwtUser.sub,
      file_name:  file.name,
      file_path:  filePath,
      file_type:  file.type,
      file_size:  file.size,
    })

    return c.json(ok(record), 201)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    console.error('[uploadFile]', message)
    return c.json(err(message), 500)
  }
}

// GET /bookings/:id/files
export const getFiles = async (c: Context) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json(err('Invalid booking id'), 400)
  const files = await filesService.findByBooking(id)
  return c.json(ok(files, { total: files.length }))
}

// DELETE /bookings/:id/files/:fileId
export const deleteFile = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const fileId  = Number(c.req.param('fileId'))
    if (isNaN(fileId)) return c.json(err('Invalid file id'), 400)

    const file = await filesService.findById(fileId)
    if (!file) return c.json(err('File not found'), 404)

    // Only the uploader or admin can delete
    if (file.user_id !== jwtUser.sub && jwtUser.role !== 'ADMIN') {
      return c.json(err('Not authorized to delete this file'), 403)
    }

    await filesService.remove(fileId, jwtUser.sub)
    return c.json(ok({ message: 'File deleted' }))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Delete failed'
    return c.json(err(message), 400)
  }
}

// GET /bookings/:id/files/:fileId/download
export const downloadFile = async (c: Context) => {
  try {
    const jwtUser = c.get('user')
    const fileId  = Number(c.req.param('fileId'))
    if (isNaN(fileId)) return c.json(err('Invalid file id'), 400)

    const file = await filesService.findById(fileId)
    if (!file) return c.json(err('File not found'), 404)

    const { readFile } = await import('fs/promises')
    const buffer = await readFile(file.file_path)

    return new Response(buffer, {
      headers: {
        'Content-Type':        file.file_type,
        'Content-Disposition': `attachment; filename="${file.file_name}"`,
      }
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Download failed'
    return c.json(err(message), 404)
  }
}
