import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_EXPERIMENTS } from '../data/initialData';
import { EXPERIMENT_RESOURCE_REGISTRY } from '../data/resourceRegistry';
import {
  extractYouTubeVideoId,
  classifyYouTubeResource,
  resolveExperimentSimulation,
  isExperimentVideoAvailable,
  isExperimentSimulationAvailable,
} from './labRules';
import { generateDemoManualPdfDataUrl } from './pdfGenerator';

test('All 23 demo experiments map to EXPERIMENT_RESOURCE_REGISTRY with zero fabricated benchtwin /exp/ paths', () => {
  assert.equal(INITIAL_EXPERIMENTS.length, 23);

  for (const exp of INITIAL_EXPERIMENTS) {
    assert.ok(
      EXPERIMENT_RESOURCE_REGISTRY[exp.id],
      `Missing registry entry for ${exp.id}`
    );

    const simUrl = exp.simulation_url || exp.bench_twin_url || '';
    assert.ok(
      !/benchtwin\.com\/exp\//i.test(simUrl),
      `Imaginary benchtwin.com/exp/ URL detected in ${exp.id}: ${simUrl}`
    );

    if (exp.youtube_url) {
      const derivedId = extractYouTubeVideoId(exp.youtube_url);
      assert.ok(derivedId, `Expected valid videoId for ${exp.id}`);
      assert.equal(
        exp.youtube_video_id,
        derivedId,
        `Mismatched youtube_video_id for ${exp.id}`
      );
    } else {
      assert.equal(
        exp.youtube_video_id,
        null,
        `Expected null youtube_video_id when youtube_url is empty for ${exp.id}`
      );
    }
  }
});

test('classifyYouTubeResource distinguishes direct_video, search_only, and unavailable cleanly', () => {
  // Direct video + alt video
  const pn = classifyYouTubeResource({
    youtube_url: 'https://www.youtube.com/watch?v=QIoEw28Y9Wk',
    youtube_alt_url: 'https://www.youtube.com/watch?v=UdaATCmDfYU',
    youtube_search_url: 'https://www.youtube.com/results?search_query=PN+junction+diode',
  });
  assert.equal(pn.mode, 'direct_video');
  assert.equal(pn.videoId, 'QIoEw28Y9Wk');
  assert.equal(pn.altVideoId, 'UdaATCmDfYU');
  assert.equal(pn.ctaLabel, 'WATCH EXPERIMENT VIDEO');

  // Search-only fallback (must NEVER try to extract a video ID even if legacy fields had one)
  const searchOnly = classifyYouTubeResource({
    youtube_url: '',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=Vernier+calipers+least+count',
  });
  assert.equal(searchOnly.mode, 'search_only');
  assert.equal(searchOnly.videoId, null);
  assert.equal(searchOnly.ctaLabel, 'FIND A DEMONSTRATION');
  assert.ok(searchOnly.searchUrl?.startsWith('https://www.youtube.com/results?'));

  // Search URL pasted directly into youtube_url still safely classifies as search_only
  const pastedSearch = classifyYouTubeResource({
    youtube_url: 'https://www.youtube.com/results?search_query=BJT+characteristics',
  });
  assert.equal(pastedSearch.mode, 'search_only');
  assert.equal(pastedSearch.videoId, null);
  assert.equal(pastedSearch.ctaLabel, 'FIND A DEMONSTRATION');

  // Empty/invalid -> unavailable
  const empty = classifyYouTubeResource({ youtube_url: '' });
  assert.equal(empty.mode, 'unavailable');
  assert.equal(empty.videoId, null);
  assert.equal(empty.ctaLabel, 'VIDEO UNAVAILABLE');
  assert.equal(isExperimentVideoAvailable({ youtube_url: '' }), false);
});

