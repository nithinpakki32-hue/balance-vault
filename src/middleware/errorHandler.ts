import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  console.error(`💥 [ErrorHandler] ${req.method} ${req.url}:`, err);

  // Handle Zod Schema Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed for request data',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[]) || 'field';
      res.status(409).json({
        success: false,
        message: `Conflict: A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists.`,
      });
      return;
    }

    // Record not found
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'The requested resource was not found.',
      });
      return;
    }

    // Database Permission / Role Errors (e.g. SQLSTATE 42501)
    if (err.code === 'P2010' || (err.message && err.message.includes('42501'))) {
      res.status(500).json({
        success: false,
        message: 'Database permission restriction (SQLSTATE 42501). Insufficient role privileges for this operation.',
      });
      return;
    }
  }

  // Generic fallback
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
