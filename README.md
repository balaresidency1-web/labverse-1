# LABVERSE — Smart Laboratory Learning & Management Platform

**Learn. Explore. Experiment.**

LABVERSE is a single-institution laboratory learning and operations platform. It brings together an open-access practical-learning portal and role-scoped laboratory administration, with experiment resources, virtual simulators, equipment QR workflows, and private manual storage.

## Platform roles and access

| Surface / role | Authentication | Responsibilities |
|---|---|---|
| **Public learning portal** | None | Browse public laboratories, courses, Years 1–4 practical subjects, syllabi, experiments, published manuals, video demonstrations, simulations, and public apparatus QR lookup. The internal PC Lab is hidden. |
| **College Admin** | Required (`college_admin`) | Manage laboratories and staff assignments. Can see the PC Lab as an administrative assignment entry, but cannot inspect individual PC inventory, specifications, counts, maintenance records, or PC QR details. |
| **Lab Assistant** | Required (`lab_assistant`) | Manage only assigned laboratories: subjects, syllabi, experiments, manuals, video/simulation resources, apparatus inventory, and QR tags. The assigned PC Lab Assistant can manage workstation and maintenance records. |

There is no Super Admin, Faculty login, Student login, student progress tracking, or submission-grading workflow.

## Public learning journey

`Homepage` → `Start Learning` → `Laboratory Selection` → `Course Selection` → `Year Selection (1–4)` → `Practical Subjects` → `Syllabus` → `Experiments` → `Experiment Workspace`

The experiment workspace provides the available manual, video demonstration, and virtual simulation resources.

## Built-in simulators

- Silicon PN Junction Diode Analyzer (`pn_junction`)
- Simple Pendulum Oscillation Rig (`pendulum`)
- Vernier Calipers Metrology Bench (`calipers`)
- Electrometric Digital pH Meter (`ph_meter`)

## Demo mode and live backend

### Demo mode

When Supabase environment variables are not configured, the app uses illustrative demo data. Demo records must be treated as sample content, not official curriculum or institutional documents. Demo PDF uploads are stored in browser IndexedDB and should be tested in the same browser profile used for the presentation.

### Live Supabase mode

Create a local `.env.local` file and configure:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
# Compatibility variable name: use the Supabase sb_publishable_ key as the value.
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
APP_URL=http://localhost:3000

# Server-side only. Never expose this value through VITE_* variables or commit it.
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Do not commit credentials, service-role keys, real staff details, or private manuals to GitHub.

### Database setup

Apply the SQL migrations in `supabase/migrations/` in chronological order, then run `supabase/seed_demo.sql` if you want the illustrative starter dataset. The currently configured hosted backend has already had the migration set applied and demo data seeded. Do not reapply migrations blindly to an existing production database.

The private `manuals` Storage bucket is intended for experiment-specific PDFs uploaded by authorized staff. Four experiments currently have external publisher-hosted reference PDFs linked in the live backend and demo seed—one per academic year. LABVERSE links to the original institution-hosted files instead of republishing documents without a confirmed redistribution licence. The source PDF may be a broader laboratory handout, so verify it against the approved local syllabus before treating it as an official course manual.

## Local development and release checks

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

- `npm run lint` runs the TypeScript compiler in no-emit mode.
- `npm test` runs the utility and workflow test files.
- `npm run build` creates the production Vite bundle.
- `npm run dev` starts the Express/Vite development server.

Before a live presentation, verify the public learning journey, each staff role, lab assignment boundaries, PC Lab privacy, QR scan/print, manual upload/preview/download, and simulator/video links in the actual deployment. Confirm that the deployment has the correct Supabase URL and publishable key and that server-side invitation features have their required server secret configured.

## Demo-data notice

Sample curriculum, experiments, inventory, and other seeded records are illustrative unless independently verified against the institution's approved documents. Do not present sample records as official course material.


## UX & Animation practical track

The public **Digital Design & Interaction Lab (UXL-01)** includes one progressive practical for each academic year, mapped to CSE and IT:

| Year / semester | Subject | Practical |
|---|---|---|
| Year 1 / Sem 2 | UXA-101L — Visual Motion & Animation Fundamentals | Create a bouncing-ball motion study |
| Year 2 / Sem 4 | UXA-201L — HCI & Interface Usability | Measure touch-target and menu usability |
| Year 3 / Sem 6 | UXA-301L — Motion Feedback & Interaction Evaluation | Evaluate feedback timing and perceived responsiveness |
| Year 4 / Sem 8 | UXA-401L — Integrated UX & Motion Design Capstone | Build and evaluate an integrated UX/motion prototype |

The original [LABVERSE UX & Animation Practical Manual](https://xppklywqcffewljoswog.supabase.co/functions/v1/labverse-ux-manual) covers the 20 supplied principles, procedures, observation sheets, assessment suggestions, and accessibility / privacy notes. The endpoint generates a PDF on request.

Supplementary learning references:
- [D'Source / IDC, IIT Bombay — Principles of Animation: The 12 Fundamentals (PDF)](https://www.dsource.in/sites/default/files/course/principles-animation/downloads/file/Course-Principles-animation_new_version_Final.pdf)
- [D'Source animation course](https://www.dsource.in/course/principles-animation)
- [IIT Guwahati Virtual Labs — HCI experiment index](https://hci-iitg.vlabs.ac.in/introduction_expt.html)
- [IIT Guwahati Virtual Labs — Fitts's Law experiment](https://hci-iitg.vlabs.ac.in/Fitts.html)

The D'Source PDF is the external animation reference; it is not the LABVERSE manual. The LABVERSE practical handout is original illustrative content and is not an official university syllabus or IIT publication. Seeded subject and experiment records remain illustrative until validated by the institution.


## Reference experiment manuals (one per year)

| Academic year | Experiment | Publisher-hosted PDF |
|---|---|---|
| Year 1 | Simple pendulum – acceleration due to gravity | [SCCE Kinematics and Dynamics Lab Manual (PDF)](https://scce.ac.in/noticeboard/10969_21122017SIMPLE_PENDULUM.pdf) |
| Year 2 | PN-junction diode forward-bias characteristics | [MITS Electronic Devices and Circuits Lab Manual (PDF)](https://mits.ac.in/assets/pdf/ece/EED%20Lab%20Manual.pdf) |
| Year 3 | BJT common-emitter input/output characteristics | [IIT Roorkee BJT Characteristics (PDF)](https://iitr.ac.in/Academics/static/Department/Physics/Analog%20Electronics/BJT_Characteristics.pdf) |
| Year 4 | ADC sensor interfacing and serial telemetry | [IIT Roorkee Microcontroller Lab ADC Manual (PDF)](https://iitr.ac.in/Academics/static/Department/Physics/Microcontroller%20Lab/ADC.pdf) |

These are third-party educational references hosted by their source institutions, not LABVERSE-authored manuals or institution-approved syllabus documents. Their presence guarantees a relevant reference resource for at least one mapped experiment in each year; it does not imply that every experiment has a manual.
