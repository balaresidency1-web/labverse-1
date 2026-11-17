import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { processAdminInviteRequest } from './src/utils/adminInviteHandler.ts';
import { lookup as dnsLookup } from 'node:dns/promises';
import https from 'node:https';
import type { IncomingHttpHeaders } from 'node:http';
import { isPublicIpAddress, validateExternalHttpsUrl } from './src/utils/safeExternalUrl.ts';
import { createFixedWindowRateLimiter } from './src/utils/fixedWindowRateLimiter.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Server-side Supabase client helpers
const getSupabaseAdmin = (): SupabaseClient | null => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!supabaseUrl || !serviceKey || supabaseUrl.includes('your-project-ref')) {
    return null;
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getSupabaseAnon = (): SupabaseClient | null => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey || supabaseUrl.includes('your-project-ref')) {
    return null;
  }
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

async function requireActiveCollegeAdmin(
  req: express.Request,
  res: express.Response
): Promise<boolean> {
  const adminClient = getSupabaseAdmin();
  if (!adminClient) {
    res.status(503).json({ error: 'Admin-only endpoint is unavailable until the server-side Supabase secret is configured.' });
    return false;
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'A valid staff sign-in is required.' });
    return false;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const { data: userData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !userData?.user) {
    res.status(401).json({ error: 'The staff session is invalid or expired.' });
    return false;
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role,status,institution_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'college_admin' || profile.status !== 'active') {
    res.status(403).json({ error: 'An active MVIT College Admin account is required.' });
    return false;
  }

  const { data: institution, error: institutionError } = await adminClient
    .from('institutions')
    .select('code,active,status')
    .eq('id', profile.institution_id)
    .maybeSingle();

  if (
    institutionError ||
    !institution ||
    String(institution.code || '').toUpperCase() !== 'MVIT' ||
    institution.active !== true ||
    (institution.status && institution.status !== 'active')
  ) {
    res.status(403).json({ error: 'The account is not attached to an active MVIT institution.' });
    return false;
  }

  return true;
}

async function requireActiveMvitStaff(
  req: express.Request,
  res: express.Response
): Promise<string | null> {
  const anonClient = getSupabaseAnon();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!anonClient || !supabaseUrl || !anonKey) {
    res.status(503).json({ error: 'Staff resource validation is unavailable until Supabase Auth is configured.' });
    return null;
  }

  const authHeader = req.headers.authorization || '';
  const bearerMatch = authHeader.match(/^Bearer\\s+(.+)$/i);
  if (!bearerMatch) {
    res.status(401).json({ error: 'Sign in with an active MVIT staff account to validate external resources.' });
    return null;
  }

  const token = bearerMatch[1].trim();
  const { data: userData, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !userData?.user) {
    res.status(401).json({ error: 'The staff session is invalid or expired.' });
    return null;
  }

  // Query the profile using the caller's JWT so RLS remains in force; never use
  // the service-role client for this read-only authorization check.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await userClient
    .from('profiles')
    .select('role,status,institution_id')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.status !== 'active' ||
    !['college_admin', 'lab_assistant'].includes(profile.role)
  ) {
    res.status(403).json({ error: 'Only active MVIT College Admins and Lab Assistants may validate learning resources.' });
    return null;
  }

  const { data: institution, error: institutionError } = await userClient
    .from('institutions')
    .select('code,active,status')
    .eq('id', profile.institution_id)
    .maybeSingle();

  if (
    institutionError ||
    !institution ||
    String(institution.code || '').toUpperCase() !== 'MVIT' ||
    institution.active !== true ||
    (institution.status && institution.status !== 'active')
  ) {
    res.status(403).json({ error: 'The staff account is not attached to the active MVIT institution.' });
    return null;
  }

  return userData.user.id;
}

const resourceValidationRateLimit = createFixedWindowRateLimiter({
  limit: 30,
  windowMs: 60_000,
  maxKeys: 5_000,
});

