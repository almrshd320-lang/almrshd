import 'server-only';

/**
 * Cloudflare Turnstile verification.
 *
 * Disabled until both keys are configured, so the platform is fully usable
 * before Al-Murshid picks a bot-protection provider — and switching to another
 * provider means changing this one file.
 */

export function isCaptchaEnabled(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
}

export async function verifyCaptcha(
  token: string | undefined,
  remoteIp?: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isCaptchaEnabled()) return { ok: true };
  if (!token) return { ok: false, reason: 'missing-token' };

  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
    });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body, signal: AbortSignal.timeout(5000) },
    );

    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (json.success) return { ok: true };
    return { ok: false, reason: json['error-codes']?.join(',') ?? 'rejected' };
  } catch (err) {
    // A Turnstile outage should not take reservations down with it. The rate
    // limiter and the server-side validation are still in force.
    console.error('[captcha] verification failed, allowing request', err);
    return { ok: true };
  }
}
