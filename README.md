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
# The app keeps this compatibility variable name; set its value to the sb_publishable_ key.
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
APP_URL=http://localhost:3000

# Server-side only (never expose to browser or VITE_* variables)
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

### Applying Supabase Migrations & Demo Seed (In Order)

Run **all SQL migrations in this exact chronological order**, then run `supabase/seed_demo.sql` once. The seed is idempotent and now creates the four core labs before attaching demo subjects and course mappings.

1. `supabase/migrations/20261111_init_labverse.sql`
2. `supabase/migrations/20261112_multi_lab_and_tenant_expansion.sql`
3. `supabase/migrations/20261112_security_repair_and_production_auth.sql`
4. `supabase/migrations/20261113_mvit_single_college_simplification.sql`
5. `supabase/migrations/20261114_mvit_production_security_hardening.sql`
6. `supabase/migrations/20261115_pc_lab_and_course_learning_workflow.sql`
7. `supabase/migrations/20261116_pc_lab_rls_integrity_and_psl_dedup.sql`
8. `supabase/migrations/20261117_curated_resource_registry_and_validation.sql`
9. `supabase/migrations/20261118_hide_pc_lab_public_and_restrict_admin_pc_records.sql`
10. `supabase/migrations/20261119_tighten_storage_and_manual_rls.sql`
11. `supabase/migrations/20261120_backend_access_hardening.sql`
12. `supabase/migrations/20261121_revoke_default_data_api_grants.sql`
13. `supabase/seed_demo.sql` — illustrative Years 1–4 content, four labs, course mappings, and clearly labelled sample PC Lab fleet.

> **Security Highlights (`20261118`–`20261121`):**
> - The `manuals` Storage bucket is **private**; documents are served through authorized access to stored objects.
> - Anonymous users receive read-only access to public learning tables. Management writes require authentication and are filtered by row-level policies.
> - PC Lab remains in the database but is hidden from the public portal. Only its assigned Lab Assistant can access individual PC inventory and maintenance records; College Admin cannot inspect those machine records.
> - Deprecated student progress tables remain inaccessible to anonymous and authenticated clients.
> - New public-schema tables/functions are not automatically exposed to app roles; migrations must explicitly grant only the intended access.
> - Demo seed records are illustrative. No real PDF manuals are included; staff must upload experiment-specific manuals to the private `manuals` bucket.

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
