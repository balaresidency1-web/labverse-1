import QRCode from 'qrcode';
import { InventoryItem } from '../types';

export interface QrPayloadData {
  app: 'LABVERSE';
  version: '2.0';
  inventoryId: string;
  itemId?: string;
  itemCode: string;
  institutionId: string;
  labId?: string;
  name?: string;
}

export interface ParsedQrResult {
  valid: boolean;
  version?: string;
  inventoryId?: string;
  itemId?: string;
  itemCode?: string;
  institutionId?: string;
  labId?: string;
  raw: string;
}

export interface QrAccessValidationResult {
  allowed: boolean;
  readOnly?: boolean;
  error?: string;
  reason?: string;
}

/**
 * Standardizes QR payload for LABVERSE – MVIT inventory items (Version 2.0).
 */
export function formatInventoryQrPayload(item: InventoryItem): string {
  const payload: QrPayloadData = {
    app: 'LABVERSE',
    version: '2.0',
    inventoryId: item.id,
    itemId: item.id,
    itemCode: item.item_code.trim().toUpperCase(),
    institutionId: item.institution_id,
    labId: item.lab_id || undefined,
    name: item.name,
  };
  return JSON.stringify(payload);
}

/**
 * Parses any decoded QR string or barcode text into inventory identifiers.
 */
export function parseInventoryQrPayload(decodedText: string): ParsedQrResult {
  const trimmed = (decodedText || '').trim();
  if (!trimmed) {
    return { valid: false, raw: decodedText };
  }

  // 1. JSON Payload (v2.0 and earlier JSON schemas)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      const version = parsed.version ? String(parsed.version) : undefined;
      const inventoryId = parsed.inventoryId || parsed.itemId || parsed.id;
      const itemCode = parsed.itemCode || parsed.item_code || parsed.code;
      const institutionId = parsed.institutionId || parsed.institution_id;
      const labId = parsed.labId || parsed.lab_id;

      if (inventoryId || itemCode) {
        return {
          valid: true,
          version,
          inventoryId: inventoryId ? String(inventoryId).trim() : undefined,
          itemId: inventoryId ? String(inventoryId).trim() : undefined,
          itemCode: itemCode ? String(itemCode).trim().toUpperCase() : undefined,
          institutionId: institutionId ? String(institutionId).trim() : undefined,
          labId: labId ? String(labId).trim() : undefined,
          raw: decodedText,
        };
      }
    } catch {
      // not JSON, continue
    }
  }

  // 2. Delimited v2 URI: LABVERSE:INV:v2:itemId:instId:labId:itemCode
  if (trimmed.startsWith('LABVERSE:INV:v2:')) {
    const parts = trimmed.replace('LABVERSE:INV:v2:', '').split(':');
    return {
      valid: true,
      version: '2.0',
      inventoryId: parts[0] || undefined,
      itemId: parts[0] || undefined,
      institutionId: parts[1] || undefined,
      labId: parts[2] || undefined,
      itemCode: parts[3] ? parts[3].toUpperCase() : undefined,
      raw: decodedText,
    };
  }

  // 3. Standard LABVERSE:INV:<CODE>
  if (trimmed.startsWith('LABVERSE:INV:')) {
    const code = trimmed.replace('LABVERSE:INV:', '').trim().toUpperCase();
    return {
      valid: true,
      itemCode: code,
      raw: decodedText,
    };
  }

  // 4. Legacy LABVERSE-EQUIP:<CODE>:<NAME>
  if (trimmed.startsWith('LABVERSE-EQUIP:')) {
    const parts = trimmed.split(':');
    if (parts.length >= 2 && parts[1]) {
      return {
        valid: true,
        itemCode: parts[1].trim().toUpperCase(),
        raw: decodedText,
      };
    }
  }

  // 5. URL containing /inventory/<identifier> or ?qr=<identifier>
  const urlMatch = trimmed.match(/(?:\/inventory\/|[?&]qr=)([A-Za-z0-9_-]+)/i);
  if (urlMatch && urlMatch[1]) {
    const identifier = urlMatch[1].trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    return {
      valid: true,
      inventoryId: isUuid ? identifier : undefined,
      itemCode: !isUuid ? identifier.toUpperCase() : undefined,
      raw: decodedText,
    };
  }

  // 6. Bare UUID (36 chars with hyphens)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return {
      valid: true,
      inventoryId: trimmed,
      itemId: trimmed,
      raw: decodedText,
    };
  }

  // 7. Bare alphanumeric item code
  if (/^[A-Za-z0-9_-]{3,30}$/.test(trimmed)) {
    return {
      valid: true,
      itemCode: trimmed.toUpperCase(),
      raw: decodedText,
    };
  }

  return { valid: false, raw: decodedText };
}

