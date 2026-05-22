// Disposable-email check via Disify (no auth, free tier) with a tiny
// built-in domain denylist as a backstop for when the API is unreachable.
//
// Fail-open by design: a legitimate applicant should never be blocked
// because we couldn't reach the API. We only refuse signups when we are
// actively confident the address is disposable.

const DISIFY_URL = 'https://www.disify.com/api/email';

// Curated short list of well-known burner domains. Keeps the offline
// check honest without dragging in a thousand-domain wordlist.
const KNOWN_DISPOSABLE_DOMAINS = new Set<string>([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  '10minutemail.com',
  '10minutemail.net',
  'yopmail.com',
  'trashmail.com',
  'fakeinbox.com',
  'maildrop.cc',
  'getnada.com',
  'dispostable.com',
  'mintemail.com',
  'throwawaymail.com',
]);

export interface EmailValidationResult {
  valid_format: boolean;
  disposable: boolean;
  source: 'denylist' | 'disify' | 'fail_open';
}

export const domainOf = (email: string): string => {
  const at = email.lastIndexOf('@');
  if (at < 0) return '';
  return email.slice(at + 1).toLowerCase().trim();
};

export const isFormatValid = (email: string): boolean =>
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);

interface DisifyBody {
  format?: boolean;
  disposable?: boolean;
}

export const parseDisifyResponse = (body: unknown): { disposable: boolean; valid_format: boolean } | null => {
  if (!body || typeof body !== 'object') return null;
  const b = body as DisifyBody;
  if (typeof b.format !== 'boolean' || typeof b.disposable !== 'boolean') return null;
  return { disposable: b.disposable, valid_format: b.format };
};

export const validateEmail = async (email: string): Promise<EmailValidationResult> => {
  const valid_format = isFormatValid(email);
  if (!valid_format) {
    return { valid_format: false, disposable: false, source: 'denylist' };
  }

  // Cheap local check first.
  if (KNOWN_DISPOSABLE_DOMAINS.has(domainOf(email))) {
    return { valid_format: true, disposable: true, source: 'denylist' };
  }

  // Network check. Fail-open on any error or non-2xx.
  try {
    const resp = await fetch(`${DISIFY_URL}/${encodeURIComponent(email)}`, {
      signal: AbortSignal.timeout(2_500),
    });
    if (!resp.ok) {
      return { valid_format: true, disposable: false, source: 'fail_open' };
    }
    const parsed = parseDisifyResponse(await resp.json());
    if (!parsed) {
      return { valid_format: true, disposable: false, source: 'fail_open' };
    }
    return {
      valid_format: parsed.valid_format,
      disposable: parsed.disposable,
      source: 'disify',
    };
  } catch (err) {
    console.error('[email-validation] failed', err);
    return { valid_format: true, disposable: false, source: 'fail_open' };
  }
};