async function requestPinnedHttps(targetUrl: URL): Promise<{
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
}> {
  const addresses = await dnsLookup(targetUrl.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new Error('The external host did not resolve exclusively to public IP addresses.');
  }

  // Pin the connection to a validated public address and never auto-follow redirects.
  const selectedAddress = addresses[0];
  const pinnedLookup = ((_hostname: string, options: any, callback: any) => {
    if (options?.all) callback(null, [selectedAddress]);
    else callback(null, selectedAddress.address, selectedAddress.family);
  }) as any;
  const agent = new https.Agent({ keepAlive: false, lookup: pinnedLookup });

  try {
    return await new Promise((resolve, reject) => {
      const request = https.request(
        targetUrl,
        {
          method: 'GET',
          agent,
          timeout: 5500,
          headers: {
            'User-Agent': 'LABVERSE-Resource-Validator/1.0',
            Accept: 'text/html,application/xhtml+xml,application/json,*/*',
            Range: 'bytes=0-65535',
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          let receivedBytes = 0;
          response.on('data', (chunk: Buffer) => {
            receivedBytes += chunk.length;
            if (receivedBytes > 64 * 1024) {
              request.destroy(new Error('External resource response exceeded the 64 KB validation limit.'));
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () => resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }));
          response.on('error', reject);
        }
      );

      request.on('timeout', () => request.destroy(new Error('External resource validation timed out.')));
      request.on('error', reject);
      request.end();
    });
  } finally {
    agent.destroy();
  }
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LABVERSE SaaS Backend',
    timestamp: new Date().toISOString(),
    supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
  });
});

// Real-time Supabase Architecture & Storage Status Check
app.get('/api/admin/supabase-status', async (req, res) => {
  if (!(await requireActiveCollegeAdmin(req, res))) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabaseSecretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

  let storageBuckets: string[] = [];
  let storageError: string | null = null;
  const hasServiceRole = Boolean(supabaseSecretKey);

  const adminClient = getSupabaseAdmin();
  if (adminClient) {
    try {
      const { data, error } = await adminClient.storage.listBuckets();
      if (error) {
        storageError = error.message;
      } else if (data) {
        storageBuckets = data.map((b) => b.name);
      }
    } catch (e: any) {
      storageError = e.message;
    }
  }

  res.json({
    supabaseUrl: supabaseUrl ? supabaseUrl.replace(/:[^@]+@/, ':***@') : null,
    hasAnonKey: Boolean(supabaseAnonKey),
    hasServiceRole,
    storageBuckets,
    storageError,
    timestamp: new Date().toISOString(),
  });
});

// Provide Full Migration SQL for Admin 1-Click Copy into Supabase SQL Editor
app.get('/api/admin/migration-sql', async (req, res) => {
  if (!(await requireActiveCollegeAdmin(req, res))) return;

  try {
    const fs = await import('fs');
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    let combinedSql = '';

    // Include every chronologically ordered SQL migration so the admin SQL export
    // cannot silently omit newer security or schema migrations.
    const files = fs.readdirSync(migrationsDir)
      .filter((name: string) => /^\d{8}_[a-z0-9_-]+\.sql$/i.test(name))
      .sort((a: string, b: string) => a.localeCompare(b));

    for (const f of files) {
      const filePath = path.join(migrationsDir, f);
      if (fs.existsSync(filePath)) {
        combinedSql += `\n\n-- ==================== MIGRATION: ${f} ====================\n\n`;
        combinedSql += fs.readFileSync(filePath, 'utf-8');
      }
    }

    if (combinedSql.trim()) {
      res.setHeader('Content-Type', 'text/plain');
      return res.send(combinedSql);
    }
    return res.status(404).send('-- Migration files not found');
  } catch (err: any) {
    return res.status(500).send(`-- Error loading migrations: ${err.message}`);
  }
});

