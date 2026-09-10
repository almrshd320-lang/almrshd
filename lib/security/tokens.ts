import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Access tokens for reservations.
 *
 * The raw token is generated here, handed to the customer once (in the QR code
 * and the confirmation URL), and never stored. Only its SHA-256 goes to the
 * database, so a database dump does not yield working QR codes.
 */

/** 32 random bytes, base64url — 256 bits of entropy. */
export function generateAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Hashes an IP for rate limiting. Salted so the values are not reversible
 * through a rainbow table of the IPv4 space — the raw address never lands in
 * the database.
 */
export function hashIdentifier(value: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt || salt.length < 16) {
    throw new Error(
      'IP_HASH_SALT must be set to at least 16 characters. Generate one with: openssl rand -hex 32',
    );
  }
  return createHash('sha256').update(`${salt}:${value}`, 'utf8').digest('hex');
}

/** Constant-time comparison, for anywhere a secret is compared in Node. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Best-effort client IP behind Vercel's proxy.
 *
 * Only ever used as a rate-limit key, and only after hashing — a spoofed header
 * costs an attacker their own bucket, nothing more.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? '0.0.0.0';
}
