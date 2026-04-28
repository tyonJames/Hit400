import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map }        from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) return data;
        return { success: true, data, timestamp: new Date().toISOString() };
      }),
    );
  }
}
