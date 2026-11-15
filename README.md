# LABVERSE — Smart Laboratory Learning & Management Platform

**Learn. Explore. Experiment.**

LABVERSE is a single-institution smart laboratory learning and operations platform built for **Manakula Vinayagar Institute of Technology (MVIT), Puducherry**. It combines an open-access student learning portal with strictly scoped staff management tools, interactive simulators, lab equipment QR workflows, and private laboratory manual storage.

---

## Platform Roles & Access Model

| Surface / Role | Authentication | Scope & Responsibilities |
| :--- | :--- | :--- |
| **Public User Learning Portal** | **None (Open Access)** | Browse public labs, courses, Years 1–4 practical subjects, syllabi, experiments, validated PDF manuals, YouTube demonstrations, built-in/external simulations, and public apparatus QR lookup. **PC Lab is completely hidden.** |
| **College Admin** | **Required (`college_admin`)** | Manage institution-wide laboratories, create/assign Lab Assistants, oversee departments and courses. Sees PC Lab solely as an administrative lab entry for assistant assignment (individual PC inventory, specs, counts, maintenance, and PC QR details are hidden). |
| **Lab Assistant** | **Required (`lab_assistant`)** | Assigned to specific MVIT laboratories. Full CRUD over subjects, syllabi, experiments, PDF manual uploads/publishing, YouTube/simulation resources, apparatus inventory, and QR tags. When assigned to PC Lab, manages student/staff PCs and maintenance tickets. |

> **Important Scope Boundaries:** There is no Super Admin, Faculty login, or Student login, and there is no student progress tracking or submission grading workflow.

---

## Public Learning Workflow

Every stage is independently navigable:

`Homepage` → `Start Learning` → `Laboratory Selection` → `Course Selection` → `Academic Year Selection (Years 1–4)` → `Practical Subject Selection` → `Syllabus` → `Experiment Selection` → `Experiment Workspace (Manual PDF / YouTube / Virtual Simulation)`

### Built-In Simulators
1. **Silicon PN Junction Diode Analyzer** (`pn_junction`)
2. **Simple Pendulum Oscillation Rig** (`pendulum`)
3. **Vernier Calipers Metrology Bench** (`calipers`)
4. **Electrometric Digital pH Meter** (`ph_meter`)

---

## Demo Mode vs Live Supabase Mode

### 1. Demo Mode (Default when Supabase env vars are unset)
- Preloaded with illustrative Year 1–4 MVIT demo practicals across **Physical Science Lab (`PSL-01`)**, **Electronic Devices Lab (`EDL-01`)**, **Professional Communication Lab (`PCL-01`)**, and staff-only **PC Lab (`COMP-PC-01`)**.
- All seeded illustrative content is clearly badged with **`DEMO – ILLUSTRATIVE CONTENT – NOT AN OFFICIAL COLLEGE DOCUMENT`**.
- Uploaded PDFs in Demo Mode are persisted inside browser **IndexedDB** (`pdf_documents` store via `idb://` references) alongside app state in `localStorage` / IndexedDB, so uploaded manuals remain previewable and downloadable across page reloads.

### 2. Live Supabase Mode
Configure environment variables in `.env.local` (never commit real secrets):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
APP_URL=http://localhost:3000

# Server-side only (never expose to browser or VITE_* variables)
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

### Applying Supabase Migrations & Demo Seed (In Order)
Run the SQL files inside `supabase/migrations/` in chronological order in the Supabase SQL Editor (or via Supabase CLI):

1. `supabase/migrations/20261111_create_labverse_schema.sql`
2. `supabase/migrations/20261112_multi_lab_and_tenant_expansion.sql`
3. `supabase/migrations/20261113_single_institution_mvit.sql`
4. `supabase/migrations/20261114_fix_mvit_rls_and_storage.sql`
5. `supabase/migrations/20261115_year_wise_and_lab_resources.sql`
6. `supabase/migrations/20261116_pc_lab_rls_integrity_and_psl_dedup.sql`
7. `supabase/migrations/20261117_hide_pc_lab_public_and_restrict_admin_pcs.sql`
8. `supabase/migrations/20261118_resource_verification_and_rls_hardening.sql`
9. `supabase/migrations/20261119_tighten_storage_and_manual_rls.sql`
10. *(Optional for demo)* `supabase/seed_demo.sql` — idempotent Years 1–4 demo content + PC Lab sample fleet.

> **Security Highlights (`20261117`–`20261119`):**
> - The `manuals` Supabase Storage bucket is **private** (`public = false`) and serves authorized documents via short-lived signed URLs refreshed from persistent `storage_path`.
> - Row-Level Security blocks public/anonymous users from `pc_lab` / non-public labs, blocks `college_admin` from reading or modifying individual PC computer inventory, maintenance logs, or PC Lab manuals/storage objects, and restricts Lab Assistants strictly to their assigned laboratories.
> - PDF Previews convert validated `%PDF-` streams (`idb://`, `data:`, Supabase private storage downloads, and CORS-permitted HTTP URLs) into temporary revocable `Blob` URLs inside Chrome/Edge, with explicit loading, retry, missing-file, access-denied, and CORS external fallback (`Open PDF in New Tab` / `Download PDF`) states.

---

## Local Development & Verification Commands

```bash
# Install dependencies
npm install

# Run all unit tests
npm test

# Type-check codebase
npm run lint

# Build production bundle
npm run build

# Start development / production server on port 3000
npm run dev
```

*(Note: When running locally in an offline/sandboxed environment without `SUPABASE_SERVICE_ROLE_KEY`, live Supabase admin user invitation endpoints require server-side configuration.)*