/**
 * Validates QR scan access for Public (read-only MVIT item inspection)
 * and authenticated staff (College Admin or assigned Lab Assistant).
 */
export function validateQrScanAccess(
  parsed: ParsedQrResult,
  user: {
    role: string;
    institution_id: string;
    assigned_lab_ids?: string[];
  } | null,
  item?: ({ institution_id?: string; lab_id?: string } & Record<string, any>) | null,
  expectedInstitutionId?: string
): QrAccessValidationResult {
  const targetInstId = item?.institution_id || parsed.institutionId;
  const targetLabId = item?.lab_id || parsed.labId;
  const allowedPublicInstitutionId = expectedInstitutionId || 'inst-mvit';

  // Public unauthenticated view: read-only access for MVIT items
  if (!user) {
    if (targetInstId && targetInstId !== allowedPublicInstitutionId) {
      const errorMsg = 'This QR code does not belong to Manakula Vinayagar Institute of Technology.';
      return { allowed: false, readOnly: true, error: errorMsg, reason: errorMsg };
    }
    return { allowed: true, readOnly: true };
  }

  // Institution Isolation Check (MVIT only)
  if (
    (targetInstId && targetInstId !== user.institution_id) ||
    (expectedInstitutionId && user.institution_id !== expectedInstitutionId)
  ) {
    const errorMsg = 'Access Denied: This apparatus does not belong to MVIT.';
    return {
      allowed: false,
      error: errorMsg,
      reason: errorMsg,
    };
  }

  // College Admin can inspect all MVIT labs
  if (user.role === 'college_admin') {
    return { allowed: true, readOnly: false };
  }

  // Lab Assistant is strictly scoped to their assigned labs
  if (user.role === 'lab_assistant') {
    if (!targetLabId) {
      const errorMsg = 'Laboratory Access Denied: Apparatus has no assigned laboratory.';
      return {
        allowed: false,
        error: errorMsg,
        reason: errorMsg,
      };
    }
    const assigned = user.assigned_lab_ids || [];
    if (!assigned.includes(targetLabId)) {
      const errorMsg = 'Laboratory Access Denied: You are not assigned to this laboratory.';
      return {
        allowed: false,
        error: errorMsg,
        reason: errorMsg,
      };
    }
  }

  return { allowed: true, readOnly: false };
}

export interface PcQrPayloadData {
  app: 'LABVERSE';
  assetType: 'pc_computer';
  version: '2.0';
  computerId: string;
  computerCode: string;
  hostname?: string;
  institutionId: string;
  labId: string;
}

export interface ParsedPcQrResult {
  valid: boolean;
  computerId?: string;
  computerCode?: string;
  institutionId?: string;
  labId?: string;
  raw: string;
}

export function formatPcComputerQrPayload(pc: {
  id: string;
  computer_code: string;
  hostname?: string;
  institution_id: string;
  lab_id: string;
}): string {
  const payload: PcQrPayloadData = {
    app: 'LABVERSE',
    assetType: 'pc_computer',
    version: '2.0',
    computerId: pc.id,
    computerCode: pc.computer_code.trim().toUpperCase(),
    hostname: pc.hostname || undefined,
    institutionId: pc.institution_id,
    labId: pc.lab_id,
  };
  return JSON.stringify(payload);
}

