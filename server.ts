import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { processAdminInviteRequest } from './src/utils/adminInviteHandler';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LABVERSE SaaS Backend',
    timestamp: new Date().toISOString(),
    supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
    supabaseServiceRoleConfigured: Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
    ),
  });
});

// Real-time Supabase Architecture & Storage Status Check
app.get('/api/admin/supabase-status', async (req, res) => {
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
  try {
    const fs = await import('fs');
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    let combinedSql = '';

    const files = [
      '20261111_init_labverse.sql',
      '20261112_multi_lab_and_tenant_expansion.sql',
      '20261112_security_repair_and_production_auth.sql',
      '20261113_mvit_single_college_simplification.sql',
      '20261114_mvit_production_security_hardening.sql',
      '20261115_pc_lab_and_course_learning_workflow.sql',
      '20261116_pc_lab_rls_integrity_and_psl_dedup.sql',
      '20261117_curated_resource_registry_and_validation.sql',
      '20261118_hide_pc_lab_public_and_restrict_admin_pc_records.sql',
      '20261119_tighten_storage_and_manual_rls.sql',
    ];

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
// SSRF-SAFE EXTERNAL RESOURCE LINK VALIDATOR (YouTube oEmbed + Simulation Headers)
// ==============================================================================
function isPrivateOrBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

app.post('/api/resources/validate-link', async (req, res) => {
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

  if (parsed.protocol !== 'https:') {
    return res.status(400).json({
      url: rawUrl,
      reachable: false,
      status: null,
      embeddable: false,
      provider: 'insecure',
      note: 'Only HTTPS links are permitted for laboratory resources.',
      checkedAt,
    });
  }

  if (isPrivateOrBlockedHostname(parsed.hostname)) {
    return res.status(400).json({
      url: rawUrl,
      reachable: false,
      status: null,
      embeddable: false,
      provider: 'blocked',
      note: 'Private or local network hostnames are not permitted.',
      checkedAt,
    });
  }

  const host = parsed.hostname.toLowerCase();
  const isYtHost =
    host === 'www.youtube.com' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtu.be';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    // 1. YouTube Search Page
    if (isYtHost && parsed.pathname === '/results') {
      const q = parsed.searchParams.get('search_query') || '';
      clearTimeout(timeout);
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
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.toString())}&format=json`;
      const ytRes = await fetch(oembedUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'LABVERSE-MVIT-Verifier/1.0' },
      });
      clearTimeout(timeout);
      if (ytRes.ok) {
        const meta: any = await ytRes.json().catch(() => ({}));
        return res.json({
          url: parsed.toString(),
          reachable: true,
          status: ytRes.status,
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
        status: ytRes.status,
        embeddable: false,
        provider: 'youtube',
        note: `YouTube oEmbed returned HTTP ${ytRes.status}. Video may be private, removed, or invalid.`,
        checkedAt,
      });
    }

    // 3. External Simulation / Documentation URL
    const probeRes = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LABVERSE-MVIT-Verifier/1.0)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });
    clearTimeout(timeout);

    const xfo = (probeRes.headers.get('x-frame-options') || '').toUpperCase();
    const csp = (probeRes.headers.get('content-security-policy') || '').toLowerCase();
    const hasXfoBlock = xfo.includes('DENY') || xfo.includes('SAMEORIGIN');
    const hasCspFrameBlock =
      csp.includes('frame-ancestors') &&
      !csp.includes('frame-ancestors *');
    const embeddable = probeRes.ok && !hasXfoBlock && !hasCspFrameBlock;

    const provider = host.includes('vlabs.ac.in') || host.includes('vlab.co.in')
      ? 'virtual_labs'
      : host.includes('phet.colorado.edu')
      ? 'phet'
      : host.includes('circuitverse.org')
      ? 'circuitverse'
      : host.includes('benchtwin.com')
      ? 'benchtwin'
      : 'custom';

    if (provider === 'benchtwin' && probeRes.status === 403) {
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

    if (!probeRes.ok) {
      return res.json({
        url: parsed.toString(),
        reachable: false,
        status: probeRes.status,
        embeddable: false,
        provider,
        note: `Remote host returned HTTP ${probeRes.status}. Verify the URL in a browser tab.`,
        checkedAt,
      });
    }

    return res.json({
      url: parsed.toString(),
      reachable: true,
      status: probeRes.status,
      embeddable,
      provider,
      note: embeddable
        ? `HTTP ${probeRes.status} OK — supports inline iframe preview and external tab launch.`
        : `HTTP ${probeRes.status} OK — remote headers (${xfo || 'CSP frame-ancestors'}) require external new-tab launch.`,
      checkedAt,
    });
  } catch (err: any) {
    clearTimeout(timeout);
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

startServer();
