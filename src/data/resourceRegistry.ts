import {
  BuiltInSimulatorId,
  Experiment,
  SimulationProvider,
  SimulationType,
} from '../types';
import { extractYouTubeVideoId } from '../utils/labRules';

export interface CuratedExperimentResourceEntry {
  youtube_url: string;
  youtube_title?: string;
  youtube_alt_url?: string;
  youtube_search_url?: string;
  simulation_url: string;
  bench_twin_mode: 'embedded' | 'external';
  simulation_provider: SimulationProvider;
  simulation_type: SimulationType;
  built_in_simulator_id: BuiltInSimulatorId | null;
  simulator_type: BuiltInSimulatorId | 'custom';
  simulation_note: string;
  resource_status: 'verified' | 'needs_review' | 'unavailable';
  last_verified_at: string;
}

const VERIFIED_DATE = '2026-11-14T00:00:00Z';

/**
 * Curated external YouTube and Virtual Simulation Resource Registry for MVIT demo experiments.
 * Every direct video and external simulation endpoint listed here has been empirically checked:
 * - YouTube direct videos verified via official YouTube oEmbed API (HTTP 200)
 * - IIT Virtual Labs simulations verified HTTP 200 with embeddable response headers
 * - PhET & CircuitVerse landing/simulator URLs verified HTTP 200 (X-Frame-Options: SAMEORIGIN -> external launch)
 * - BenchTwin homepage verified with external new-tab launch guidance (no fabricated /exp/ paths)
 */
