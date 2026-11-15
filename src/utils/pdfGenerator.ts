/**
 * Laboratory Manual PDF Generator and Viewer Utilities
 * Generates valid multi-page PDF 1.4 representations for offline inspection and downloading.
 */

export interface DemoManualPdfParams {
  title: string;
  subjectCode?: string;
  subjectName?: string;
  courseCode?: string;
  academicYearLabel?: string;
  semester?: number;
  expNumber?: number;
  aim?: string;
  theory?: string;
  formulae?: string[];
  componentsRequired?: Array<{ name: string; quantity?: string; spec?: string }>;
  equipmentRequired?: Array<{ name: string; model?: string; spec?: string }>;
  circuitDiagramDescription?: string;
  procedure?: Array<{ step: number; title: string; instruction: string; precaution?: string }>;
  observationHeaders?: Array<{ key: string; header: string; unit?: string }>;
  sampleObservations?: Array<Record<string, string | number>>;
  expectedResult?: string;
  precautions?: string[];
  references?: string[];
  institutionName?: string;
}

export interface DemoSyllabusPdfParams {
  subjectCode: string;
  subjectName: string;
  semester: number;
  year: number;
  description?: string;
  units: Array<{
    unit_number: number;
    title: string;
    description: string;
    learning_outcomes?: string[];
  }>;
  institutionName?: string;
}

export interface ProfessionalPdfInput {
  title: string;
  subjectCode?: string;
  institutionName?: string;
  content: string;
  isDemo?: boolean;
  documentTypeLabel?: string;
}

/**
 * Validates file upload for PDF specifications
 */
