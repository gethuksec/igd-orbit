import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

class FakeRedis {
  strings = new Map<string, string>();
  hashes = new Map<string, Map<string, string>>();

  async hset(key: string, field: string, value: string) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key)!.set(field, value);
    return 1;
  }
  async hexists(key: string, field: string) {
    return this.hashes.get(key)?.has(field) ? 1 : 0;
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hashes.get(key) ?? []);
  }
  async hdel(key: string, ...fields: string[]) {
    let n = 0;
    for (const f of fields) if (this.hashes.get(key)?.delete(f)) n++;
    return n;
  }
  async expire(_key: string, _s: number) {
    return 1;
  }
  async set(key: string, value: string) {
    this.strings.set(key, value);
    return 'OK';
  }
  async get(key: string) {
    return this.strings.get(key) ?? null;
  }
  async keys(pattern: string) {
    const prefix = pattern.replace('*', '');
    const out: string[] = [];
    for (const k of this.hashes.keys()) if (k.startsWith(prefix)) out.push(k);
    for (const k of this.strings.keys()) if (k.startsWith(prefix)) out.push(k);
    return out;
  }
  async del(...keys: string[]) {
    let n = 0;
    for (const k of keys) {
      if (this.hashes.delete(k)) n++;
      if (this.strings.delete(k)) n++;
    }
    return n;
  }
}

function harness(redis?: FakeRedis) {
  const r = redis ?? new FakeRedis();
  const prisma: any = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
        userBranches: [],
      }),
    },
  };
  const jwtService: any = { sign: jest.fn().mockReturnValue('new-access') };
  const configService: any = { get: (k: string) => (k === 'jwt.expiresIn' ? '1h' : undefined) };
  const service = new AuthService(prisma, {} as any, jwtService, configService, r as any);
  return { service, prisma, redis: r };
}

describe('AuthService refresh tokens — multi-device (IGDERP-241/D4)', () => {
  it('two devices stay logged in concurrently (no eviction)', async () => {
    const { service, redis } = harness();
    await redis.hset('refresh_tokens:user-1', 'token-A', '1000');
    await redis.hset('refresh_tokens:user-1', 'token-B', '2000');

    const a = await service.refreshToken('token-A');
    const b = await service.refreshToken('token-B');

    expect(a.accessToken).toBe('new-access');
    expect(b.accessToken).toBe('new-access');
  });

  it('migrates a legacy single-slot token into the hash', async () => {
    const { service, redis } = harness();
    await redis.set('refresh_token:user-1', 'legacy-token');

    const out = await service.refreshToken('legacy-token');

    expect(out.accessToken).toBe('new-access');
    expect(await redis.hexists('refresh_tokens:user-1', 'legacy-token')).toBe(1);
    expect(await redis.get('refresh_token:user-1')).toBeNull();
    // second refresh works from the hash
    await expect(service.refreshToken('legacy-token')).resolves.toMatchObject({ accessToken: 'new-access' });
  });

  it('unknown token is rejected', async () => {
    const { service } = harness();
    await expect(service.refreshToken('nope')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('logout drops hash and legacy key', async () => {
    const { service, redis } = harness();
    await redis.hset('refresh_tokens:user-1', 'token-A', '1000');
    await redis.set('refresh_token:user-1', 'legacy');

    await service.logout('user-1');

    expect(await redis.hgetall('refresh_tokens:user-1')).toEqual({});
    expect(await redis.get('refresh_token:user-1')).toBeNull();
  });
});
