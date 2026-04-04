// Standardized API response helpers

export const ok = (data: unknown, meta?: object) => ({
  success: true,
  data,
  ...(meta ? { meta } : {}),
})

export const err = (message: string, code?: string) => ({
  success: false,
  error: message,
  ...(code ? { code } : {}),
})
