import {
  generateWeeklyDigest,
  computeBurnoutRisk,
  getProductivityTrend,
  computeLeadingIndicators,
  computeLifeTensions,
  getAchievements,
} from '../lib/insights'

// Web Worker for heavy analytics computations
// Offloads CPU-intensive work from main thread

self.onmessage = async (event) => {
  const { type, data, taskId } = event.data

  try {
    let result

    switch (type) {
      case 'computeInsights': {
        const today = data.today
        result = {
          digest:       safeCall(() => generateWeeklyDigest(data.storeData, today), null),
          burnout:      safeCall(() => computeBurnoutRisk(data.storeData, today), 0),
          trend:        safeCall(() => getProductivityTrend(data.storeData), null),
          indicators:   safeCall(() => computeLeadingIndicators(data.storeData, today), null),
          tensions:     safeCall(() => computeLifeTensions(data.storeData, today), []),
          achievements: safeCall(() => getAchievements(data.storeData, today).filter(a => a.unlocked), []),
        }
        break
      }
      case 'calculateStreak':
        result = calculateStreak(data.log)
        break
      case 'filterAndSort':
        result = filterAndSort(data.items, data.filterFn, data.sortFn)
        break
      case 'calculateHabitAnalytics':
        result = calculateHabitAnalytics(data.habits)
        break
      case 'calculateGoalProgress':
        result = calculateGoalProgress(data.goals)
        break
      case 'generateWeeklyReport':
        result = generateWeeklyReport(data)
        break
      case 'calculateTDEE':
        result = calculateTDEE(data.logs, data.gender, data.age, data.height, data.weight)
        break
      default:
        throw new Error(`Unknown task type: ${type}`)
    }

    self.postMessage({
      taskId,
      success: true,
      result
    })
  } catch (error) {
    self.postMessage({
      taskId,
      success: false,
      error: error.message
    })
  }
}

function safeCall(fn, fallback) {
  try { return fn() } catch { return fallback }
}

// Calculate current streak from log
function calculateStreak(log) {
  if (!log || Object.keys(log).length === 0) return 0

  const dates = Object.keys(log).sort().reverse()
  let streak = 0
  const today = new Date()

  for (let i = 0; i < dates.length; i++) {
    const date = new Date(dates[i])
    const expectedDate = new Date(today)
    expectedDate.setDate(expectedDate.getDate() - i)

    if (
      date.getFullYear() === expectedDate.getFullYear() &&
      date.getMonth() === expectedDate.getMonth() &&
      date.getDate() === expectedDate.getDate()
    ) {
      streak++
    } else {
      break
    }
  }

  return streak
}

// Filter and sort items (O(n log n))
function filterAndSort(items, filterFn, sortFn) {
  if (!Array.isArray(items)) return []

  let filtered = items.filter(item => {
    try {
      return eval(`(${filterFn})`)(item)
    } catch {
      return true
    }
  })

  if (sortFn) {
    filtered.sort((a, b) => {
      try {
        return eval(`(${sortFn})`)(a, b)
      } catch {
        return 0
      }
    })
  }

  return filtered
}

// Habit analytics
function calculateHabitAnalytics(habits) {
  return habits.map(h => ({
    id: h.id,
    name: h.name,
    streak: calculateStreak(h.log),
    completion: calculateCompletion(h.log),
    consistency: calculateConsistency(h.log),
    trend: calculateTrend(h.log)
  }))
}

function calculateCompletion(log) {
  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = today.slice(0, 7)
  const monthDates = Object.keys(log || {}).filter(d => d.startsWith(thisMonth))
  const daysInMonth = new Date(new Date(today).getFullYear(), new Date(today).getMonth() + 1, 0).getDate()
  return Math.round((monthDates.length / daysInMonth) * 100)
}

function calculateConsistency(log) {
  const dates = Object.keys(log || {})
  if (dates.length < 7) return 0
  const lastWeek = dates.filter(d => new Date(d) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  return Math.round((lastWeek.length / 7) * 100)
}

function calculateTrend(log) {
  const dates = Object.keys(log || {}).sort()
  if (dates.length < 2) return 'flat'

  const recent = dates.slice(-7)
  const older = dates.slice(-14, -7)

  const recentCount = recent.length
  const olderCount = older.length

  if (recentCount > olderCount * 1.2) return 'up'
  if (recentCount < olderCount * 0.8) return 'down'
  return 'flat'
}

// Goal progress
function calculateGoalProgress(goals) {
  return goals.map(g => ({
    id: g.id,
    title: g.title,
    progress: g.progress || 0,
    completedSteps: (g.steps || []).filter(s => s.done).length,
    totalSteps: g.steps?.length || 0,
    timeToComplete: estimateTimeToComplete(g)
  }))
}

function estimateTimeToComplete(goal) {
  if (!goal.steps || goal.steps.length === 0) return 'unknown'
  const completed = goal.steps.filter(s => s.done).length
  const remaining = goal.steps.length - completed
  if (remaining === 0) return '✓ Done'
  return `${remaining} steps left`
}

// Weekly report
function generateWeeklyReport(data) {
  const { habits, tasks, goals, journal } = data

  const report = {
    week: getWeekString(),
    habits: {
      completed: countCompletedThisWeek(habits),
      total: habits.length,
      percentage: Math.round((countCompletedThisWeek(habits) / habits.length) * 100)
    },
    tasks: {
      completed: tasks.filter(t => t.done && isThisWeek(t.completedAt)).length,
      total: tasks.length
    },
    goals: {
      progress: goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length,
      completed: goals.filter(g => g.progress === 100).length
    },
    journalEntries: journal.filter(j => isThisWeek(j.date)).length
  }

  return report
}

function countCompletedThisWeek(habits) {
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return habits.filter(h => {
    const log = Object.keys(h.log || {})
    return log.some(d => d >= weekAgo && d <= today)
  }).length
}

function isThisWeek(dateString) {
  if (!dateString) return false
  const date = new Date(dateString)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return date >= weekAgo
}

function getWeekString() {
  const today = new Date()
  const weekStart = new Date(today.setDate(today.getDate() - today.getDay()))
  return weekStart.toISOString().slice(0, 10)
}

// TDEE calculation
function calculateTDEE(logs, gender, age, height, weight) {
  if (!logs || logs.length === 0) return null

  // Mifflin-St Jeor BMR
  const bmr = gender === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161

  // Average activity multiplier
  const avgCalories = logs.reduce((sum, log) => sum + (log.calories || 0), 0) / logs.length

  return {
    bmr: Math.round(bmr),
    estimatedTDEE: Math.round(avgCalories),
    activityMultiplier: (avgCalories / bmr).toFixed(2)
  }
}
