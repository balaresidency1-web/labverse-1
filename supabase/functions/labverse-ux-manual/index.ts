import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const ink = rgb(0.145, 0.145, 0.13);
const brown = rgb(0.286, 0.216, 0.18);
const copper = rgb(0.65, 0.416, 0.263);
const muted = rgb(0.40, 0.38, 0.35);
const line = rgb(0.90, 0.87, 0.82);
const cream = rgb(0.98, 0.965, 0.94);

const principles = [
  ["1. Squash & stretch", "Change shape to communicate weight, flexibility and impact while preserving perceived volume."],
  ["2. Anticipation wind-up", "Show preparation before the main action so the next movement is understandable."],
  ["3. Staging the focus", "Compose the scene so the important action or control is immediately noticeable."],
  ["4. Pose to pose", "Plan key poses first, then create the in-between motion."],
  ["5. Follow through", "Let attached or secondary parts continue naturally after the main action stops."],
  ["6. Slow in & slow out", "Use easing so movement accelerates and decelerates rather than starting and stopping abruptly."],
  ["7. Moving in arcs", "Use readable curved paths for organic movement where appropriate."],
  ["8. Secondary action", "Add a supporting action that reinforces, rather than distracts from, the main action."],
  ["9. Snappy timing", "Choose frame counts and delays that make an action feel responsive and intentional."],
  ["10. Exaggerated feedback", "Make important state changes perceptible without misleading or overwhelming the user."],
  ["11. Solid drawing in 3D", "Maintain form, volume, perspective and spatial consistency."],
  ["12. Overall appeal", "Make the visual result coherent, engaging and easy to read."],
  ["13. Fitts's law", "Target acquisition is affected by target size and distance; make primary targets easy to reach."],
  ["14. Bigger hit areas", "Provide generous clickable or tappable areas and adequate spacing."],
  ["15. Hick's law", "Decision time tends to increase as the number and complexity of choices increase; group and simplify options."],
  ["16. Miller's law", "Reduce working-memory burden by chunking related information; do not treat a fixed item count as universal."],
  ["17. Doherty threshold", "Keep system feedback prompt enough to preserve interaction flow; measure perceived latency."],
  ["18. Postel's law", "Accept reasonable input variation safely, validate clearly, and return predictable, useful feedback."],
  ["19. Jakob's law", "Respect familiar interaction conventions so users can transfer existing expectations."],
  ["20. Frequency of use", "Make frequent tasks easier to discover and reach without hiding less common tasks."],
];

