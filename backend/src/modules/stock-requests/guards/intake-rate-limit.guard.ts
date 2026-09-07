import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

/**
 * Tiny in-memory rate limiter for the public intake surface.
 * No new dependency: single-backend deployments only. Keyed per IP + outlet token.
 */
@Injectable()
export class IntakeRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit = 120,
    private readonly windowMs = 60_000,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = `${req.ip || 'unknown'}:${req.params?.token || ''}`;
    const now = Date.now();
    const recent = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      throw new HttpException(
        'Terlalu banyak permintaan, coba lagi beberapa saat.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
