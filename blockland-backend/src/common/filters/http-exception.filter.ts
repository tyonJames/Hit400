import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const status  = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    const message = typeof exceptionResponse === 'object' && exceptionResponse !== null
      ? (exceptionResponse as any).message ?? 'An unexpected error occurred.'
      : exceptionResponse ?? 'An unexpected error occurred.';

    const error = typeof exceptionResponse === 'object' && exceptionResponse !== null
      ? (exceptionResponse as any).error ?? 'Internal Server Error'
      : HttpStatus[status] ?? 'Internal Server Error';

    response.status(status).json({
      success:    false,
      statusCode: status,
      error,
      message,
      timestamp:  new Date().toISOString(),
      path:       request.url,
    });
  }
}
