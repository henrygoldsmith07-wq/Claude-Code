/**
 * Feature reachability matrix — every user-facing capability, its entry
 * point, whether it's core or optional, and how to reach it from a fresh
 * onboarding. This is the source of truth for what "reachable" means.
 *
 * The optional-tools bug happened because AddToolsPanel existed but was
 * never mounted — tests passed, UI worked in isolation, but no user could
 * find it. This matrix prevents that by making reachability a tested
 * invariant, not an assumption.
 */

export const FEATURE_MATRIX = [
  // Core loop — reachable without any tool enablement
  { id: 'meal-planner', name: 'Meal planner', entry: 'Plan tab', core: true, toolId: null, primaryAction: 'Generate a plan and see meals' },
  { id: 'shopping-list', name: 'Shopping list', entry: 'Shop tab', core: true, toolId: null, primaryAction: 'Add an item and tick it off' },
  { id: 'pantry', name: 'Pantry', entry: 'Pantry tab', core: true, toolId: null, primaryAction: 'See pantry items' },
  { id: 'recipes', name: 'Recipes', entry: 'Recipes tab', core: true, toolId: null, primaryAction: 'Browse and open a recipe' },
  { id: 'food-log', name: 'Food diary', entry: 'Log tab', core: true, toolId: null, primaryAction: 'Add a food entry' },
  { id: 'home', name: 'Home dashboard', entry: 'Home tab', core: true, toolId: null, primaryAction: 'See today\u2019s summary' },

  // Optional tools — require explicit enablement via Profile → Tools
  { id: 'receipt-capture', name: 'Receipt capture', entry: 'Add tools → Shop → Read a receipt', core: false, toolId: 'receipt', primaryAction: 'Paste receipt text and parse items' },
  { id: 'carbon', name: 'Carbon footprint', entry: 'Add tools → Guidance → Planet', core: false, toolId: 'carbon', primaryAction: 'See CO₂e estimate from logged food' },
  { id: 'reports', name: 'Reports', entry: 'Add tools → Analytics → Reports', core: false, toolId: 'reports', primaryAction: 'View spending/nutrition reports' },
  { id: 'coach', name: 'Coach sharing', entry: 'Add tools → Family → Coach access', core: false, toolId: 'coach', primaryAction: 'Share data with a coach via link' },
  { id: 'exercise', name: 'Exercise log', entry: 'Add tools → Log → Exercise', core: false, toolId: 'exercise', primaryAction: 'Log a workout' },
  { id: 'cycle', name: 'Cycle tracking', entry: 'Add tools → Health → Cycle', core: false, toolId: 'cycle', primaryAction: 'Record a cycle start date' },
  { id: 'bloods', name: 'Blood results', entry: 'Add tools → Results', core: false, toolId: 'bloods', primaryAction: 'Import or type blood results' },
  { id: 'fasting', name: 'Fasting timer', entry: 'Add tools → Fasting', core: false, toolId: 'fasting', primaryAction: 'Start a fast' },
];
