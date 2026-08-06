import { A_LEVEL_BOUNDARIES, buildUnits } from "./helpers";
import { registerSubject } from "./registry";
import type { CurriculumModule } from "./registry";

// WJEC A Level Chemistry (A100QS). Grouped by the specification's broad
// content areas; check the current WJEC spec for exact assessment objectives.
const SUBJECT_ID = "wjec-alevel-chemistry";

const { units, topics } = buildUnits(SUBJECT_ID, [
  {
    slug: "physical",
    title: "Physical Chemistry",
    topics: [
      {
        slug: "atomic-structure",
        title: "Atomic structure and the periodic table",
        specRef: "Unit 1.1",
        difficulty: 2,
        summary:
          "Sub-atomic particles, isotopes, mass spectrometry, electron configuration in sub-shells, and the periodic trends in ionisation energy and atomic radius.",
        keyPoints: [
          "Relative atomic mass = Σ(isotope mass × abundance) ÷ Σ(abundance).",
          "Fill sub-shells 1s 2s 2p 3s 3p 4s 3d 4p; 4s fills before 3d and empties first on ionisation.",
          "Ionisation energy rises across a period (greater nuclear charge, similar shielding) and falls down a group.",
          "The dips at Group 3 (p sub-shell starts) and Group 6 (paired p electrons repel) are evidence for sub-shells.",
        ],
        commonErrors: [
          "Writing 3d before 4s in the configuration of a transition metal ion.",
          "Explaining ionisation-energy trends without mentioning shielding and nuclear charge together.",
          "Forgetting the state symbols and the +1 charge in an ionisation energy equation.",
        ],
      },
      {
        slug: "moles",
        title: "Moles, formulae and equations",
        specRef: "Unit 1.4",
        difficulty: 3,
        summary:
          "The mole, molar mass, concentration, gas volumes and the ideal gas equation, empirical and molecular formulae, titration calculations, percentage yield and atom economy.",
        keyPoints: [
          "n = m/M, n = cV (V in dm³), and pV = nRT with SI units (Pa, m³, K).",
          "Empirical formula: divide percentage by Ar, then divide by the smallest ratio.",
          "Percentage yield = actual ÷ theoretical × 100; atom economy = Mr of desired product ÷ Mr of all products × 100.",
          "Identify the limiting reagent before calculating any yield.",
        ],
        commonErrors: [
          "Using cm³ instead of dm³ in n = cV.",
          "Forgetting to convert °C to K in pV = nRT.",
          "Calculating yield from the excess reagent instead of the limiting one.",
        ],
      },
      {
        slug: "bonding",
        title: "Bonding and structure",
        specRef: "Unit 1.5",
        difficulty: 3,
        summary:
          "Ionic, covalent, dative and metallic bonding, electronegativity and polarity, intermolecular forces, and the link between structure and physical properties.",
        keyPoints: [
          "Intermolecular force strength: van der Waals < permanent dipole < hydrogen bonding.",
          "VSEPR: electron pairs repel to maximum separation; lone pairs repel more than bonding pairs (≈2.5° per lone pair).",
          "Giant covalent and ionic lattices have high melting points; simple molecular substances have low ones because only the weak intermolecular forces break.",
          "A molecule with polar bonds can be non-polar overall if the dipoles cancel by symmetry (e.g. CO₂, CCl₄).",
        ],
        commonErrors: [
          "Saying covalent bonds break on melting a simple molecular solid.",
          "Drawing hydrogen bonds without the lone pair and the δ+ H on N, O or F.",
          "Giving a bond angle without stating the electron-pair geometry.",
        ],
      },
      {
        slug: "energetics",
        title: "Energetics and thermodynamics",
        specRef: "Unit 2.1 / 4.1",
        difficulty: 4,
        summary:
          "Enthalpy changes, calorimetry, Hess's law, bond enthalpies, Born–Haber cycles, entropy and Gibbs free energy.",
        keyPoints: [
          "q = mcΔT — use the mass of the solution, not the solid.",
          "Hess's law: the enthalpy change is independent of route; ΔH = Σ ΔHf(products) − Σ ΔHf(reactants).",
          "ΔG = ΔH − TΔS; a reaction is feasible when ΔG ≤ 0.",
          "Entropy rises with disorder: solid < liquid < gas, and with the number of gaseous moles.",
        ],
        commonErrors: [
          "Mixing J and kJ inside one calculation.",
          "Reversing the sign convention: exothermic is negative.",
          "Using ΔS in J K⁻¹ mol⁻¹ alongside ΔH in kJ mol⁻¹ without converting.",
        ],
      },
      {
        slug: "kinetics",
        title: "Kinetics and rate equations",
        specRef: "Unit 4.4",
        difficulty: 4,
        summary:
          "Collision theory, the Maxwell–Boltzmann distribution, catalysis, rate equations, orders of reaction, half-life, the rate-determining step and the Arrhenius equation.",
        keyPoints: [
          "Rate = k[A]ᵐ[B]ⁿ; orders come from experiment, never from the stoichiometric equation.",
          "A catalyst provides an alternative route of lower activation energy — it does not lower the energy of the reactants.",
          "A constant half-life is the signature of first order.",
          "The rate equation reveals the species in (and up to) the rate-determining step.",
        ],
        commonErrors: [
          "Reading orders straight off the balanced equation.",
          "Saying a catalyst 'lowers the energy needed' without saying 'alternative route'.",
          "Omitting units when calculating k.",
        ],
      },
      {
        slug: "equilibria",
        title: "Chemical equilibria, Kc and Kp",
        specRef: "Unit 4.5",
        difficulty: 4,
        summary:
          "Dynamic equilibrium, Le Chatelier's principle, the equilibrium constants Kc and Kp, and the effect of temperature, pressure, concentration and catalysts.",
        keyPoints: [
          "Only temperature changes the value of K; pressure and concentration shift the position, not the constant.",
          "Raising temperature shifts the equilibrium in the endothermic direction.",
          "Kp uses partial pressures: p(A) = mole fraction × total pressure.",
          "A catalyst speeds both directions equally and so changes nothing about the position of equilibrium.",
        ],
        commonErrors: [
          "Claiming a catalyst increases yield at equilibrium.",
          "Using initial rather than equilibrium amounts in a Kc calculation.",
          "Omitting the units of Kc/Kp, which depend on the stoichiometry.",
        ],
      },
      {
        slug: "acids-bases",
        title: "Acid–base equilibria, pH and buffers",
        specRef: "Unit 4.6",
        difficulty: 5,
        summary:
          "Brønsted–Lowry theory, strong and weak acids, Ka and pKa, pH calculations, buffer action, titration curves and indicator choice.",
        keyPoints: [
          "pH = −log₁₀[H⁺]; for a weak acid [H⁺] = √(Ka × [HA]).",
          "Kw = [H⁺][OH⁻] = 1.0 × 10⁻¹⁴ at 298 K — use it for strong bases.",
          "A buffer is a weak acid with its conjugate base; it resists pH change because each component removes added OH⁻ or H⁺.",
          "Choose an indicator whose range lies within the vertical section of the titration curve.",
        ],
        commonErrors: [
          "Treating a weak acid as fully dissociated.",
          "Forgetting that at the half-equivalence point pH = pKa.",
          "Using [OH⁻] directly as [H⁺] for a base.",
        ],
      },
      {
        slug: "redox",
        title: "Redox and electrode potentials",
        specRef: "Unit 4.7",
        difficulty: 4,
        summary:
          "Oxidation numbers, half-equations, redox titrations, standard electrode potentials, the electrochemical series and cell EMF.",
        keyPoints: [
          "Oxidation is loss of electrons and an increase in oxidation number.",
          "E°cell = E°(reduction, right-hand) − E°(oxidation, left-hand); a positive value means the reaction is feasible.",
          "Standard conditions: 298 K, 100 kPa, 1.00 mol dm⁻³ solutions, platinum electrode for gases.",
          "Balance half-equations with H⁺ and H₂O in acid, then combine so electrons cancel.",
        ],
        commonErrors: [
          "Subtracting the electrode potentials the wrong way round.",
          "Assuming a feasible reaction must be fast — thermodynamics is not kinetics.",
          "Losing the electron balance when combining half-equations.",
        ],
      },
    ],
  },
  {
    slug: "inorganic-organic",
    title: "Inorganic and Organic Chemistry",
    topics: [
      {
        slug: "periodicity",
        title: "Periodicity, Group 2 and Group 7",
        specRef: "Unit 2.3 / 2.4",
        difficulty: 3,
        summary:
          "Trends across period 3 and down Groups 2 and 7: reactivity, solubility, thermal stability, the halogens as oxidising agents and the halide ions as reducing agents.",
        keyPoints: [
          "Group 2 reactivity increases down the group as ionisation energy falls.",
          "Group 2 hydroxide solubility increases down the group; sulfate solubility decreases.",
          "Halogen oxidising power decreases down Group 7; halide reducing power increases.",
          "Concentrated H₂SO₄ with halides: NaCl gives HCl only, NaBr gives Br₂/SO₂, NaI gives I₂/H₂S — evidence of increasing reducing power.",
        ],
        commonErrors: [
          "Reversing the solubility trends for hydroxides and sulfates.",
          "Explaining reactivity by 'more shells' without linking to shielding and attraction.",
          "Omitting the observations (colour, gas) in a halide test answer.",
        ],
      },
      {
        slug: "transition-metals",
        title: "Transition metals and complex ions",
        specRef: "Unit 4.3",
        difficulty: 4,
        summary:
          "Variable oxidation states, complex ion formation, ligand substitution, colour and d-orbital splitting, catalysis and the shapes of complexes.",
        keyPoints: [
          "A transition metal forms at least one stable ion with a partially filled d sub-shell.",
          "Colour arises when d electrons absorb visible light and are promoted across the split d orbitals; the complementary colour is seen.",
          "Six-coordinate complexes are octahedral, four-coordinate usually tetrahedral (square planar for Ni²⁺/Pt²⁺ cases such as cisplatin).",
          "Ligand substitution can change coordination number and colour, e.g. [Cu(H₂O)₆]²⁺ blue → [CuCl₄]²⁻ yellow.",
        ],
        commonErrors: [
          "Calling Zn and Sc transition metals.",
          "Saying complexes are coloured because 'they contain d electrons' without the splitting/absorption mechanism.",
          "Forgetting the overall charge on a complex ion.",
        ],
      },
      {
        slug: "organic-basics",
        title: "Introduction to organic chemistry and isomerism",
        specRef: "Unit 2.6",
        difficulty: 3,
        summary:
          "Nomenclature, functional groups, homologous series, structural and stereoisomerism (E/Z and optical), and the language of reaction mechanisms.",
        keyPoints: [
          "E/Z isomerism requires a C=C with two different groups on each carbon.",
          "Optical isomers have a chiral carbon with four different groups and rotate plane-polarised light in opposite directions.",
          "Curly arrows show movement of an electron pair, starting at a bond or lone pair.",
          "Nucleophiles donate an electron pair; electrophiles accept one.",
        ],
        commonErrors: [
          "Drawing a curly arrow from the positive charge instead of the electron pair.",
          "Missing chirality because the four groups are drawn in an unfamiliar orientation.",
          "Naming substituents in the wrong order or numbering from the wrong end.",
        ],
      },
      {
        slug: "hydrocarbons",
        title: "Alkanes, alkenes and haloalkanes",
        specRef: "Unit 2.7",
        difficulty: 3,
        summary:
          "Free-radical substitution, electrophilic addition and Markovnikov's rule, nucleophilic substitution and elimination, and the environmental chemistry of the haloalkanes.",
        keyPoints: [
          "Free-radical substitution has initiation, propagation and termination steps — UV light is essential.",
          "Electrophilic addition to an unsymmetrical alkene follows the more stable carbocation (tertiary > secondary > primary).",
          "Nucleophilic substitution rate follows C–I > C–Br > C–Cl because bond enthalpy falls down the group.",
          "Aqueous OH⁻ favours substitution; hot ethanolic OH⁻ favours elimination.",
        ],
        commonErrors: [
          "Using bond polarity instead of bond enthalpy to explain haloalkane hydrolysis rates.",
          "Forgetting UV in the initiation step.",
          "Choosing the wrong major product by ignoring carbocation stability.",
        ],
      },
      {
        slug: "carbonyls-acids",
        title: "Alcohols, carbonyls and carboxylic acids",
        specRef: "Unit 3.5 / 4.8",
        difficulty: 4,
        summary:
          "Oxidation of alcohols, the reactions and tests for aldehydes and ketones, carboxylic acids and their derivatives including esters, acyl chlorides and amides.",
        keyPoints: [
          "Primary alcohol → aldehyde (distil off) → carboxylic acid (reflux); secondary → ketone; tertiary resists oxidation.",
          "Tollens' reagent gives a silver mirror with aldehydes but not ketones; Fehling's gives a red precipitate.",
          "Esterification is reversible and acid-catalysed; acyl chlorides react irreversibly and vigorously.",
          "The iodoform (triiodomethane) test is positive for a CH₃CO– or CH₃CH(OH)– group.",
        ],
        commonErrors: [
          "Not stating distillation vs reflux when the product depends on it.",
          "Writing that ketones are oxidised by Tollens'.",
          "Omitting the catalyst and reversible arrow in esterification.",
        ],
      },
      {
        slug: "aromatics-nitrogen",
        title: "Aromatic chemistry, amines and polymers",
        specRef: "Unit 4.9 / 4.10",
        difficulty: 5,
        summary:
          "Benzene's delocalised structure and evidence for it, electrophilic substitution, amines as bases and nucleophiles, amino acids, and addition and condensation polymers.",
        keyPoints: [
          "Delocalisation makes benzene more stable than the theoretical Kekulé structure by about 150 kJ mol⁻¹.",
          "Benzene undergoes electrophilic substitution, not addition, because substitution preserves the delocalised ring.",
          "Amine basicity depends on electron density at nitrogen: aliphatic > ammonia > aromatic.",
          "Condensation polymers (polyesters, polyamides) form with the loss of a small molecule and can be hydrolysed back.",
        ],
        commonErrors: [
          "Drawing benzene with three localised double bonds when explaining stability.",
          "Explaining amine basicity without reference to the lone pair's availability.",
          "Drawing a polymer repeat unit without the continuation bonds and n.",
        ],
      },
      {
        slug: "spectroscopy",
        title: "Analysis: spectroscopy and chromatography",
        specRef: "Unit 4.11",
        difficulty: 4,
        summary:
          "Mass spectrometry, infrared absorption, ¹H and ¹³C NMR (chemical shift, integration, splitting) and chromatographic separation for identifying organic structures.",
        keyPoints: [
          "The molecular ion peak gives Mr; the M+2 peak in a 3:1 ratio indicates chlorine.",
          "IR: broad 2500–3300 cm⁻¹ is a carboxylic acid O–H; sharp ~1700 cm⁻¹ is C=O.",
          "In ¹H NMR the number of peaks gives chemical environments, integration gives the H ratio, and n+1 splitting gives neighbouring H atoms.",
          "TMS is the reference at δ = 0; CDCl₃ is used so the solvent contributes no ¹H signal.",
        ],
        commonErrors: [
          "Counting environments from the formula rather than from symmetry.",
          "Applying n+1 splitting to hydrogens on the same carbon as each other.",
          "Confusing the fragment peaks with the molecular ion.",
        ],
      },
    ],
  },
]);

export const wjecChemistry: CurriculumModule = registerSubject({
  subject: {
    id: SUBJECT_ID,
    qualificationId: "wjec-alevel",
    name: "Chemistry",
    specCode: "A100QS",
    papers: [
      { id: `${SUBJECT_ID}.u3`, name: "Unit 3: Physical and Inorganic Chemistry", weight: 0.25, durationMinutes: 105, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.u4`, name: "Unit 4: Organic Chemistry and Analysis", weight: 0.25, durationMinutes: 105, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.u5`, name: "Unit 5: Practical Examination", weight: 0.1, durationMinutes: 150, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.as`, name: "AS Units 1 & 2", weight: 0.4, durationMinutes: 210, calculatorAllowed: true },
    ],
    gradeBoundaries: A_LEVEL_BOUNDARIES,
  },
  units,
  topics,
});