test('resolveExperimentSimulation enforces built-in priority and XFO-safe external launch rules', () => {
  // Hybrid built-in + Virtual Labs (embeddable)
  const pnExp = INITIAL_EXPERIMENTS.find((e) => e.id === 'exp-pn-diode')!;
  const pnSim = resolveExperimentSimulation(pnExp);
  assert.equal(pnSim.isAvailable, true);
  assert.equal(pnSim.hasBuiltin, true);
  assert.equal(pnSim.builtInSimulatorId, 'pn_junction');
  assert.equal(pnSim.hasExternal, true);
  assert.equal(pnSim.canEmbedExternal, true);
  assert.equal(pnSim.simulationType, 'hybrid');

  // Built-in only
  const pendulumExp = INITIAL_EXPERIMENTS.find((e) => e.id === 'exp-simple-pendulum')!;
  const pendSim = resolveExperimentSimulation(pendulumExp);
  assert.equal(pendSim.hasBuiltin, true);
  assert.equal(pendSim.hasExternal, false);
  assert.equal(pendSim.canEmbedExternal, false);
  assert.equal(pendSim.simulationType, 'built_in');

  // PhET simulation landing pages (XFO=SAMEORIGIN -> canEmbedExternal MUST be false even if mode tampered)
  const phetTampered = resolveExperimentSimulation({
    simulator_type: 'custom',
    bench_twin_url: 'https://phet.colorado.edu/en/simulations/ohms-law',
    bench_twin_mode: 'embedded',
  });
  assert.equal(phetTampered.hasExternal, true);
  assert.equal(phetTampered.canEmbedExternal, false);
  assert.equal(phetTampered.provider, 'phet');

  // CircuitVerse & BenchTwin (XFO=SAMEORIGIN -> canEmbedExternal MUST be false)
  const cvTampered = resolveExperimentSimulation({
    simulator_type: 'custom',
    bench_twin_url: 'https://circuitverse.org/simulator',
    bench_twin_mode: 'embedded',
  });
  assert.equal(cvTampered.canEmbedExternal, false);
  assert.equal(cvTampered.provider, 'circuitverse');

  const btTampered = resolveExperimentSimulation({
    simulator_type: 'custom',
    bench_twin_url: 'https://benchtwin.com/',
    bench_twin_mode: 'embedded',
  });
  assert.equal(btTampered.canEmbedExternal, false);
  assert.equal(btTampered.provider, 'benchtwin');

  // Communication experiments have simulationType: 'none'
  const commExp = INITIAL_EXPERIMENTS.find((e) => e.id === 'exp-comm-phonetics')!;
  const commSim = resolveExperimentSimulation(commExp);
  assert.equal(commSim.isAvailable, false);
  assert.equal(commSim.simulationType, 'none');
  assert.equal(isExperimentSimulationAvailable(commExp), false);
});

test('Demo manual PDF watermark includes illustrative demo disclosure and academic metadata', () => {
  const pnExp = INITIAL_EXPERIMENTS.find((e) => e.id === 'exp-pn-diode')!;
  const dataUrl = generateDemoManualPdfDataUrl({
    title: pnExp.title,
    subjectCode: pnExp.subject_code,
    courseCode: 'ECE',
    academicYearLabel: '2nd Year',
    semester: 3,
    expNumber: pnExp.exp_number,
    aim: pnExp.aim,
    theory: pnExp.theory,
    componentsRequired: pnExp.components_required,
    equipmentRequired: pnExp.equipment_required,
    procedure: pnExp.procedure,
    observationHeaders: pnExp.observation_headers,
    sampleObservations: pnExp.sample_observations,
    expectedResult: pnExp.expected_result,
    precautions: pnExp.precautions,
    references: ['MVIT ECE-201L Reference Manual'],
  });

  const rawPdf = Buffer.from(dataUrl.slice('data:application/pdf;base64,'.length), 'base64').toString('latin1');
  assert.ok(rawPdf.includes('DEMO MANUAL - SAMPLE CONTENT'));
  assert.ok(rawPdf.includes('DEMO MANUAL - ILLUSTRATIVE CONTENT - NOT AN OFFICIAL COLLEGE DOCUMENT'));
});
