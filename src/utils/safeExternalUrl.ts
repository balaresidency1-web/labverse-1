import { isIP } from 'node:net';

const ALLOWED_RESOURCE_HOSTS = [
  'youtube.com',
  'youtu.be',
  'benchtwin.com',
  'phet.colorado.edu',
  'vlab.co.in',
  'vlabs.ac.in',
  'circuitverse.org',
  'labverse.io',
  'mvit.edu.in',
  'scce.ac.in',
  'mits.ac.in',
  'iitr.ac.in',
  'dsource.in',
  'iitb.ac.in',
  'iitg.ac.in',
  'iitk.ac.in',
  'iitm.ac.in',
  'iitd.ac.in',
  'iitkgp.ac.in',
  'iitrpr.ac.in',
  'iitj.ac.in',
  'iitp.ac.in',
  'iitbbs.ac.in',
  'iiit.ac.in',
  'iiitd.ac.in',
  'iiitb.ac.in',
  'iiith.ac.in',
  'xppklywqcffewljoswog.supabase.co',
];

function isInIpv4Range(octets: number[], network: number[], prefix: number): boolean {
  const addressValue = octets.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
  const networkValue = network.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n);
  const shift = 32n - BigInt(prefix);
  return (addressValue >> shift) === (networkValue >> shift);
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const blockedRanges: Array<[number[], number]> = [
    [[0, 0, 0, 0], 8],          // "this" network
    [[10, 0, 0, 0], 8],         // private
    [[100, 64, 0, 0], 10],      // carrier-grade NAT
    [[127, 0, 0, 0], 8],        // loopback
    [[169, 254, 0, 0], 16],     // link-local / metadata
    [[172, 16, 0, 0], 12],      // private
    [[192, 0, 0, 0], 24],       // IETF protocol assignments
    [[192, 0, 2, 0], 24],       // documentation
    [[192, 88, 99, 0], 24],     // deprecated 6to4 relay
    [[192, 168, 0, 0], 16],     // private
    [[198, 18, 0, 0], 15],      // benchmarking
    [[198, 51, 100, 0], 24],    // documentation
    [[203, 0, 113, 0], 24],     // documentation
    [[224, 0, 0, 0], 4],        // multicast
    [[240, 0, 0, 0], 4],        // reserved and limited broadcast
  ];

  return !blockedRanges.some(([network, prefix]) => isInIpv4Range(octets, network, prefix));
}

function parseIpv6(address: string): bigint | null {
  const normalized = address.split('%')[0].toLowerCase();
  if (!normalized || normalized.includes('.')) return null;

  const pieces = normalized.split('::');
  if (pieces.length > 2) return null;

  const left = pieces[0] ? pieces[0].split(':') : [];
  const right = pieces.length === 2 && pieces[1] ? pieces[1].split(':') : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;

  const missing = 8 - left.length - right.length;
  if (pieces.length === 1 && missing !== 0) return null;
  if (pieces.length === 2 && missing < 1) return null;

  const groups = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  if (groups.length !== 8) return null;

  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function hasIpv6Prefix(value: bigint, prefix: bigint, bits: bigint): boolean {
  const shift = 128n - bits;
  return (value >> shift) === (prefix >> shift);
}

function isPublicIpv6(address: string): boolean {
  const value = parseIpv6(address);
  if (value === null) return false;

  // Permit only global-unicast 2000::/3. Reject IANA special-purpose,
  // transition, and documentation ranges before allowing server-side requests.
  if ((value >> 125n) !== 1n) return false;
  if (hasIpv6Prefix(value, 0x20010000000000000000000000000000n, 23n)) return false; // 2001::/23 special-purpose
  if (hasIpv6Prefix(value, 0x20020000000000000000000000000000n, 16n)) return false; // 6to4
  if (hasIpv6Prefix(value, 0x3fff0000000000000000000000000000n, 20n)) return false; // 3fff::/20 documentation

  return true;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export function isAllowedExternalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host || isIP(host) !== 0 || host.includes(':')) return false;

  return ALLOWED_RESOURCE_HOSTS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

export function validateExternalHttpsUrl(value: string): {
  ok: boolean;
  url: URL | null;
  reason?: string;
} {
  try {
    const url = new URL(value);

    if (url.protocol !== 'https:') {
      return { ok: false, url: null, reason: 'Only HTTPS links are allowed for server-side resource validation.' };
    }
    if (url.username || url.password) {
      return { ok: false, url: null, reason: 'URLs containing embedded credentials are not allowed.' };
    }
    if (url.port && url.port !== '443') {
      return { ok: false, url: null, reason: 'Only the standard HTTPS port is allowed.' };
    }
    if (!isAllowedExternalHostname(url.hostname)) {
      return { ok: false, url: null, reason: 'This host is not on LABVERSE’s approved resource-validation list. Add it as an external link and open it in a new tab.' };
    }

    url.hash = '';
    return { ok: true, url };
  } catch {
    return { ok: false, url: null, reason: 'Invalid URL format.' };
  }
}