const experiments = [
  {
    year: "YEAR 1 | SEMESTER 2",
    title: "Experiment 1: Create a bouncing-ball motion study",
    aim: "Create a short, readable bouncing-ball animation and demonstrate core motion principles through key poses and timing.",
    principles: "Squash and stretch, anticipation, staging, pose to pose, follow through, slow in and slow out, arcs, secondary action, snappy timing, exaggeration, solid form and appeal.",
    materials: "Paper and pencil or a 2D animation tool, frame timeline, and a screen or camera for playback.",
    steps: [
      "Create a ball and ground line. Decide whether the ball is soft, rubber-like or rigid; keep the material visually consistent.",
      "Draw key poses: rest, anticipation, falling, impact, squash, rebound, apex and settling.",
      "Add in-between drawings or keyframes. Use a curved path and spacing that increases during a fall and decreases near the apex.",
      "Add a subtle secondary action, such as a small shadow or settling bounce, that does not compete with the ball.",
      "Compare a rigid version with a squash-and-stretch version. Keep perceived volume approximately consistent.",
      "Export a 3-5 second clip or GIF and annotate the frames where the principles are visible.",
    ],
    observation: "Record pose, frame or time, shape/spacing, principle shown and animation duration. Expected result: a readable trajectory, clear impact and controlled timing.",
  },
  {
    year: "YEAR 2 | SEMESTER 4",
    title: "Experiment 2: Measure and improve touch-target and menu usability",
    aim: "Compare interface variants to observe how target size, target distance and choice count affect task completion and errors.",
    principles: "Fitts's law, bigger hit areas, Hick's law, Miller's law, Jakob's law and frequency of use.",
    materials: "A clickable prototype, phone or mouse, stopwatch or event logger, and 3-5 volunteers. Do not collect identifying or sensitive information.",
    steps: [
      "Create two versions of the same screen: one with small, widely spaced controls and one with larger, well-spaced hit areas. Keep labels and task content identical.",
      "Give participants the same target-selection task in each version. Alternate the order between participants to reduce practice effects.",
      "Record target width, approximate distance, completion time and mis-taps. Report median time and total errors.",
      "Create two menu variants: one with many ungrouped options and one with clearly grouped, labelled choices. Ask participants to find the same destination.",
      "Check whether familiar conventions and frequently used actions are easier to find. Group content meaningfully rather than forcing an arbitrary number of choices.",
      "Summarise the design changes and explain which observations are consistent with Fitts's and Hick-Hyman laws.",
    ],
    observation: "Record variant, target size, pointer distance, menu choices, median selection time and errors. Expected result: larger targets and clearer grouping should generally improve selection ease.",
  },
  {
    year: "YEAR 3 | SEMESTER 6",
    title: "Experiment 3: Evaluate motion feedback and perceived responsiveness",
    aim: "Design and compare two motion-feedback patterns for a common interface action, then evaluate clarity, perceived speed and task success.",
    principles: "Doherty threshold, snappy timing, exaggerated feedback, anticipation, staging, follow through, easing, secondary action and overall appeal; apply Postel's law to input validation.",
    materials: "A prototype tool or HTML/CSS/JavaScript prototype, a device, event timestamps and a short observation form.",
    steps: [
      "Choose a common action such as Save, Submit or Add to list. Design one abrupt state change and one short animated version with clear confirmation.",
      "Make the primary action visually dominant. Use anticipation only when it explains the transition; avoid decorative motion that delays the task.",
      "Implement two timing variants. Keep actual system response separate from visual animation so a slow backend is not disguised by motion.",
      "Run the same task with 3-5 volunteers. Record action-to-feedback latency, task completion time, incorrect repeats and a 1-5 clarity rating.",
      "Test under normal and deliberately delayed response conditions. Show a clear pending state when work takes longer; do not claim completion early.",
      "Use follow-through or secondary action only when it reinforces the result. Document a reduced-motion alternative.",
    ],
    observation: "Record version, acknowledgement latency, task time, repeated clicks, errors and clarity rating. The 400 ms Doherty threshold is a historical guideline, not a universal pass/fail rule.",
  },
  {
    year: "YEAR 4 | SEMESTER 8",
    title: "Experiment 4: Build and evaluate an integrated UX + motion prototype",
    aim: "Produce a responsive multi-step interface prototype and evaluate it against all 20 principles using a documented usability test.",
    principles: "All 20 principles: animation craft, staging, timing, form, target acquisition, choice complexity, cognitive load, responsiveness, robust input, familiar conventions and frequent-task prioritisation.",
    materials: "Figma, a web prototype tool or equivalent; test device(s); event/time logging; and a short participant consent script.",
    steps: [
      "Select a realistic task flow such as search, select, configure and confirm. Define intended users and 3-5 task scenarios.",
      "Create a storyboard and key poses for important transitions. Apply staging, anticipation, pose-to-pose, arcs, easing, follow-through and appropriate timing.",
      "Build controls with generous hit areas and conventional patterns. Simplify choices, chunk information and put frequent actions where users can find them.",
      "Handle input variations safely and provide clear validation. Keep feedback prompt and truthful; expose pending, success and error states.",
      "Test with at least five volunteers when feasible. Obtain consent, do not record identifying details, and make participation optional.",
      "Record task completion, time, errors, navigation reversals and participant comments. Compare results to the baseline prototype.",
      "Prioritise three changes, revise the prototype, and repeat the most important task.",
    ],
    observation: "Submit storyboard, annotated screens, working prototype, task results, before/after evidence and a reflection mapping all 20 principles to specific design decisions.",
  },
];

