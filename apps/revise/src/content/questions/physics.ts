import { defineQuestions } from "./authoring";

const S = "wjec-alevel-physics";

export const physicsQuestions = defineQuestions([
  {
    slug: "phys-photoelectric",
    subjectId: S,
    topics: ["quantum"],
    stem: "A metal surface has a work function of 2.30 eV. Light of wavelength 400 nm is shone onto it. (h = 6.63 × 10⁻³⁴ J s, c = 3.00 × 10⁸ m s⁻¹, e = 1.60 × 10⁻¹⁹ C)",
    difficulty: 4,
    parts: [
      {
        prompt: "Calculate the maximum kinetic energy of the emitted photoelectrons in joules.",
        marks: 4,
        scheme: [
          "Photon energy E = hc/lambda = 4.97 x 10^-19 J",
          "Converts the work function: 2.30 x 1.60 x 10^-19 = 3.68 x 10^-19 J",
          "Uses hf = work function + maximum kinetic energy",
          "Maximum kinetic energy = 1.29 x 10^-19 J",
        ],
        answer:
          "E = hc/λ = (6.63 × 10⁻³⁴ × 3.00 × 10⁸)/(400 × 10⁻⁹) = 4.97 × 10⁻¹⁹ J. Work function φ = 2.30 × 1.60 × 10⁻¹⁹ = 3.68 × 10⁻¹⁹ J. From hf = φ + KEmax, KEmax = 4.97 × 10⁻¹⁹ − 3.68 × 10⁻¹⁹ = 1.29 × 10⁻¹⁹ J.",
      },
      {
        prompt: "The intensity of the light is doubled. State and explain the effect on the maximum kinetic energy of the photoelectrons.",
        marks: 2,
        scheme: [
          "There is no change to the maximum kinetic energy",
          "Intensity increases the number of photons per second, not the energy of each photon, which depends only on frequency",
        ],
        answer:
          "There is no change. Doubling the intensity doubles the number of photons arriving each second, so more photoelectrons are emitted per second, but each photon still has the same energy hf. Maximum kinetic energy depends only on the frequency and the work function.",
      },
    ],
  },
  {
    slug: "phys-shm-pendulum",
    subjectId: S,
    topics: ["circular-shm"],
    stem: "A simple pendulum of length 0.85 m oscillates with small amplitude. Take g = 9.81 m s⁻².",
    difficulty: 3,
    parts: [
      {
        prompt: "Calculate the period of oscillation.",
        marks: 3,
        scheme: [
          "Uses T = 2 pi times the square root of (l/g)",
          "Substitutes 0.85 and 9.81 correctly",
          "T = 1.85 s (accept 1.8 to 1.9)",
        ],
        answer: "T = 2π√(l/g) = 2π√(0.85/9.81) = 2π × 0.2944 = 1.85 s.",
      },
      {
        prompt: "State the condition on the displacement for the motion to be simple harmonic, and explain why this fails for large amplitudes.",
        marks: 3,
        scheme: [
          "Acceleration is proportional to displacement and directed toward the equilibrium position (a = -omega^2 x)",
          "For a pendulum the restoring force is proportional to sin theta, not theta",
          "sin theta is approximately theta only for small angles, so SHM is only an approximation at large amplitude",
        ],
        answer:
          "SHM requires a = −ω²x: the acceleration is proportional to displacement from equilibrium and directed toward it. For a pendulum the restoring force is −mg sinθ, which is proportional to sinθ rather than to θ. Since sinθ ≈ θ only for small angles (in radians), the motion is simple harmonic only for small amplitudes.",
      },
    ],
  },
  {
    slug: "phys-emf-internal",
    subjectId: S,
    topics: ["electric-circuits"],
    stem: "A cell of EMF 1.50 V and internal resistance 0.80 Ω is connected to a 4.20 Ω resistor.",
    difficulty: 3,
    parts: [
      {
        prompt: "Calculate the current in the circuit.",
        marks: 3,
        scheme: [
          "Uses EMF = I(R + r)",
          "Substitutes 1.50 = I(4.20 + 0.80)",
          "I = 0.30 A",
        ],
        answer: "ε = I(R + r), so 1.50 = I(4.20 + 0.80) = 5.00I, giving I = 0.30 A.",
      },
      {
        prompt: "Calculate the terminal potential difference and explain why it is less than the EMF.",
        marks: 3,
        scheme: [
          "Terminal p.d. = IR = 0.30 x 4.20 = 1.26 V",
          "Some energy is dissipated inside the cell against the internal resistance",
          "The lost volts equal Ir = 0.24 V",
        ],
        answer:
          "V = IR = 0.30 × 4.20 = 1.26 V. It is less than the EMF because energy is dissipated inside the cell against its internal resistance; the lost volts are Ir = 0.30 × 0.80 = 0.24 V, and 1.26 + 0.24 = 1.50 V.",
      },
    ],
  },
  {
    slug: "phys-momentum-collision",
    subjectId: S,
    topics: ["momentum"],
    stem: "A 0.150 kg ball travelling at 12.0 m s⁻¹ strikes a wall perpendicularly and rebounds at 9.00 m s⁻¹. The contact time is 25.0 ms.",
    difficulty: 3,
    parts: [
      {
        prompt: "Calculate the magnitude of the average force exerted on the ball by the wall.",
        marks: 4,
        scheme: [
          "Recognises that velocity reverses direction, so the change in momentum uses 12.0 - (-9.00)",
          "Change in momentum = 0.150 x 21.0 = 3.15 kg m s^-1",
          "Uses F = change in momentum divided by time",
          "F = 3.15 / 0.0250 = 126 N",
        ],
        answer:
          "Taking the initial direction as positive, Δp = m(v − u) = 0.150(−9.00 − 12.0) = −3.15 kg m s⁻¹, so the magnitude is 3.15 kg m s⁻¹. F = Δp/Δt = 3.15/0.0250 = 126 N.",
      },
      {
        prompt: "State whether the collision is elastic and justify your answer.",
        marks: 2,
        scheme: [
          "It is inelastic",
          "Kinetic energy after (6.08 J) is less than before (10.8 J), so kinetic energy is not conserved",
        ],
        answer:
          "It is inelastic. Kinetic energy before = ½(0.150)(12.0)² = 10.8 J; after = ½(0.150)(9.00)² = 6.08 J. Kinetic energy is not conserved, although momentum is conserved for the ball–wall–Earth system.",
      },
    ],
  },
  {
    slug: "phys-mcq-fields",
    subjectId: S,
    topics: ["fields"],
    stem: "A satellite is moved from an orbit of radius r to one of radius 2r. By what factor does the gravitational force on it change?",
    options: ["It halves", "It quarters", "It doubles", "It is unchanged"],
    correctIndex: 1,
    difficulty: 2,
    parts: [
      {
        prompt: "Select the correct option.",
        marks: 1,
        scheme: ["Gravitational force follows an inverse square law, so doubling r divides the force by four"],
        answer:
          "F = GMm/r² is an inverse-square law. Doubling r multiplies r² by four, so the force falls to a quarter of its original value.",
      },
    ],
  },
  {
    slug: "phys-nuclear-decay",
    subjectId: S,
    topics: ["nuclear"],
    stem: "A radioactive isotope has a half-life of 5.27 years. A sample initially contains 8.00 × 10²⁰ atoms.",
    difficulty: 4,
    parts: [
      {
        prompt: "Calculate the decay constant in s⁻¹.",
        marks: 3,
        scheme: [
          "Uses decay constant = ln2 / half-life",
          "Converts the half-life to seconds: 5.27 x 3.15 x 10^7 = 1.66 x 10^8 s",
          "Decay constant = 4.17 x 10^-9 s^-1",
        ],
        answer:
          "λ = ln2/t½. In seconds, t½ = 5.27 × 365 × 24 × 3600 = 1.66 × 10⁸ s. So λ = 0.693/1.66 × 10⁸ = 4.17 × 10⁻⁹ s⁻¹.",
      },
      {
        prompt: "Calculate the initial activity of the sample in becquerels.",
        marks: 2,
        scheme: [
          "Uses A = decay constant x N",
          "A = 4.17 x 10^-9 x 8.00 x 10^20 = 3.34 x 10^12 Bq",
        ],
        answer: "A = λN = 4.17 × 10⁻⁹ × 8.00 × 10²⁰ = 3.34 × 10¹² Bq.",
      },
    ],
  },
]);
