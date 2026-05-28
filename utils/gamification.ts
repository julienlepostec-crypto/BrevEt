type LevelMilestone = {
  level: number;
  minXp: number;
  title: string;
};

const LEVEL_MILESTONES: LevelMilestone[] = [
  { level: 1, minXp: 0, title: "Collégien curieux" },
  { level: 2, minXp: 100, title: "Apprenti réviseur" },
  { level: 5, minXp: 500, title: "Élève sérieux" },
  { level: 10, minXp: 1500, title: "Apprenti Brevetiste" },
  { level: 20, minXp: 5000, title: "Expert du Brevet" },
  { level: 30, minXp: 12000, title: "Mention Bien" },
  { level: 50, minXp: 30000, title: "Mention Très Bien" },
];

type LevelInfo = {
  level: number;
  title: string;
  xp_current_level: number;
  xp_next_level: number;
  progress_percent: number;
};

type StreakUpdateResult = {
  new_streak: number;
  streak_maintained: boolean;
  streak_lost: boolean;
};

type UserStats = {
  streakCount: number;
  totalAttempts: number;
  successRate: number;
  perfectSessions: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateLevel(xp_total: number): LevelInfo {
  const xp = Math.max(0, xp_total);

  let current = LEVEL_MILESTONES[0];
  let next = LEVEL_MILESTONES[LEVEL_MILESTONES.length - 1];

  for (let i = 0; i < LEVEL_MILESTONES.length; i += 1) {
    if (xp >= LEVEL_MILESTONES[i].minXp) {
      current = LEVEL_MILESTONES[i];
      next = LEVEL_MILESTONES[Math.min(i + 1, LEVEL_MILESTONES.length - 1)];
    }
  }

  const atMaxLevel = current.level === next.level;
  const currentMin = current.minXp;
  const nextMin = atMaxLevel ? currentMin + 1 : next.minXp;
  const levelSpan = Math.max(1, nextMin - currentMin);
  const gainedInLevel = clamp(xp - currentMin, 0, levelSpan);

  return {
    level: current.level,
    title: current.title,
    xp_current_level: currentMin,
    xp_next_level: atMaxLevel ? currentMin : nextMin,
    progress_percent: atMaxLevel ? 100 : Math.round((gainedInLevel / levelSpan) * 100),
  };
}

export function checkAndUpdateStreak(
  last_activity_date: string | null | undefined,
  current_streak: number
): StreakUpdateResult {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const lastDate = last_activity_date ? startOfDay(new Date(last_activity_date)) : null;

  if (lastDate && lastDate.getTime() === today.getTime()) {
    return {
      new_streak: current_streak,
      streak_maintained: true,
      streak_lost: false,
    };
  }

  if (lastDate && lastDate.getTime() === yesterday.getTime()) {
    return {
      new_streak: current_streak + 1,
      streak_maintained: true,
      streak_lost: false,
    };
  }

  return {
    new_streak: 1,
    streak_maintained: false,
    streak_lost: current_streak > 0,
  };
}

export function checkBadges(user_stats: UserStats): string[] {
  const badges: string[] = [];

  if (user_stats.streakCount >= 7) {
    badges.push("🔥 7 jours de streak");
  }
  if (user_stats.successRate >= 80 && user_stats.totalAttempts >= 10) {
    badges.push("🎯 10 tentatives >80%");
  }
  if (user_stats.totalAttempts >= 1) {
    badges.push("✍️ Première tentative");
  }
  if (user_stats.perfectSessions >= 1) {
    badges.push("🏅 Session parfaite");
  }

  return badges;
}

export function getXPMultiplier(streak_count: number): number {
  if (streak_count >= 14) {
    return 1.5;
  }
  if (streak_count >= 7) {
    return 1.25;
  }
  return 1.0;
}

export type { LevelInfo, StreakUpdateResult, UserStats };