function clean(s: string) {
  return s.replace(/[–—]/g, "-").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/•/g, "-");
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = clean(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth || !current) current = trial;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

async function buildManual() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("LABVERSE UX and Animation Practical Manual");
  pdf.setAuthor("LABVERSE");
  pdf.setSubject("Four year-wise UX and animation experiments based on 20 principles");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, left = 48, right = 48, maxWidth = W-left-right;
  let page: any, y = 0, pageNo = 0;

  function newPage(label = "LABVERSE | UX & Animation Practical Manual") {
    page = pdf.addPage([W,H]); pageNo++; y = H-60;
    page.drawText(label, {x:left,y:H-30,size:8,font:regular,color:muted});
    page.drawLine({start:{x:left,y:H-39},end:{x:W-right,y:H-39},thickness:0.6,color:line});
    return page;
  }
  function ensure(height: number) { if (y-height < 58) newPage("LABVERSE | Practical Manual (continued)"); }
  function para(text: string, opts: {size?:number,bold?:boolean,color?:any,gap?:number,leftIndent?:number} = {}) {
    const size=opts.size??9, font=opts.bold?bold:regular, color=opts.color??ink, indent=opts.leftIndent??0;
    const lines=wrapText(text,font,size,maxWidth-indent);
    ensure(lines.length*(size+4)+(opts.gap??5));
    for(const ln of lines){page.drawText(ln,{x:left+indent,y,size,font,color});y-=size+4;}
    y-=(opts.gap??5);
  }
  function heading(text: string, level=1) {
    const size=level===1?18:level===2?12:10;
    ensure(size+18);
    y-=level===1?4:2;
    page.drawText(clean(text),{x:left,y,size,font:bold,color:level===1?brown:copper});
    y-=size+9;
  }
  function bullet(text: string) { para("- "+text,{size:8.5,leftIndent:10,gap:3}); }

  newPage("LABVERSE | Learn. Explore. Experiment.");
  y=H-135;
  page.drawText("UX & Animation",{x:left,y,size:29,font:bold,color:ink});
  y-=38; page.drawText("Practical Manual",{x:left,y,size:29,font:bold,color:ink});
  y-=42;
  para("Four year-wise experiments built around 20 principles of motion, interaction and user experience.",{size:12,color:brown,gap:18});
  for(const item of ["YEAR 1  |  Motion foundations","YEAR 2  |  Touch targets and choice architecture","YEAR 3  |  Feedback, timing and interaction quality","YEAR 4  |  Integrated UX and motion capstone"]) bullet(item);
  y-=12;
  para("This is an original LABVERSE companion practical handout. It is illustrative learning material, not an approved or official institutional syllabus. Experiments and outcomes should be adapted to the course and reviewed by the assigned instructor.",{size:9,bold:true,color:brown,gap:14});
  heading("What this manual contains",2);
  for(const item of ["A reference list of the 20 principles supplied for this practical track.","One progressive experiment for each academic year (Years 1-4 / Semesters 2, 4, 6 and 8).","Step-by-step procedures, observations, expected outputs and assessment guidance.","A practical evaluation approach using task time, errors, target size, choice count and participant feedback."]) bullet(item);

  newPage();
  heading("The 20 principles",1);
  para("Principles 1-12 describe traditional animation craft. Principles 13-20 are interaction and UX heuristics. The short descriptions below are practical interpretations for this learning track.");
  for(const [name,desc] of principles){heading(name,3);para(desc,{size:8.5,gap:4});}

  for(const exp of experiments){
    newPage();
    heading(exp.year,1); heading(exp.title,2);
    heading("Aim",3);para(exp.aim);
    heading("Principles applied",3);para(exp.principles);
    heading("Materials / software",3);para(exp.materials);
    heading("Procedure",3);
    exp.steps.forEach((s,i)=>bullet((i+1)+". "+s));
    heading("Observation and expected result",3);para(exp.observation,{size:8.5,bold:true,color:brown});
    heading("Student record",3);
    para("Record actual observations during the practical. Do not submit sample values as measured results. Include dated screenshots, sketches, a clip or prototype link, task-time/error tables and a short discussion.");
  }

  newPage();
  heading("Assessment and submission",1);
  heading("Suggested assessment rubric",2);
  for(const item of [
    "Principle application - 25%: principles are identified and applied intentionally, not added as decoration.",
    "Prototype quality - 25%: animation or interface works, is readable and has consistent visual hierarchy.",
    "Measurement and evidence - 25%: observations, timing, error counts and comparisons are recorded clearly.",
    "Reflection and iteration - 25%: limitations are explained and improvements are evidence-led."
  ]) bullet(item);
  heading("Student submission checklist",2);
  for(const item of ["Experiment title, aim and mapped academic year / semester.","Annotated sketches, storyboard or screenshots.","Working prototype, exported GIF/video or shareable project link.","Completed observation table and a brief result/discussion.","One paragraph describing limitations and the next improvement."]) bullet(item);
  heading("Safety, privacy and accessibility",2);
  for(const item of ["Use only volunteers and explain the test before it begins. Do not collect names, email addresses or sensitive personal information.","Do not use animation alone to communicate success, error or urgency; pair motion with clear text and accessible state changes.","Avoid flashing effects, unnecessary movement and controls that depend only on colour or motion. Provide a reduced-motion alternative where possible.","For touch tests, use the same device and orientation across variants and record the test conditions."]) bullet(item);
  heading("References and online learning",2);
  para("D'Source / IDC, IIT Bombay - Principles of Animation: The 12 Fundamentals. The reference covers squash and stretch, anticipation, staging, pose-to-pose, follow-through, slow in/slow out, arcs, secondary action, timing, exaggeration, solid drawing and appeal.");
  para("PDF: https://www.dsource.in/sites/default/files/course/principles-animation/downloads/file/Course-Principles-animation_new_version_Final.pdf",{size:8,color:copper});
  para("Course page: https://www.dsource.in/course/principles-animation",{size:8,color:copper});
  para("Virtual Labs, IIT Guwahati - Human Computer Interaction experiments, including Fitts's Law, Hick-Hyman's Law and usability evaluation.");
  para("HCI portal: https://hci-iitg.vlabs.ac.in/introduction_expt.html",{size:8,color:copper});
  para("The 20-principle sequence follows the list supplied for LABVERSE. UX principles are framed as practical heuristics to test, not universal laws that guarantee a specific result.",{size:8.5,bold:true,color:brown});

  const pages=pdf.getPages();
  pages.forEach((p,i)=>{
    p.drawLine({start:{x:left,y:42},end:{x:W-right,y:42},thickness:0.6,color:line});
    p.drawText("LABVERSE | Illustrative learning material",{x:left,y:27,size:7,font:regular,color:muted});
    p.drawText(String(i+1),{x:W-right-8,y:27,size:7,font:regular,color:muted});
  });
  return await pdf.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status:405, headers:{...cors,"Allow":"GET, HEAD, OPTIONS"} });
  }
  try {
    const bytes = await buildManual();
    const headers = {
      ...cors,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="LABVERSE-UX-and-Animation-Practical-Manual.pdf"',
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(bytes.length),
    };
    if (req.method === "HEAD") return new Response(null,{status:200,headers});
    return new Response(bytes,{status:200,headers});
  } catch (error) {
    console.error("Unable to generate LABVERSE UX manual",error);
    return new Response("Unable to generate the practical manual.",{status:500,headers:{...cors,"Content-Type":"text/plain"}});
  }
});