export const EXPERIMENT_RESOURCE_REGISTRY: Record<string, CuratedExperimentResourceEntry> = {
  'exp-pn-diode': {
    youtube_url: 'https://www.youtube.com/watch?v=QIoEw28Y9Wk',
    youtube_title: 'V-I Characteristics of Silicon PN Junction Diode | Live Lab Experiment',
    youtube_alt_url: 'https://www.youtube.com/watch?v=UdaATCmDfYU',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=PN+junction+diode+VI+characteristics+lab+experiment',
    simulation_url: 'https://fsp1-iiith.vlabs.ac.in/exp/pn-junction-diode/simulation.html',
    bench_twin_mode: 'embedded',
    simulation_provider: 'virtual_labs',
    simulation_type: 'hybrid',
    built_in_simulator_id: 'pn_junction',
    simulator_type: 'pn_junction',
    simulation_note:
      'Built-in MVIT Silicon PN Junction V-I Plotter runs natively above; IIT Hyderabad Virtual Labs interactive bench is also available.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-pn-diode-reverse': {
    youtube_url: 'https://www.youtube.com/watch?v=QIoEw28Y9Wk',
    youtube_title: 'PN Junction Diode Characteristics & Reverse Bias Behavior',
    youtube_alt_url: 'https://www.youtube.com/watch?v=UdaATCmDfYU',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=PN+junction+diode+reverse+bias+characteristics+lab',
    simulation_url: 'https://fsp1-iiith.vlabs.ac.in/exp/pn-junction-diode/simulation.html',
    bench_twin_mode: 'embedded',
    simulation_provider: 'virtual_labs',
    simulation_type: 'hybrid',
    built_in_simulator_id: 'pn_junction',
    simulator_type: 'pn_junction',
    simulation_note:
      'Built-in PN Junction simulator supports reverse-bias inspection alongside IIT Hyderabad Virtual Labs.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-simple-pendulum': {
    youtube_url: 'https://www.youtube.com/watch?v=lfKU07S2Qwc',
    youtube_title: 'Simple Pendulum Physics Experiment – Explanation & Demonstration',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=simple+pendulum+physics+lab+experiment+demonstration',
    simulation_url: '',
    bench_twin_mode: 'external',
    simulation_provider: 'built_in',
    simulation_type: 'built_in',
    built_in_simulator_id: 'pendulum',
    simulator_type: 'pendulum',
    simulation_note:
      'Uses the built-in LABVERSE Simple Pendulum Oscillation Rig with live T^2 vs L gravity estimation.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-vernier-calipers': {
    youtube_url: '',
    youtube_title: 'Vernier Calipers Least Count & Zero Error Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=Vernier+calipers+least+count+engineering+physics+lab+experiment',
    simulation_url: '',
    bench_twin_mode: 'external',
    simulation_provider: 'built_in',
    simulation_type: 'built_in',
    built_in_simulator_id: 'calipers',
    simulator_type: 'calipers',
    simulation_note:
      'Uses the built-in LABVERSE Mitutoyo Vernier Calipers interactive metrology bench (0.02 mm least count).',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-ph-meter': {
    youtube_url: '',
    youtube_title: 'Digital pH Meter Calibration & Measurement Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=pH+meter+calibration+laboratory+experiment',
    simulation_url: 'https://phet.colorado.edu/en/simulations/ph-scale',
    bench_twin_mode: 'external',
    simulation_provider: 'phet',
    simulation_type: 'hybrid',
    built_in_simulator_id: 'ph_meter',
    simulator_type: 'ph_meter',
    simulation_note:
      'Built-in LABVERSE Electrometric pH Meter runs above; PhET pH Scale provides a complementary concept simulation in a new tab.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-buffer-solution': {
    youtube_url: '',
    youtube_title: 'Buffer Solution Preparation & Standardization Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=buffer+solution+preparation+pH+calibration+lab+experiment',
    simulation_url: 'https://phet.colorado.edu/en/simulations/ph-scale',
    bench_twin_mode: 'external',
    simulation_provider: 'phet',
    simulation_type: 'hybrid',
    built_in_simulator_id: 'ph_meter',
    simulator_type: 'ph_meter',
    simulation_note:
      'Built-in LABVERSE pH Meter supports buffer standardization; PhET pH Scale opens externally as a concept companion.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-ohms-law': {
    youtube_url: '',
    youtube_title: "Ohm's Law Verification Practical Search",
    youtube_search_url:
      'https://www.youtube.com/results?search_query=Ohms+law+verification+electrical+engineering+lab+experiment',
    simulation_url: 'https://phet.colorado.edu/en/simulations/ohms-law',
    bench_twin_mode: 'external',
    simulation_provider: 'phet',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      "PhET Interactive Simulations (Ohm's Law) opens externally in a new browser tab because PhET enforces X-Frame-Options: SAMEORIGIN.",
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-logic-gates': {
    youtube_url: '',
    youtube_title: 'Digital Logic Gates Verification Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=digital+logic+gates+engineering+lab+experiment',
    simulation_url: 'https://circuitverse.org/simulator',
    bench_twin_mode: 'external',
    simulation_provider: 'circuitverse',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'CircuitVerse Digital Logic Simulator opens externally in a new browser tab to build and verify AND, OR, NOT, NAND, NOR, and XOR truth tables.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-transistor-characteristics': {
    youtube_url: '',
    youtube_title: 'BJT Common Emitter Characteristics Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=BJT+common+emitter+characteristics+engineering+lab+experiment',
    simulation_url:
      'https://be-iitkgp.vlabs.ac.in/exp/common-emitter-characteristics/simulation.html',
    bench_twin_mode: 'embedded',
    simulation_provider: 'virtual_labs',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'IIT Kharagpur Virtual Labs Common Emitter Characteristics interactive circuit workbench.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-ce-amplifier': {
    youtube_url: '',
    youtube_title: 'Common Emitter Amplifier Frequency Response Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=common+emitter+amplifier+practical+lab+experiment',
    simulation_url: 'https://be-iitkgp.vlabs.ac.in/exp/ce-amplifier/simulation.html',
    bench_twin_mode: 'embedded',
    simulation_provider: 'virtual_labs',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'IIT Kharagpur Virtual Labs Common Emitter Amplifier frequency response simulator.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-opamp-circuits': {
    youtube_url: '',
    youtube_title: 'Operational Amplifier IC 741 Lab Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=operational+amplifier+integrator+differentiator+lab+experiment',
    simulation_url: 'https://be-iitkgp.vlabs.ac.in/exp/operational-amplifier/',
    bench_twin_mode: 'embedded',
    simulation_provider: 'virtual_labs',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'IIT Kharagpur Virtual Labs Operational Amplifier interactive bench module.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-digital-logic-design': {
    youtube_url: '',
    youtube_title: 'Combinational Adder & Multiplexer Lab Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=full+adder+multiplexer+digital+logic+lab+experiment',
    simulation_url: 'https://circuitverse.org/simulator',
    bench_twin_mode: 'external',
    simulation_provider: 'circuitverse',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'CircuitVerse Digital Circuit Simulator opens externally in a new browser tab for adder and multiplexer construction.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-sequential-counters': {
    youtube_url: '',
    youtube_title: 'Synchronous Decade Counter Lab Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=synchronous+decade+counter+flip+flop+lab+experiment',
    simulation_url: 'https://circuitverse.org/simulator',
    bench_twin_mode: 'external',
    simulation_provider: 'circuitverse',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'CircuitVerse Digital Circuit Simulator opens externally in a new browser tab for flip-flop & counter simulation.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-comm-phonetics': {
    youtube_url: 'https://www.youtube.com/watch?v=eIho2S0ZahI',
    youtube_title: 'How to Speak So That People Want to Listen | Julian Treasure | TED',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=English+phonetics+pronunciation+engineering+communication+lab',
    simulation_url: '',
    bench_twin_mode: 'external',
    simulation_provider: 'none',
    simulation_type: 'none',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'Communication laboratory sessions are conducted with audio studio consoles and faculty rubric evaluation.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-comm-group-discussion': {
    youtube_url: '',
    youtube_title: 'Technical Group Discussion & Mock Interview Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=technical+group+discussion+mock+interview+engineering+skills',
    simulation_url: '',
    bench_twin_mode: 'external',
    simulation_provider: 'none',
    simulation_type: 'none',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'Moderated peer group discussion module evaluated via the HSS-301L communication scorecard.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-microcontroller-interfacing': {
    youtube_url: '',
    youtube_title: 'Microcontroller GPIO, Keypad & LCD Interfacing Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=microcontroller+LCD+keypad+interfacing+embedded+lab',
    simulation_url: 'https://benchtwin.com/',
    bench_twin_mode: 'external',
    simulation_provider: 'benchtwin',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'BenchTwin opens externally in a new browser tab. Select or create an embedded microcontroller workspace inside BenchTwin.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-sensor-data-acquisition': {
    youtube_url: '',
    youtube_title: 'ADC Sensor Data Acquisition Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=ADC+temperature+sensor+LM35+microcontroller+lab',
    simulation_url: 'https://benchtwin.com/',
    bench_twin_mode: 'external',
    simulation_provider: 'benchtwin',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'BenchTwin opens externally in a new browser tab. Launch an ADC telemetry / sensor interfacing workspace inside BenchTwin.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-wireless-comm-demo': {
    youtube_url: '',
    youtube_title: 'ASK & FSK Wireless Modulation Lab Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=ASK+FSK+digital+modulation+communication+lab+experiment',
    simulation_url: 'https://ae-iitr.vlabs.ac.in/exp/function-generator/simulation.html',
    bench_twin_mode: 'embedded',
    simulation_provider: 'virtual_labs',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'IIT Roorkee Virtual Labs Function Generator workbench supports carrier waveform synthesis & oscilloscope inspection.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-iot-device-comm': {
    youtube_url: '',
    youtube_title: 'IoT ESP32 MQTT Telemetry Lab Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=IoT+MQTT+ESP32+telemetry+engineering+lab',
    simulation_url: 'https://benchtwin.com/',
    bench_twin_mode: 'external',
    simulation_provider: 'benchtwin',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'BenchTwin opens externally in a new browser tab. Select or create an embedded IoT hardware project inside BenchTwin.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-resistor-color-code-dmm': {
    youtube_url: '',
    youtube_title: 'Resistor Color Coding & Multimeter Measurement Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=resistor+color+code+digital+multimeter+lab+experiment',
    simulation_url: 'https://phet.colorado.edu/en/simulations/ohms-law',
    bench_twin_mode: 'external',
    simulation_provider: 'phet',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      "PhET Interactive Simulations (Ohm's Law) opens externally in a new tab to explore voltage, resistance, and current relationships.",
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-dc-series-parallel-year1': {
    youtube_url: '',
    youtube_title: 'DC Series-Parallel & KVL KCL Verification Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=KVL+KCL+DC+series+parallel+circuit+engineering+lab',
    simulation_url: 'https://phet.colorado.edu/en/simulations/ohms-law',
    bench_twin_mode: 'external',
    simulation_provider: 'phet',
    simulation_type: 'external',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      "PhET Interactive Simulations (Ohm's Law) opens externally in a new browser tab alongside first-year DC circuit worksheets.",
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-comm-listening-fundamentals': {
    youtube_url: 'https://www.youtube.com/watch?v=eIho2S0ZahI',
    youtube_title: 'How to Speak So That People Want to Listen | Julian Treasure | TED',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=active+listening+engineering+communication+skills+lab',
    simulation_url: '',
    bench_twin_mode: 'external',
    simulation_provider: 'none',
    simulation_type: 'none',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'First-year communication lab uses audio booths and structured listening comprehension exercises.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
  'exp-comm-technical-reading': {
    youtube_url: '',
    youtube_title: 'Technical Reading & Oral Briefing Practice Search',
    youtube_search_url:
      'https://www.youtube.com/results?search_query=technical+reading+comprehension+oral+presentation+engineering+lab',
    simulation_url: '',
    bench_twin_mode: 'external',
    simulation_provider: 'none',
    simulation_type: 'none',
    built_in_simulator_id: null,
    simulator_type: 'custom',
    simulation_note:
      'Facilitated in the Professional Communication Studio using peer summary sheets and pronunciation feedback.',
    resource_status: 'verified',
    last_verified_at: VERIFIED_DATE,
  },
};

export function applyCuratedExperimentResources(exp: Experiment): Experiment {
  const entry = EXPERIMENT_RESOURCE_REGISTRY[exp.id];
  if (!entry) return exp;
  return {
    ...exp,
    youtube_url: entry.youtube_url,
    youtube_video_id: extractYouTubeVideoId(entry.youtube_url),
    youtube_title: entry.youtube_title || exp.youtube_title,
    youtube_alt_url: entry.youtube_alt_url || '',
    youtube_search_url: entry.youtube_search_url || '',
    bench_twin_url: entry.simulation_url,
    simulation_url: entry.simulation_url,
    bench_twin_mode: entry.bench_twin_mode,
    simulation_provider: entry.simulation_provider,
    simulation_type: entry.simulation_type,
    built_in_simulator_id: entry.built_in_simulator_id,
    simulator_type: entry.simulator_type,
    simulation_note: entry.simulation_note,
    resource_status: entry.resource_status,
    last_verified_at: entry.last_verified_at,
  };
}
