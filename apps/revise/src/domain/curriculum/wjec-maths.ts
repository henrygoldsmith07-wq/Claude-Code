import { A_LEVEL_BOUNDARIES, buildUnits } from "./helpers";
import { registerSubject } from "./registry";
import type { CurriculumModule } from "./registry";

// WJEC A Level Mathematics (A00-A60). Topic grouping follows the broad
// content areas of the specification; always check the current WJEC spec
// document for exact assessment objectives and weightings.
const SUBJECT_ID = "wjec-alevel-maths";

const { units, topics } = buildUnits(SUBJECT_ID, [
  {
    slug: "pure",
    title: "Pure Mathematics",
    topics: [
      {
        slug: "proof",
        title: "Proof and mathematical language",
        specRef: "Pure 1.1",
        difficulty: 3,
        summary:
          "Constructing and presenting rigorous arguments: deduction, exhaustion, counter-example and proof by contradiction, together with the correct use of ⇒, ⇐ and ⇔.",
        keyPoints: [
          "Proof by deduction chains statements from a definition or known result to the required conclusion.",
          "Proof by exhaustion is valid only when the cases genuinely cover every possibility.",
          "One counter-example disproves a universal statement; no number of examples proves it.",
          "Proof by contradiction assumes the negation and derives an impossibility — classic results: √2 is irrational, there are infinitely many primes.",
        ],
        commonErrors: [
          "Writing ⇒ where ⇔ is required (or vice versa) and losing the reasoning mark.",
          "Assuming the result inside the proof rather than deriving it.",
          "Stopping a contradiction proof without stating the contradiction explicitly.",
        ],
      },
      {
        slug: "algebra",
        title: "Algebra and functions",
        specRef: "Pure 1.2",
        difficulty: 2,
        summary:
          "Indices, surds, quadratics, simultaneous equations, inequalities, polynomial division, partial fractions and curve sketching including transformations and modulus.",
        keyPoints: [
          "The discriminant b² − 4ac fixes the number of real roots: >0 two, =0 one repeated, <0 none.",
          "Completing the square gives the vertex directly: a(x + p)² + q has vertex (−p, q).",
          "The factor theorem: (x − a) is a factor of f(x) if and only if f(a) = 0.",
          "y = f(x + a) shifts left by a; y = f(x) + a shifts up by a; y = af(x) stretches vertically by a.",
        ],
        commonErrors: [
          "Multiplying an inequality by a negative without reversing the sign.",
          "Cancelling a factor that may be zero and losing a root.",
          "Confusing horizontal translation direction: f(x + 2) moves left, not right.",
        ],
      },
      {
        slug: "coordinate-geometry",
        title: "Coordinate geometry and circles",
        specRef: "Pure 1.3",
        difficulty: 2,
        summary:
          "Straight lines, parallel and perpendicular gradients, the equation of a circle (x − a)² + (y − b)² = r², tangents, chords and parametric equations.",
        keyPoints: [
          "Perpendicular gradients multiply to −1.",
          "A tangent to a circle is perpendicular to the radius at the point of contact.",
          "The perpendicular bisector of any chord passes through the centre.",
          "Parametric curves: eliminate the parameter, or differentiate with dy/dx = (dy/dt)/(dx/dt).",
        ],
        commonErrors: [
          "Reading the centre off (x − a)² + (y − b)² = r² with the wrong signs.",
          "Forgetting to square-root to get r from r².",
          "Using the chord gradient instead of the radius gradient for a tangent.",
        ],
      },
      {
        slug: "sequences",
        title: "Sequences, series and binomial expansion",
        specRef: "Pure 1.4",
        difficulty: 3,
        summary:
          "Arithmetic and geometric sequences, sigma notation, convergence conditions, recurrence relations, and the binomial expansion for positive integer and general rational indices.",
        keyPoints: [
          "Arithmetic: Sₙ = n/2 (2a + (n − 1)d). Geometric: Sₙ = a(1 − rⁿ)/(1 − r).",
          "A geometric series converges to a/(1 − r) if and only if |r| < 1.",
          "(1 + x)ⁿ for non-integer n is valid only for |x| < 1 — state the range of validity.",
          "For (a + bx)ⁿ, factor out aⁿ first so the bracket is in (1 + …) form.",
        ],
        commonErrors: [
          "Omitting the validity condition |x| < 1 on a general binomial expansion.",
          "Using the nth term formula when the sum is asked for.",
          "Sign slips expanding (1 − x)ⁿ.",
        ],
      },
      {
        slug: "trigonometry",
        title: "Trigonometry and identities",
        specRef: "Pure 1.5",
        difficulty: 4,
        summary:
          "Radians, exact values, sine and cosine rules, small-angle approximations, the reciprocal and inverse functions, compound and double-angle formulae and R cos(θ ± α) form.",
        keyPoints: [
          "sin²θ + cos²θ = 1, and dividing by cos²θ gives 1 + tan²θ = sec²θ.",
          "cos2θ has three forms — choose the one that leaves only the function you need.",
          "a sinθ + b cosθ = R sin(θ + α) with R = √(a² + b²), tanα = b/a.",
          "For small θ in radians: sinθ ≈ θ, tanθ ≈ θ, cosθ ≈ 1 − θ²/2.",
        ],
        commonErrors: [
          "Working in degrees when the question is in radians (or vice versa).",
          "Losing solutions by dividing through by a trig factor instead of factorising.",
          "Not giving every solution inside the stated interval.",
        ],
      },
      {
        slug: "exponentials",
        title: "Exponentials and logarithms",
        specRef: "Pure 1.6",
        difficulty: 3,
        summary:
          "The function eˣ and its gradient property, natural logarithms, laws of logs, exponential growth and decay models, and linearising data with log–log or log–linear plots.",
        keyPoints: [
          "d/dx(eᵏˣ) = keᵏˣ and d/dx(ln x) = 1/x.",
          "log a + log b = log ab; log a − log b = log(a/b); n log a = log aⁿ.",
          "y = axⁿ ⇒ log y = log a + n log x, so a log–log plot is a straight line of gradient n.",
          "y = abˣ ⇒ log y = log a + x log b, so plot log y against x.",
        ],
        commonErrors: [
          "Writing log(a + b) = log a + log b.",
          "Taking logs of a negative quantity.",
          "Mixing up which variable to plot when linearising.",
        ],
      },
      {
        slug: "differentiation",
        title: "Differentiation",
        specRef: "Pure 1.7",
        difficulty: 4,
        summary:
          "Differentiation from first principles, the chain, product and quotient rules, implicit and parametric differentiation, stationary points, and connected rates of change.",
        keyPoints: [
          "First principles: f′(x) = lim(h→0) [f(x + h) − f(x)]/h.",
          "Product rule (uv)′ = u′v + uv′; quotient rule (u/v)′ = (u′v − uv′)/v².",
          "Stationary points need f′(x) = 0; classify with f″(x) or a sign change in f′.",
          "Connected rates: dy/dt = (dy/dx)(dx/dt).",
        ],
        commonErrors: [
          "Forgetting the inner derivative in the chain rule.",
          "Reversing the numerator of the quotient rule.",
          "Concluding a point of inflection from f″(x) = 0 without checking the sign change.",
        ],
      },
      {
        slug: "integration",
        title: "Integration and differential equations",
        specRef: "Pure 1.8",
        difficulty: 4,
        summary:
          "Standard integrals, substitution, integration by parts, partial fractions, areas and volumes of revolution, the trapezium rule, and separable first-order differential equations.",
        keyPoints: [
          "∫ f′(x)/f(x) dx = ln|f(x)| + c.",
          "Parts: ∫u dv = uv − ∫v du — choose u by LATE (log, algebra, trig, exponential).",
          "Separate variables, integrate both sides, then use the boundary condition to fix c.",
          "Area below the axis is negative — split the integral at the roots when total area is asked for.",
        ],
        commonErrors: [
          "Omitting + c on an indefinite integral.",
          "Not changing the limits after a substitution.",
          "Treating ∫(1/x) as ln x without the modulus.",
        ],
      },
      {
        slug: "vectors",
        title: "Vectors",
        specRef: "Pure 1.9",
        difficulty: 3,
        summary:
          "Vectors in two and three dimensions, magnitude and direction, position vectors, the vector equation of a line, and geometric problems including collinearity.",
        keyPoints: [
          "|a| = √(x² + y² + z²).",
          "A line has vector equation r = a + λd where d is the direction vector.",
          "Points A, B, C are collinear if AB and BC are parallel — one is a scalar multiple of the other.",
          "Unit vector â = a/|a|.",
        ],
        commonErrors: [
          "Adding position vectors when the displacement vector is meant.",
          "Assuming lines intersect in 3D because their equations share a solution in two components.",
          "Dropping the third component in a magnitude calculation.",
        ],
      },
      {
        slug: "numerical",
        title: "Numerical methods",
        specRef: "Pure 1.10",
        difficulty: 3,
        summary:
          "Locating roots by sign change, fixed-point iteration and cos-web/staircase diagrams, the Newton–Raphson method, and numerical integration with the trapezium rule.",
        keyPoints: [
          "A sign change of a continuous f over [a, b] guarantees a root in that interval.",
          "Newton–Raphson: xₙ₊₁ = xₙ − f(xₙ)/f′(xₙ).",
          "Newton–Raphson fails near a stationary point where f′(xₙ) ≈ 0.",
          "The trapezium rule over-estimates for a convex (concave-up) curve.",
        ],
        commonErrors: [
          "Not stating that f is continuous when using a sign change.",
          "Rounding intermediate iterates and losing the required accuracy.",
          "Giving the wrong direction of trapezium-rule error.",
        ],
      },
    ],
  },
  {
    slug: "applied",
    title: "Statistics and Mechanics",
    topics: [
      {
        slug: "statistical-sampling",
        title: "Sampling and data presentation",
        specRef: "Applied 2.1",
        difficulty: 2,
        summary:
          "Populations and samples, random/systematic/stratified/opportunity/quota sampling, measures of location and spread, outliers, box plots, cumulative frequency and the large data set.",
        keyPoints: [
          "A census covers the whole population; a sample estimates it and carries sampling error.",
          "Standard outlier rule: more than 1.5 × IQR beyond a quartile.",
          "Interpolation is required for a median or quartile from grouped data.",
          "Coding y = (x − a)/b: mean codes the same way, standard deviation divides by b only.",
        ],
        commonErrors: [
          "Adding the coding constant back into the standard deviation.",
          "Reading class boundaries rather than midpoints when estimating a mean.",
          "Describing a sampling method without saying how the frame is constructed.",
        ],
      },
      {
        slug: "probability",
        title: "Probability",
        specRef: "Applied 2.2",
        difficulty: 3,
        summary:
          "Sample spaces, Venn and tree diagrams, mutually exclusive and independent events, conditional probability and the multiplication rule.",
        keyPoints: [
          "P(A ∪ B) = P(A) + P(B) − P(A ∩ B).",
          "Independent ⇔ P(A ∩ B) = P(A)P(B).",
          "Conditional: P(A|B) = P(A ∩ B)/P(B).",
          "Mutually exclusive events cannot be independent unless one has probability zero.",
        ],
        commonErrors: [
          "Treating 'mutually exclusive' and 'independent' as the same thing.",
          "Forgetting to reduce the denominator for sampling without replacement.",
          "Inverting the condition in P(A|B).",
        ],
      },
      {
        slug: "distributions",
        title: "Statistical distributions and hypothesis testing",
        specRef: "Applied 2.3",
        difficulty: 4,
        summary:
          "The binomial and normal distributions, the normal approximation to the binomial, hypothesis tests for a binomial proportion, a normal mean and a correlation coefficient.",
        keyPoints: [
          "X ~ B(n, p) needs fixed n, constant p, independent trials, two outcomes.",
          "X ~ N(μ, σ²): standardise with Z = (X − μ)/σ.",
          "State H₀ and H₁, compare p-value with the significance level, then conclude in context.",
          "Never 'accept H₀' — there is insufficient evidence to reject it.",
        ],
        commonErrors: [
          "Using the wrong tail, or halving the significance level for a one-tailed test.",
          "Concluding in statistical language only and dropping the contextual mark.",
          "Applying the binomial model where trials are not independent.",
        ],
      },
      {
        slug: "kinematics",
        title: "Kinematics",
        specRef: "Applied 2.4",
        difficulty: 3,
        summary:
          "Motion in a straight line and in two dimensions, the suvat equations for constant acceleration, calculus for variable acceleration, and projectile motion.",
        keyPoints: [
          "suvat applies only while acceleration is constant.",
          "Variable acceleration: v = ds/dt, a = dv/dt, and integrate to reverse.",
          "Projectiles: horizontal and vertical components are independent and share only time.",
          "The gradient of a velocity–time graph is acceleration; the area under it is displacement.",
        ],
        commonErrors: [
          "Using suvat across a stage where acceleration changes.",
          "Mixing sign conventions between up-positive and down-positive.",
          "Confusing distance travelled with displacement when the direction reverses.",
        ],
      },
      {
        slug: "forces",
        title: "Forces, Newton's laws and moments",
        specRef: "Applied 2.5",
        difficulty: 4,
        summary:
          "Force diagrams, Newton's three laws, connected particles, friction and the coefficient of friction, and moments for rigid bodies in equilibrium.",
        keyPoints: [
          "F = ma applied along each direction separately, resolving where needed.",
          "Limiting friction F = μR, and F ≤ μR when not yet slipping.",
          "In equilibrium the resultant force and the resultant moment about any point are both zero.",
          "Newton's third law pairs act on different bodies — never on the same one.",
        ],
        commonErrors: [
          "Including the tension on both sides of a connected-particle equation for one body.",
          "Using F = μR when the object is stationary and friction is not limiting.",
          "Taking moments about a point without stating it.",
        ],
      },
    ],
  },
]);

export const wjecMaths: CurriculumModule = registerSubject({
  subject: {
    id: SUBJECT_ID,
    qualificationId: "wjec-alevel",
    name: "Mathematics",
    specCode: "A00-A60",
    papers: [
      { id: `${SUBJECT_ID}.u3`, name: "Unit 3: Pure Mathematics B", weight: 0.3, durationMinutes: 150, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.u4`, name: "Unit 4: Applied Mathematics B", weight: 0.2, durationMinutes: 105, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.u1`, name: "Unit 1: Pure Mathematics A", weight: 0.25, durationMinutes: 150, calculatorAllowed: true },
      { id: `${SUBJECT_ID}.u2`, name: "Unit 2: Applied Mathematics A", weight: 0.25, durationMinutes: 105, calculatorAllowed: true },
    ],
    gradeBoundaries: A_LEVEL_BOUNDARIES,
  },
  units,
  topics,
});
