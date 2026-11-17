import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';
const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

// Verify if live Supabase credentials are provided
export const isSupabaseConfigured = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    !supabaseUrl.includes('your-project-ref') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0 &&
    !supabaseAnonKey.includes('your-anon-public-key')
  );
};

// Singleton client instance
let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
};

/**
 * Retrieves the current Supabase Auth Session
 */
export const getSupabaseSession = async (): Promise<Session | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session;
  } catch {
    return null;
  }
};

/**
 * Retrieves the current Supabase Auth User
 */
export const getSupabaseUser = async (): Promise<User | null> => {
  const session = await getSupabaseSession();
  return session?.user || null;
};

/**
 * Creates a signed URL for college-restricted materials (private storage access)
 */
export const createSignedFileUrl = async (
  bucket: 'manuals' | 'diagrams',
  filePath: string,
  expiresInSeconds: number = 3600
): Promise<{ url: string | null; error?: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { url: null, error: 'Supabase storage is not configured' };
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      return { url: null, error: error.message };
    }

    return { url: data.signedUrl };
  } catch (err: any) {
    return { url: null, error: err.message || 'Failed to create signed storage URL' };
  }
};

/**
 * Downloads a file Blob directly from Supabase Storage (honoring RLS for current session/anon).
 */
export const downloadStorageBlob = async (
  bucket: 'manuals' | 'diagrams',
  filePath: string
): Promise<{ blob: Blob | null; error?: string; status?: number }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { blob: null, error: 'Supabase storage is not configured' };
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error || !data) {
      const msg = error?.message || 'Unable to download storage object';
      const status = /403|unauthorized|denied|policy|rls/i.test(msg)
        ? 403
        : /404|not found/i.test(msg)
          ? 404
          : undefined;
      return { blob: null, error: msg, status };
    }
    return { blob: data };
  } catch (err: any) {
    return { blob: null, error: err?.message || 'Storage download failed' };
  }
};

/**
 * Uploads a laboratory document / PDF to Supabase Storage.
 * Both 'manuals' and 'diagrams' buckets are private and protected by RLS.
 * Returns a short-lived signed URL and the persistent storage path.
 */
export const uploadFileToStorage = async (
  bucket: 'manuals' | 'diagrams',
  filePath: string,
  file: File | Blob,
  _options?: { isPublic?: boolean }
): Promise<{
  url: string | null;
  error?: string;
  isCloudStorage: boolean;
  path?: string;
}> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      url: null,
      error: 'Supabase storage is not configured. Saving in browser local storage.',
      isCloudStorage: false,
    };
  }

  try {
    const contentType =
      file instanceof File && file.type ? file.type : file.type || 'application/pdf';
    const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
      upsert: true,
      contentType,
    });

    if (error) {
      return { url: null, error: error.message, isCloudStorage: false };
    }

    const signedRes = await createSignedFileUrl(bucket, data.path, 3600);
    return {
      url: signedRes.url,
      error: signedRes.url ? undefined : (signedRes.error || 'Unable to create a private signed URL.'),
      isCloudStorage: true,
      path: data.path,
    };
  } catch (err: any) {
    return {
      url: null,
      error: err.message || 'Supabase storage upload failed',
      isCloudStorage: false,
    };
  }
};

/**
 * Deletes a file from Supabase Storage
 */
export const deleteFileFromStorage = async (
  bucket: 'manuals' | 'diagrams',
  filePath: string
): Promise<{ success: boolean; error?: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
