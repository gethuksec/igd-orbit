import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ClockInDto } from './clock-in.dto';
import { ClockOutDto } from './clock-out.dto';
import { SELFIE_URL_MESSAGE } from './selfie-url';

/**
 * IGDERP-297: the selfie endpoint issues RELATIVE keys
 * (/uploads/attendance-selfies/selfie-...jpg) but the DTOs used @IsUrl()
 * (absolute-URL only) — every mobile clock-in 400'd on its own upload URL.
 * The DTOs must accept the uploader's output shape.
 */
const RELATIVE = '/uploads/attendance-selfies/selfie-u1-1700000000000.jpg';
const ABSOLUTE = 'https://igd.ad8ya.cloud/uploads/attendance-selfies/selfie-u1-1700000000000.jpg';

const baseClockIn = {
  method: 'mobile',
  branch_id: '123e4567-e89b-42d3-a456-426614174000',
  latitude: -8.1845,
  longitude: 113.6687,
};

describe('clock photoUrl (IGDERP-297)', () => {
  it('ClockInDto accepts the relative selfie-upload key', async () => {
    const dto = plainToInstance(ClockInDto, { ...baseClockIn, photoUrl: RELATIVE });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('ClockInDto accepts an absolute URL on the same prefix', async () => {
    const dto = plainToInstance(ClockInDto, { ...baseClockIn, photoUrl: ABSOLUTE });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('ClockInDto rejects a foreign URL with the selfie message', async () => {
    const dto = plainToInstance(ClockInDto, { ...baseClockIn, photoUrl: 'http://x/selfie.jpg' });
    const errors = await validate(dto);
    const photo = errors.find((e) => e.property === 'photoUrl');
    expect(photo).toBeDefined();
    expect(Object.values(photo!.constraints || {}).join(' ')).toContain(SELFIE_URL_MESSAGE);
  });

  it('ClockInDto rejects a non-selfie uploads path', async () => {
    const dto = plainToInstance(ClockInDto, {
      ...baseClockIn,
      photoUrl: '/uploads/other/file.jpg',
    });
    expect((await validate(dto)).some((e) => e.property === 'photoUrl')).toBe(true);
  });

  it('ClockOutDto accepts the relative selfie-upload key', async () => {
    const dto = plainToInstance(ClockOutDto, {
      method: 'mobile',
      latitude: -8.1845,
      longitude: 113.6687,
      photoUrl: RELATIVE,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('photoUrl stays optional (non-mobile back-compat)', async () => {
    const dto = plainToInstance(ClockInDto, {
      method: 'manual',
      branch_id: '123e4567-e89b-42d3-a456-426614174000',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
