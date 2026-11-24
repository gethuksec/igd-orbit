/**
 * IGDERP-297: selfie URL shape issued by POST /attendance/selfie.
 *
 * StorageService.save() returns a RELATIVE public key:
 *   /uploads/attendance-selfies/selfie-<userId>-<ts>.jpg
 * so the clock-in/out DTOs must accept that shape — @IsUrl() requires an
 * absolute URL (protocol + host) and rejected the uploader's own output,
 * making every mobile clock-in 400.
 *
 * Accepts:
 *   - relative: /uploads/attendance-selfies/<file>
 *   - absolute: http(s)://<host>.../uploads/attendance-selfies/<file>
 *     (reverse-proxy / CDN-prefixed deployments)
 * Rejects anything else with the same message the PWA surfaces.
 */
export const SELFIE_URL_MESSAGE =
  'photoUrl must be a valid URL from /attendance/selfie upload';

export const SELFIE_URL_PATTERN =
  /^(https?:\/\/\S+\/uploads\/attendance-selfies\/\S+|\/uploads\/attendance-selfies\/\S+)$/;