// ==============================================================================
// SSRF-HARDENED EXTERNAL RESOURCE LINK VALIDATOR
// ==============================================================================
app.post('/api/resources/validate-link', async (req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const liveSupabaseConfigured = Boolean(
    supabaseUrl &&
    anonKey &&
    !supabaseUrl.includes('your-project-ref') &&
    !anonKey.includes('your-anon-public-key')
  );

  let rateLimitKey = 'local-demo';
  if (liveSupabaseConfigured) {
    const staffUserId = await requireActiveMvitStaff(req, res);
    if (!staffUserId) return;
    rateLimitKey = staffUserId;
  } else if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
    return res.status(503).json({
      error: 'External resource validation is disabled until live Supabase Auth is configured.',
    });
  }

  if (!resourceValidationRateLimit(rateLimitKey)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({
      error: 'Too many resource validation requests. Please wait one minute and try again.',
    });
  }

  const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const checkedAt = new Date().toISOString();

  if (!rawUrl) {
    return res.status(400).json({
      url: rawUrl,
      reachable: false,
      status: null,
      embeddable: false,
      provider: 'invalid',
      note: 'URL is required for validation.',
      checkedAt,
    });
  }

  if (rawUrl.length > 2048) {
    return res.status(400).json({ url: '', reachable: false, status: null, embeddable: false, provider: 'invalid', note: 'URL exceeds the 2048-character limit.', checkedAt });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({
      url: rawUrl,
      reachable: false,
      status: null,
      embeddable: false,
      provider: 'invalid',
      note: 'Malformed URL format.',
      checkedAt,
    });
  }

  const safeUrl = validateExternalHttpsUrl(parsed.toString());
  if (!safeUrl.ok || !safeUrl.url) {
    return res.status(400).json({
      url: rawUrl,
      reachable: false,
      status: null,
      embeddable: false,
      provider: 'blocked',
      note: safeUrl.reason || 'URL is not permitted for server-side validation.',
      checkedAt,
    });
  }
  parsed = safeUrl.url;

  const host = parsed.hostname.toLowerCase();
  const isYtHost =
    host === 'www.youtube.com' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtu.be';


  try {
    // 1. YouTube Search Page
    if (isYtHost && parsed.pathname === '/results') {
      const q = parsed.searchParams.get('search_query') || '';
        return res.json({
        url: parsed.toString(),
        reachable: Boolean(q.trim()),
        status: 200,
        embeddable: false,
        provider: 'youtube_search',
        title: q ? `YouTube Search: ${q}` : 'YouTube Search',
        note: q.trim()
          ? 'Valid YouTube search link. Opens externally in a new browser tab (cannot be iframed).'
          : 'Missing search_query parameter in YouTube search link.',
        checkedAt,
      });
    }

    // 2. Direct YouTube Video -> Official oEmbed verification
    if (isYtHost) {
      const oembedUrl = new URL(`https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.toString())}&format=json`);
      const ytRes = await requestPinnedHttps(oembedUrl);
      if (ytRes.statusCode === 200) {
        let meta: any = {};
        try { meta = JSON.parse(ytRes.body); } catch { meta = {}; }
        return res.json({
          url: parsed.toString(),
          reachable: true,
          status: ytRes.statusCode,
          embeddable: true,
          provider: 'youtube',
          title: meta.title || 'Verified YouTube Video',
          authorName: meta.author_name || undefined,
          note: `Verified via YouTube oEmbed (${meta.title || 'Video reachable'}) — embeddable inside LABVERSE.`,
          checkedAt,
        });
      }
      return res.json({
        url: parsed.toString(),
        reachable: false,
        status: ytRes.statusCode,
        embeddable: false,
        provider: 'youtube',
        note: `YouTube oEmbed returned HTTP ${ytRes.statusCode}. Video may be private, removed, or invalid.`,
        checkedAt,
      });
    }

    // 3. External Simulation / Documentation URL
    const probeRes = await requestPinnedHttps(parsed);
    const xfoHeader = probeRes.headers['x-frame-options'];
    const cspHeader = probeRes.headers['content-security-policy'];
    const xfo = (Array.isArray(xfoHeader) ? xfoHeader.join(',') : xfoHeader || '').toUpperCase();
    const csp = (Array.isArray(cspHeader) ? cspHeader.join(',') : cspHeader || '').toLowerCase();
    const hasXfoBlock = xfo.includes('DENY') || xfo.includes('SAMEORIGIN');
    const hasCspFrameBlock =
      csp.includes('frame-ancestors') &&
      !csp.includes('frame-ancestors *');
    const isRedirect = probeRes.statusCode >= 300 && probeRes.statusCode < 400;
    const isReachable = probeRes.statusCode >= 200 && probeRes.statusCode < 400;
    const embeddable = probeRes.statusCode >= 200 && probeRes.statusCode < 300 && !hasXfoBlock && !hasCspFrameBlock;

    const provider = host.includes('vlabs.ac.in') || host.includes('vlab.co.in')
      ? 'virtual_labs'
      : host.includes('phet.colorado.edu')
      ? 'phet'
      : host.includes('circuitverse.org')
      ? 'circuitverse'
      : host.includes('benchtwin.com')
      ? 'benchtwin'
      : 'custom';

    if (provider === 'benchtwin' && probeRes.statusCode === 403) {
      return res.json({
        url: parsed.toString(),
        reachable: true,
        status: 403,
        embeddable: false,
        provider,
        note: 'BenchTwin blocks automated HTTP probes via Cloudflare (HTTP 403) and sets X-Frame-Options: SAMEORIGIN. Launch externally in a new browser tab.',
        checkedAt,
      });
    }

    if (!isReachable) {
      return res.json({
        url: parsed.toString(),
        reachable: false,
        status: probeRes.statusCode,
        embeddable: false,
        provider,
        note: `Remote host returned HTTP ${probeRes.statusCode}. Verify the URL in a browser tab.`,
        checkedAt,
      });
    }

    return res.json({
      url: parsed.toString(),
      reachable: isReachable,
      status: probeRes.statusCode,
      embeddable,
      provider,
      note: isRedirect
        ? 'The destination redirects. LABVERSE did not follow the redirect for security; open the resource in a new browser tab.'
        : embeddable
          ? `HTTP ${probeRes.statusCode} OK — supports inline iframe preview and external tab launch.`
          : `HTTP ${probeRes.statusCode} — remote headers (${xfo || 'CSP frame-ancestors'}) require external new-tab launch.`,
      checkedAt,
    });
  } catch (err: any) {
    return res.json({
      url: parsed.toString(),
      reachable: false,
      status: null,
      embeddable: false,
      provider: 'external',
      note: err?.name === 'AbortError'
        ? 'Validation request timed out after 5.5s.'
        : `Network probe failed: ${err?.message || 'Unknown error'}`,
      checkedAt,
    });
  }
});

