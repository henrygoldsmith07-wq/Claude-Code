import { A_LEVEL_BOUNDARIES, buildUnits } from "./helpers";
import { registerSubject } from "./registry";
import type { CurriculumModule } from "./registry";

// WJEC A Level Physics (A200QS). Grouped by the specification's broad content
// areas; check the current WJEC spec for exact assessment objectives.
const SUBJECT_ID = "wjec-alevel-physics";

const { units, topics } = buildUnits(SUBJECT_ID, [
  {
    slug: "motion-energy",
    title: "Motion, Energy and Matter",
    topics: [
      {
        slug: "kinematics-dynamics",
        title: "Motion, forces and Newton's laws",
        specRef: "Unit 1.1–1.3",
        difficulty: 2,
        summary:
          "Scalars and vectors, motion graphs, the equations of motion, Newton's three laws, free-body diagrams and projectile motion.",
        keyPoints: [
          "The gradient of a displacement–time graph is velocity; the area under a velocity–time graph is displacement.",
          "Newton's second law in full: force equals rate of change of momentum, F = Δp/Δt, reducing to F = ma at constant mass.",
          "Newton's third law pairs are equal, opposite, of the same type and act on different bodies.",
          "For projectiles, resolve into independent horizontal (constant velocity) and vertical (constant acceleration) components.",
        ],
        commonErrors: [
          "Treating weight and the normal contact force as a Newton's third law pair.",
          "Forgetting that a body at terminal velocity has zero resultant force, not zero force.",
          "Mixing up distance and displacement for motion that reverses.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "energy-power",
        title: "Energy, work and power",
        specRef: "Unit 1.4",
        difficulty: 2,
        summary:
          "Work done by a force, kinetic and gravitational potential energy, conservation of energy, power and efficiency, including work from a force–displacement graph.",
        keyPoints: [
          "W = Fs cosθ — only the component of force along the displacement does work.",
          "Efficiency = useful output ÷ total input, always ≤ 1.",
          "P = Fv for a constant force at constant velocity.",
          "The area under a force–displacement graph is the work done.",
        ],
        commonErrors: [
          "Omitting cosθ when the force is at an angle.",
          "Quoting an efficiency above 100% after a unit slip.",
          "Saying energy is 'lost' rather than dissipated, usually as heat.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "materials",
        title: "Solids under stress",
        specRef: "Unit 1.5",
        difficulty: 3,
        summary:
          "Hooke's law, the spring constant, stress, strain and the Young modulus, elastic and plastic behaviour, and energy stored in a stretched material.",
        keyPoints: [
          "Stress = F/A, strain = Δl/l, Young modulus E = stress/strain.",
          "Elastic strain energy = ½Fx = area under a force–extension graph.",
          "Brittle materials fracture without plastic deformation; ductile ones show a large plastic region.",
          "The limit of proportionality precedes the elastic limit — they are not the same point.",
        ],
        commonErrors: [
          "Using diameter instead of radius in the cross-sectional area.",
          "Reading the Young modulus off a force–extension rather than a stress–strain graph.",
          "Confusing the elastic limit with the yield point.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "waves",
        title: "Waves, superposition and optics",
        specRef: "Unit 2.1–2.3",
        difficulty: 3,
        summary:
          "Transverse and longitudinal waves, the wave equation, refraction and total internal reflection, polarisation, superposition, stationary waves and diffraction gratings.",
        keyPoints: [
          "v = fλ, and the frequency of a wave is unchanged when it refracts.",
          "Two-source interference: dλ = ax/D for Young's slits; nλ = d sinθ for a grating.",
          "Stationary waves need two identical waves travelling in opposite directions; nodes are always λ/2 apart.",
          "Total internal reflection requires light in the denser medium and an angle beyond the critical angle, sin C = 1/n.",
        ],
        commonErrors: [
          "Saying wavelength stays the same on refraction (it is frequency that does).",
          "Mixing up slit separation and grating spacing d = 1/N.",
          "Describing a node as a point of maximum displacement.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "quantum",
        title: "Photons and the photoelectric effect",
        specRef: "Unit 2.5",
        difficulty: 4,
        summary:
          "The photon model, the photoelectric equation, work function and threshold frequency, wave–particle duality and de Broglie wavelength, and atomic energy levels.",
        keyPoints: [
          "E = hf = hc/λ, and hf = φ + ½mv²max.",
          "Below the threshold frequency no electrons are emitted however intense the light — this is what the wave model cannot explain.",
          "Increasing intensity increases the number of photoelectrons, not their maximum kinetic energy.",
          "de Broglie: λ = h/p, confirmed by electron diffraction.",
        ],
        commonErrors: [
          "Saying brighter light gives faster electrons.",
          "Forgetting to convert eV to joules (1 eV = 1.6 × 10⁻¹⁹ J).",
          "Using the work function as an energy per mole.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
    ],
  },
  {
    slug: "fields-nuclear",
    title: "Electricity, Fields and Nuclear Physics",
    topics: [
      {
        slug: "electric-circuits",
        title: "Electric circuits",
        specRef: "Unit 2.4",
        difficulty: 3,
        summary:
          "Current, potential difference and resistance, Kirchhoff's laws, resistivity, EMF and internal resistance, potential dividers, and the I–V characteristics of components.",
        keyPoints: [
          "Kirchhoff: charge is conserved at a junction, energy is conserved around a loop.",
          "ε = I(R + r): the terminal p.d. falls as current rises because of lost volts Ir.",
          "Resistivity ρ = RA/L — a material property, unlike resistance.",
          "A filament lamp's resistance rises with temperature, giving a curved I–V characteristic.",
        ],
        commonErrors: [
          "Treating EMF and terminal p.d. as identical.",
          "Using length in cm in a resistivity calculation.",
          "Adding parallel resistances directly.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "momentum",
        title: "Momentum and collisions",
        specRef: "Unit 3.1",
        difficulty: 3,
        summary:
          "Linear momentum, impulse, conservation of momentum in one and two dimensions, and elastic versus inelastic collisions.",
        keyPoints: [
          "Momentum is conserved in any collision in a closed system; kinetic energy is conserved only in elastic ones.",
          "Impulse = FΔt = Δp = the area under a force–time graph.",
          "Momentum is a vector — assign and keep a sign convention.",
          "In two dimensions, conserve momentum in each perpendicular direction separately.",
        ],
        commonErrors: [
          "Assuming kinetic energy is conserved in every collision.",
          "Dropping the direction sign for a rebounding object, halving the calculated impulse.",
          "Using speed rather than velocity components in 2D problems.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "circular-shm",
        title: "Circular motion and simple harmonic motion",
        specRef: "Unit 3.2–3.3",
        difficulty: 4,
        summary:
          "Angular velocity, centripetal acceleration and force, the conditions for SHM, displacement/velocity/acceleration relationships, energy in SHM, damping and resonance.",
        keyPoints: [
          "a = v²/r = ω²r, directed toward the centre; the centripetal force is provided by a real force, not an extra one.",
          "SHM requires a = −ω²x: acceleration proportional to displacement and directed toward equilibrium.",
          "T = 2π√(l/g) for a simple pendulum; T = 2π√(m/k) for a mass–spring system.",
          "Resonance occurs when the driving frequency equals the natural frequency; damping reduces and broadens the peak.",
        ],
        commonErrors: [
          "Adding 'centripetal force' to a free-body diagram as if it were a separate force.",
          "Losing the minus sign in a = −ω²x and so the direction of acceleration.",
          "Using degrees for ω in radian-based formulae.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "fields",
        title: "Gravitational, electric and magnetic fields",
        specRef: "Unit 3.4–3.6",
        difficulty: 5,
        summary:
          "Newton's law of gravitation and Coulomb's law, field strength and potential, orbits, the motion of charges in magnetic fields, electromagnetic induction and Faraday's and Lenz's laws.",
        keyPoints: [
          "Gravitational and electric fields are both inverse-square, but gravity is always attractive while electric forces can repel.",
          "Field strength is a vector (force per unit mass/charge); potential is a scalar and is zero at infinity.",
          "F = BIL sinθ for a current-carrying conductor; F = BQv for a moving charge, giving circular motion.",
          "Faraday: induced EMF = rate of change of flux linkage; Lenz: the induced effect opposes the change causing it.",
        ],
        commonErrors: [
          "Forgetting that gravitational potential is negative everywhere.",
          "Using r as height above the surface instead of distance from the centre.",
          "Omitting the minus sign or the opposition statement when quoting Lenz's law.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "thermal",
        title: "Thermal physics and gases",
        specRef: "Unit 4.1–4.2",
        difficulty: 4,
        summary:
          "Internal energy, specific heat capacity and latent heat, the ideal gas laws, kinetic theory and the link between temperature and mean molecular kinetic energy.",
        keyPoints: [
          "Q = mcΔT for a temperature change; Q = mL for a change of state at constant temperature.",
          "pV = nRT = NkT, with temperature always in kelvin.",
          "Kinetic theory: ½m⟨c²⟩ = (3/2)kT, so absolute temperature is a measure of mean molecular kinetic energy.",
          "Internal energy is the sum of the random kinetic and potential energies of the molecules.",
        ],
        commonErrors: [
          "Working in °C in a gas law.",
          "Applying Q = mcΔT during melting or boiling.",
          "Saying 'heat' when internal energy or temperature is meant.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
      {
        slug: "nuclear",
        title: "Nuclear and particle physics",
        specRef: "Unit 4.3–4.5",
        difficulty: 4,
        summary:
          "Rutherford scattering, nuclear radius, radioactive decay and half-life, mass–energy equivalence, fission and fusion, and the quark model of hadrons.",
        keyPoints: [
          "Activity A = λN and N = N₀e^(−λt), with half-life t½ = ln2/λ.",
          "ΔE = Δmc²; binding energy per nucleon peaks near iron-56, which is why both fission and fusion can release energy.",
          "Baryons are three quarks, mesons a quark–antiquark pair; charge, baryon number and lepton number are conserved.",
          "β⁻ decay converts a neutron into a proton, emitting an electron and an antineutrino.",
        ],
        commonErrors: [
          "Using half-life in the exponential formula without converting to the decay constant.",
          "Forgetting the antineutrino in β⁻ decay and breaking lepton-number conservation.",
          "Confusing binding energy with binding energy per nucleon when comparing nuclei.",
        ],
        source: "authored",
        verification: "checked",
        lastChecked: "2026-08-01",
        specVersion: "2024-1.0",
        aos: ["AO1", "AO2"],
      },
    ],
  },
]);

export const wjecPhysics: CurriculumModule = registerSubject({
  subject: {
    id: SUBJECT_ID,
    qualificationId: "wjec-alevel",
    name: "Physics",
    specCode: "A200QS",
    papers: [
      { id: `${SUBJECT_ID}.u3`, name: "Unit 3: Oscillations and Nuclei", weight: 0.25, durationMinutes: 135, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.u4`, name: "Unit 4: Fields and Options", weight: 0.25, durationMinutes: 120, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.u5`, name: "Unit 5: Practical Examination", weight: 0.1, durationMinutes: 180, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.as`, name: "AS Units 1 & 2", weight: 0.4, durationMinutes: 210, calculatorAllowed: true },
    ],
    gradeBoundaries: A_LEVEL_BOUNDARIES,
    spec: { version: "2024-1.0", releaseDate: "2024-09-01", lastChecked: "2026-08-01", url: "https://www.wjec.co.uk/qualifications/" },
  },
  units,
  topics,
});