export function parsePcComputerQrPayload(decodedText: string): ParsedPcQrResult {
  const trimmed = (decodedText || '').trim();
  if (!trimmed) return { valid: false, raw: decodedText };

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.assetType === 'pc_computer' || parsed.computerId || parsed.computerCode) {
        return {
          valid: true,
          computerId: parsed.computerId ? String(parsed.computerId).trim() : undefined,
          computerCode: parsed.computerCode ? String(parsed.computerCode).trim().toUpperCase() : undefined,
          institutionId: parsed.institutionId ? String(parsed.institutionId).trim() : undefined,
          labId: parsed.labId ? String(parsed.labId).trim() : undefined,
          raw: decodedText,
        };
      }
    } catch {
      // ignore
    }
  }

  if (trimmed.startsWith('LABVERSE:PC:')) {
    const code = trimmed.replace('LABVERSE:PC:', '').trim().toUpperCase();
    if (code) {
      return { valid: true, computerCode: code, raw: decodedText };
    }
  }

  if (/^[A-Za-z0-9_-]{3,40}$/.test(trimmed)) {
    return { valid: true, computerCode: trimmed.toUpperCase(), raw: decodedText };
  }

  return { valid: false, raw: decodedText };
}

/**
 * Strictly blocks public users and College Admin from inspecting internal PC Lab computer QR records.
 * Only the assigned PC Lab Assistant may scan and inspect PC workstation QR payloads.
 */
export function validatePcQrScanAccess(
  parsed: ParsedPcQrResult,
  user: {
    role: string;
    institution_id: string;
    assigned_lab_ids?: string[];
  } | null,
  computer?: { institution_id?: string; lab_id?: string } | null
): QrAccessValidationResult {
  if (!user) {
    const err = 'Internal MVIT PC Laboratory records are restricted to the assigned PC Lab Assistant.';
    return { allowed: false, readOnly: true, error: err, reason: err };
  }
  if (user.role === 'college_admin') {
    const err = 'Access Denied: Individual PC workstation details and QR records are restricted to the assigned PC Lab Assistant.';
    return { allowed: false, error: err, reason: err };
  }
  const targetInst = computer?.institution_id || parsed.institutionId;
  const targetLab = computer?.lab_id || parsed.labId;
  if (targetInst && targetInst !== user.institution_id) {
    const err = 'Access Denied: Workstation does not belong to MVIT.';
    return { allowed: false, error: err, reason: err };
  }
  if (user.role === 'lab_assistant') {
    if (!targetLab || !(user.assigned_lab_ids || []).includes(targetLab)) {
      const err = 'Access Denied: You are not assigned to this PC Laboratory.';
      return { allowed: false, error: err, reason: err };
    }
    return { allowed: true, readOnly: false };
  }
  return { allowed: false, error: 'Unauthorized role.' };
}

/**
 * Generates a high-resolution PNG Data URL for a given string
 */
export async function generateQrDataUrl(
  text: string,
  options?: {
    size?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    darkColor?: string;
    lightColor?: string;
  }
): Promise<string> {
  const size = options?.size || 300;
  const margin = options?.margin !== undefined ? options.margin : 2;
  const errorCorrectionLevel = options?.errorCorrectionLevel || 'M';
  const dark = options?.darkColor || '#252521';
  const light = options?.lightColor || '#FFFFFF';

  return QRCode.toDataURL(text, {
    width: size,
    margin,
    errorCorrectionLevel,
    color: {
      dark,
      light,
    },
  });
}

/**
 * Generates a clean vector SVG string for a given text.
 */
export async function generateQrSvgString(
  text: string,
  options?: {
    size?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }
): Promise<string> {
  const size = options?.size || 300;
  const margin = options?.margin !== undefined ? options.margin : 2;
  const errorCorrectionLevel = options?.errorCorrectionLevel || 'M';

  return QRCode.toString(text, {
    type: 'svg',
    width: size,
    margin,
    errorCorrectionLevel,
    color: {
      dark: '#252521',
      light: '#FFFFFF',
    },
  });
}

/**
 * Triggers a download of a PNG file from a Data URL in the browser.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Triggers a download of an SVG text string as an .svg file in the browser.
 */
export function downloadSvgString(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