// ==============================================================================
// PROTECTED SERVER-SIDE LAB ASSISTANT INVITATION ENDPOINT (MVIT ONLY)
// Enforces College Admin caller authentication, MVIT institution matching,
// and real Supabase Auth Admin invitations without exposing service-role keys.
// ==============================================================================
app.post('/api/admin/invite-user', async (req, res) => {
  try {
    const adminClient = getSupabaseAdmin();
    const anonClient = getSupabaseAnon();
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
    const supabaseEnvConfigured = Boolean(
      (supabaseUrl && !supabaseUrl.includes('your-project-ref')) || anonKey || serviceKey
    );

    const result = await processAdminInviteRequest({
      authHeader: req.headers.authorization,
      body: req.body,
      deps: {
        adminClient,
        anonClient,
        supabaseEnvConfigured,
        appUrl: process.env.APP_URL || 'http://localhost:3000',
      },
    });

    return res.status(result.statusCode).json(result.body);
  } catch (err: any) {
    console.error('Unhandled invitation dispatch error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error processing invitation.',
    });
  }
});

// Mount Vite middleware in development or serve built static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LABVERSE] SaaS server active on http://0.0.0.0:${PORT}`);
  });
}

// Vercel imports this module from its API Function. Do not start a persistent
// HTTP listener in the serverless runtime; local development keeps the Express server.
if (process.env.VERCEL !== '1') {
  void startServer();
}
