import { NextResponse } from 'next/server'
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
} from './auth'
import { ZodError } from 'zod'

export type ApiSuccess<T> = {
  data: T
}

export type ApiError = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ data } satisfies ApiSuccess<T>, { status })
}

export function created<T>(data: T) {
  return success(data, 201)
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    } satisfies ApiError,
    { status }
  )
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return errorResponse(
      'VALIDATION_ERROR',
      'Verifique os dados enviados.',
      400,
      error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }))
    )
  }

  if (error instanceof ValidationError) {
    return errorResponse('VALIDATION_ERROR', error.message, 400, error.details)
  }

  if (error instanceof AuthError) {
    return errorResponse('UNAUTHORIZED', error.message, 401)
  }

  if (error instanceof ForbiddenError) {
    return errorResponse('FORBIDDEN', error.message, 403)
  }

  if (error instanceof NotFoundError) {
    return errorResponse('NOT_FOUND', error.message, 404)
  }

  if (error instanceof ConflictError) {
    return errorResponse('CONFLICT', error.message, 409)
  }

  console.error('[API Error]', error)
  return errorResponse(
    'INTERNAL_ERROR',
    'Ocorreu um erro interno. Tente novamente mais tarde.',
    500
  )
}
