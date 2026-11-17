import { isIP } from 'node:net';
import { ALLOWED_EMBED_DOMAINS } from './labRules';

export interface ExternalResourceAssessment {
  valid: boolean;
  url: URL | null;
  provider: string;
  embeddable: boolean;
  error?: string;
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.home.arpa',
  '.test',
  '.example',
  '.invalid',
];

function providerForHost(host: string): string {
  if (YOUTUBE_HOSTS.has(host)) return 'youtube';
  if (host === 'vlab.co.in' || host.endsWith('.vlabs.ac.in')) return 'virtual_labs';
  if (host === 'phet.colorado.edu' || host.endsWith('.phet.colorado.edu')) return 'phet';
  if (host === 'circuitverse.org' || host.endsWith('.circuitverse.org')) return 'circuitverse';
  if (host === 'benchtwin.com' || host.endsWith('.benchtwin.com')) return 'benchtwin';
  return 'custom';
}

/**
 * Validate a resource URL without making a request to the user-supplied host.
 * The server only performs a network request later for the fixed YouTube oEmbed
 * endpoint; arbitrary domains are never fetched, preventing SSRF and redirect
 * based access to internal services.
 */
export function assessExternalResourceUrl(raw: unknown): ExternalResourceAssessment {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { valid: false, url: null, provider: 'invalid', embeddable: false, error: 'URL is required.' };
  }

  const value = raw.trim();
  if (value.length > 2048) {
    return { valid: false, url: null, provider: 'invalid', embeddable: false, error: 'URL is too long.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { valid: false, url: null, provider: 'invalid', embeddable: false, error: 'Malformed URL format.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, url: parsed, provider: 'insecure', embeddable: false, error: 'Only HTTPS links are permitted.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, url: parsed, provider: 'blocked', embeddable: false, error: 'URLs containing embedded credentials are not permitted.' };
  }

  if (parsed.port && parsed.port !== '443') {
    return { valid: false, url: parsed, provider: 'blocked', embeddable: false, error: 'Non-standard URL ports are not permitted.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || isIP(host) !== 0 || !host.includes('.')) {
    return { valid: false, url: parsed, provider: 'blocked', embeddable: false, error: 'IP addresses and local hostnames are not permitted.' };
  }

  if (
    host === 'localhost' ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return { valid: false, url: parsed, provider: 'blocked', embeddable: false, error: 'Private or local network hostnames are not permitted.' };
  }

  const provider = providerForHost(host);
  const embeddable = ALLOWED_EMBED_DOMAINS.some(
    (domain) => host === domain || host.endsWith('.' + domain)
  );

  return { valid: true, url: parsed, provider, embeddable };
}
