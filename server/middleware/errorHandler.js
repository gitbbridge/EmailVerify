import { ZodError } from 'zod'

export function errorHandler(error, request, response, _next) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      error: {
        code: 'invalid_request',
        message: 'The request contains invalid fields.',
        details: error.issues,
      },
    })
  }

  const status = Number.isInteger(error.status) ? error.status : 500
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${request.method} ${request.originalUrl}]`, error.stack || error.message)
  }
  const body = {
    error: {
      code: error.code || 'internal_error',
      message: status >= 500 ? 'The service is temporarily unavailable.' : error.message,
    },
  }

  if (process.env.NODE_ENV !== 'production' && error.details) {
    body.error.details = error.details
  }

  return response.status(status).json(body)
}