export const validatePdfFile = (
  file: File,
  maxSizeMb = 15
): { isValid: boolean; error?: string } => {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return {
      isValid: false,
      error: 'Invalid file format. Please upload a legitimate PDF file (.pdf).',
    };
  }

  const maxBytes = maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      isValid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${maxSizeMb} MB.`,
    };
  }

  return { isValid: true };
};

/**
 * Converts File object to Base64 Data URL for persistent local demo storage
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * Creates a downloadable Blob and triggers browser download
 */
export const downloadPdfFile = (urlOrDataUrl: string, fileName: string) => {
  const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  let href = urlOrDataUrl;
  let shouldRevoke = false;

  if (urlOrDataUrl.startsWith('data:')) {
    try {
      const parts = urlOrDataUrl.split(',');
      const b64 = parts[1] || '';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      href = URL.createObjectURL(blob);
      shouldRevoke = true;
    } catch {
      href = urlOrDataUrl;
    }
  }

  const link = document.createElement('a');
  link.href = href;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(href), 1500);
  }
};

function normalizeToAscii(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2022\u00B7]/g, '*')
    .replace(/\u00B2/g, '^2')
    .replace(/\u00B3/g, '^3')
    .replace(/\u03A9/g, 'Ohm')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u00B0/g, ' deg')
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u2192/g, '->')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

function sanitizePdfText(text: string): string {
  return normalizeToAscii(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(line: string, maxChars = 84): string[] {
  const clean = normalizeToAscii(line);
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current.trim());
        current = '';
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines.length > 0 ? lines : [''];
}

function encodeBase64Ascii(raw: string): string {
  if (typeof btoa === 'function') {
    return btoa(raw);
  }
  return Buffer.from(raw, 'binary').toString('base64');
}

/**
 * Core pure ASCII multi-page PDF 1.4 generator.
 * Paginates cleanly across as many pages as needed without truncating lines.
 */
export const buildMultiPagePdfString = (input: ProfessionalPdfInput): { pdfString: string; pageCount: number; lineCount: number } => {
  const bannerLabel = input.isDemo
    ? input.documentTypeLabel || 'DEMO MANUAL - ILLUSTRATIVE CONTENT - NOT AN OFFICIAL COLLEGE DOCUMENT'
    : input.documentTypeLabel || 'LABVERSE SMART LABORATORY LEARNING PLATFORM';

  const headerLines = [
    input.institutionName || 'Manakula Vinayagar Institute of Technology (MVIT)',
    `${bannerLabel}${input.subjectCode ? ` | ${input.subjectCode}` : ''}`,
    input.title,
    '--------------------------------------------------------------------------------',
  ];

  const wrappedLines: string[] = [];
  headerLines.forEach((l) => wrappedLines.push(...wrapLine(l, 82)));
  wrappedLines.push('');

  const rawBodyLines = (input.content || '').split('\n');
  rawBodyLines.forEach((l) => {
    if (l.trim() === '') {
      wrappedLines.push('');
    } else {
      wrappedLines.push(...wrapLine(l, 82));
    }
  });

  const LINES_PER_PAGE = 43;
  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += LINES_PER_PAGE) {
    pages.push(wrappedLines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) {
    pages.push(['LABVERSE - MVIT Document']);
  }

  // Object allocation:
  // 1: Catalog
  // 2: Pages
  // 3: Font Helvetica
  // For each page i (0..P-1): pageObjId = 4 + i*2, contentObjId = 5 + i*2
  const fontObjId = 3;
  const pageRefs: string[] = [];
  const pageAndContentObjs: string[] = [];

  pages.forEach((pageLines, idx) => {
    const pageObjId = 4 + idx * 2;
    const contentObjId = 5 + idx * 2;
    pageRefs.push(`${pageObjId} 0 R`);

    const footerNote = `Page ${idx + 1} of ${pages.length}${input.isDemo ? ' | DEMO SAMPLE CONTENT' : ' | LABVERSE - MVIT'}`;
    const textCommands: string[] = ['BT', '/F1 10.5 Tf', '50 748 Td', '14.5 TL'];
    pageLines.forEach((line, lineIdx) => {
      const safe = sanitizePdfText(line);
      if (lineIdx === 0) {
        textCommands.push(`(${safe}) Tj`);
      } else {
        textCommands.push(`T* (${safe}) Tj`);
      }
    });
    textCommands.push('ET');
    textCommands.push('BT', '/F1 8.5 Tf', '50 32 Td', `(${sanitizePdfText(footerNote)}) Tj`, 'ET');

    const streamBody = textCommands.join('\n');

    pageAndContentObjs.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`
    );
    pageAndContentObjs.push(
      `${contentObjId} 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream\nendobj\n`
    );
  });

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>\nendobj\n`,
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ...pageAndContentObjs,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return {
    pdfString: pdf,
    pageCount: pages.length,
    lineCount: wrappedLines.length,
  };
};

/**
 * Builds structured multi-page demo experiment manual content and returns raw PDF + base64 Data URL.
 */
export const buildDemoManualContentText = (params: DemoManualPdfParams): string => {
  const sections: string[] = [];

  sections.push(`EXPERIMENT ${params.expNumber ?? 1}: ${params.title}`);
  if (params.subjectCode || params.subjectName) {
    sections.push(`SUBJECT: ${params.subjectCode || ''} ${params.subjectName ? `- ${params.subjectName}` : ''}`.trim());
  }
  if (params.courseCode || params.academicYearLabel || params.semester) {
    const metaParts = [
      params.courseCode ? `Course: ${params.courseCode}` : '',
      params.academicYearLabel ? `Level: ${params.academicYearLabel}` : '',
      params.semester ? `Semester ${params.semester}` : '',
    ].filter(Boolean);
    sections.push(metaParts.join(' | '));
  }
  sections.push('DEMO MANUAL - ILLUSTRATIVE CONTENT - NOT AN OFFICIAL COLLEGE DOCUMENT');
  sections.push('NOTICE: DEMO MANUAL - SAMPLE CONTENT FOR DEMONSTRATION PURPOSES ONLY.');
  sections.push('');

  if (params.aim) {
    sections.push('1. AIM');
    sections.push(params.aim);
    sections.push('');
  }

  if (params.theory) {
    sections.push('2. THEORY');
    sections.push(params.theory);
    sections.push('');
  }

  if (params.componentsRequired && params.componentsRequired.length > 0) {
    sections.push('3. REQUIRED COMPONENTS & APPARATUS');
    params.componentsRequired.forEach((c, idx) => {
      sections.push(`  ${idx + 1}. ${c.name}${c.quantity ? ` (${c.quantity})` : ''}${c.spec ? ` - ${c.spec}` : ''}`);
    });
    if (params.equipmentRequired && params.equipmentRequired.length > 0) {
      params.equipmentRequired.forEach((eq) => {
        sections.push(`  * Equipment: ${eq.name}${eq.model ? ` [${eq.model}]` : ''}${eq.spec ? ` - ${eq.spec}` : ''}`);
      });
    }
    sections.push('');
  }

  if (params.circuitDiagramDescription) {
    sections.push('4. CIRCUIT / APPARATUS DIAGRAM DESCRIPTION');
    sections.push(params.circuitDiagramDescription);
    sections.push('');
  }

  if (params.procedure && params.procedure.length > 0) {
    sections.push(`${params.circuitDiagramDescription ? '5' : '4'}. STEP-BY-STEP PROCEDURE`);
    params.procedure.forEach((p) => {
      sections.push(`  Step ${p.step}: ${p.title}`);
      sections.push(`    ${p.instruction}`);
      if (p.precaution) {
        sections.push(`    Note: ${p.precaution}`);
      }
    });
    sections.push('');
  }

  if (params.observationHeaders && params.observationHeaders.length > 0) {
    sections.push('OBSERVATION TABLE FORMAT');
    const colLine = params.observationHeaders.map((h) => h.header).join(' | ');
    sections.push(`  | ${colLine} |`);
    sections.push(`  | ${params.observationHeaders.map(() => '---').join(' | ')} |`);
    if (params.sampleObservations && params.sampleObservations.length > 0) {
      params.sampleObservations.forEach((row) => {
        const vals = params.observationHeaders!.map((h) => String(row[h.key] ?? '-')).join(' | ');
        sections.push(`  | ${vals} |`);
      });
    }
    sections.push('');
  }

  if (params.expectedResult) {
    sections.push('EXPECTED RESULT');
    sections.push(params.expectedResult);
    sections.push('');
  }

  if (params.formulae && params.formulae.length > 0) {
    sections.push('KEY FORMULAE & RELATIONS');
    params.formulae.forEach((f, idx) => {
      sections.push(`  (${idx + 1}) ${f}`);
    });
    sections.push('');
  }

  if (params.precautions && params.precautions.length > 0) {
    sections.push('PRECAUTIONS');
    params.precautions.forEach((p, idx) => {
      sections.push(`  ${idx + 1}. ${p}`);
    });
    sections.push('');
  }

  if (params.references && params.references.length > 0) {
    sections.push('CURATED EXTERNAL REFERENCES');
    params.references.forEach((r, idx) => {
      sections.push(`  [${idx + 1}] ${r}`);
    });
  }

  return sections.join('\n');
};

export const generateDemoManualPdfDataUrl = (params: DemoManualPdfParams): string => {
  const content = buildDemoManualContentText(params);
  const { pdfString } = buildMultiPagePdfString({
    title: params.title,
    subjectCode: params.subjectCode,
    institutionName: params.institutionName,
    content,
    isDemo: true,
    documentTypeLabel: 'DEMO MANUAL - SAMPLE CONTENT (ILLUSTRATIVE ONLY)',
  });
  return `data:application/pdf;base64,${encodeBase64Ascii(pdfString)}`;
};

export const generateDemoSyllabusPdfDataUrl = (params: DemoSyllabusPdfParams): string => {
  const lines: string[] = [
    `COURSE SUBJECT: ${params.subjectCode} - ${params.subjectName}`,
    `ACADEMIC LEVEL: Year ${params.year} | Semester ${params.semester}`,
    'NOTICE: DEMO SYLLABUS - SAMPLE ILLUSTRATIVE CONTENT ONLY.',
    '',
  ];

  if (params.description) {
    lines.push('OVERVIEW');
    lines.push(params.description);
    lines.push('');
  }

  lines.push('SYLLABUS MODULES & LEARNING OUTCOMES');
  params.units.forEach((u) => {
    lines.push(`Unit ${u.unit_number}: ${u.title}`);
    if (u.description) lines.push(`  ${u.description}`);
    if (u.learning_outcomes && u.learning_outcomes.length > 0) {
      u.learning_outcomes.forEach((lo) => lines.push(`  * Outcome: ${lo}`));
    }
    lines.push('');
  });

  const { pdfString } = buildMultiPagePdfString({
    title: `${params.subjectCode} - ${params.subjectName} Syllabus`,
    subjectCode: params.subjectCode,
    institutionName: params.institutionName,
    content: lines.join('\n'),
    isDemo: true,
    documentTypeLabel: 'DEMO SYLLABUS - SAMPLE CONTENT',
  });
  return `data:application/pdf;base64,${encodeBase64Ascii(pdfString)}`;
};

export const getSamplePdfDataUrl = (params?: Partial<DemoManualPdfParams>): string => {
  return generateDemoManualPdfDataUrl({
    title: params?.title || 'Sample Laboratory Experiment Manual',
    subjectCode: params?.subjectCode || 'MVIT-LAB',
    subjectName: params?.subjectName || 'Demonstrative Engineering Practical',
    expNumber: params?.expNumber ?? 1,
    aim: params?.aim || 'To demonstrate standard experimental apparatus setup, calibrated observation logging, and practical result verification.',
    theory: params?.theory || 'Illustrative sample theoretical foundation for hackathon demonstration mode.',
    componentsRequired: params?.componentsRequired || [
      { name: 'Standard Bench Apparatus', quantity: '1 set', spec: 'Calibrated demonstration module' },
    ],
    procedure: params?.procedure || [
      { step: 1, title: 'Apparatus Check', instruction: 'Inspect all instruments and verify zero error prior to recording readings.' },
      { step: 2, title: 'Record Readings', instruction: 'Take repeated measurements under controlled laboratory conditions.' },
    ],
    expectedResult: params?.expectedResult || 'Measured experimental readings align closely with theoretical expectations.',
    precautions: params?.precautions || ['Handle laboratory instruments carefully and switch off power supplies after use.'],
  });
};

/**
 * Generates a valid multi-page PDF 1.4 Blob and Object URL for MVIT manuals and syllabi
 */
export const generateProfessionalPdfBlob = (
  input: ProfessionalPdfInput
): { blob: Blob; blobUrl: string; pageCount: number } => {
  const { pdfString, pageCount } = buildMultiPagePdfString(input);
  const blob = new Blob([pdfString], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  return { blob, blobUrl, pageCount };
};
