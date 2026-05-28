type UserProfile = {
  id: number;
  prenom: string;
  avatar: string;
  xp_total: number;
  streak_count: number;
  last_activity_date: string;
  level: number;
};

type ChapterProgress = {
  id: number;
  matiere: string;
  chapitre: string;
  mastery_score: number;
  exercises_done: number;
  last_reviewed: string;
};

type ExerciseType = "QCM" | "CALCUL" | "REDACTION" | "DICTE" | "ANALYSE";

type Exercise = {
  id: number;
  matiere: string;
  chapitre: string;
  type: ExerciseType;
  enonce: string;
  choices: string | null;
  correct_answer: string | null;
  explication: string | null;
  difficulte: 1 | 2 | 3;
};

type Attempt = {
  id: number;
  exercise_id: number;
  reponse_donnee: string;
  is_correct: 0 | 1;
  score: number;
  created_at: string;
};

type InMemoryState = {
  initialized: boolean;
  user_profile: UserProfile[];
  exercises: Exercise[];
  attempts: Attempt[];
  chapter_progress: ChapterProgress[];
};

const memoryState: InMemoryState = {
  initialized: false,
  user_profile: [],
  exercises: [],
  attempts: [],
  chapter_progress: [],
};

let sqliteModule: any | null = null;

try {
  // Optional dependency in this environment; we gracefully fallback when absent.
  sqliteModule = require("expo-sqlite");
} catch {
  sqliteModule = null;
}

let db: any | null = null;

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

function seedInMemoryData() {
  if (memoryState.initialized) {
    return;
  }

  memoryState.user_profile.push({
    id: 1,
    prenom: "Mon fils",
    avatar: "🧑‍🎓",
    xp_total: 0,
    streak_count: 0,
    last_activity_date: todayIsoDate(),
    level: 1,
  });

  memoryState.chapter_progress.push(
    {
      id: 1,
      matiere: "Mathématiques",
      chapitre: "Pythagore",
      mastery_score: 35,
      exercises_done: 4,
      last_reviewed: todayIsoDate(),
    },
    {
      id: 2,
      matiere: "Français",
      chapitre: "Grammaire",
      mastery_score: 42,
      exercises_done: 3,
      last_reviewed: todayIsoDate(),
    },
    {
      id: 3,
      matiere: "Histoire-Géo",
      chapitre: "Guerres mondiales",
      mastery_score: 28,
      exercises_done: 2,
      last_reviewed: todayIsoDate(),
    }
  );

  memoryState.initialized = true;
}

async function initSqliteIfAvailable() {
  if (!sqliteModule || db) {
    return;
  }

  const sqlite = sqliteModule;
  if (!sqlite.openDatabaseSync) {
    return;
  }

  db = sqlite.openDatabaseSync("brevet.db");

  db.execSync(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY NOT NULL,
      prenom TEXT NOT NULL DEFAULT 'Mon fils',
      avatar TEXT,
      xp_total INTEGER NOT NULL DEFAULT 0,
      streak_count INTEGER NOT NULL DEFAULT 0,
      last_activity_date TEXT,
      level INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY NOT NULL,
      matiere TEXT NOT NULL,
      chapitre TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('QCM','CALCUL','REDACTION','DICTE','ANALYSE')),
      enonce TEXT NOT NULL,
      choices TEXT,
      correct_answer TEXT,
      explication TEXT,
      difficulte INTEGER NOT NULL CHECK(difficulte IN (1,2,3))
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY NOT NULL,
      exercise_id INTEGER NOT NULL,
      reponse_donnee TEXT NOT NULL,
      is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)),
      score INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chapter_progress (
      id INTEGER PRIMARY KEY NOT NULL,
      matiere TEXT NOT NULL,
      chapitre TEXT NOT NULL,
      mastery_score INTEGER NOT NULL DEFAULT 0,
      exercises_done INTEGER NOT NULL DEFAULT 0,
      last_reviewed TEXT
    );
  `);

  const existingUser = db.getFirstSync(`SELECT id FROM user_profile LIMIT 1;`);
  if (!existingUser) {
    db.runSync(
      `
      INSERT INTO user_profile (id, prenom, avatar, xp_total, streak_count, last_activity_date, level)
      VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [1, "Mon fils", "🧑‍🎓", 0, 0, todayIsoDate(), 1]
    );
  }
}

export async function initDatabase() {
  await initSqliteIfAvailable();
  if (!db) {
    seedInMemoryData();
  }
}

export async function getUserProfile(): Promise<UserProfile> {
  await initDatabase();

  if (db) {
    const profile = db.getFirstSync(`
      SELECT id, prenom, avatar, xp_total, streak_count, last_activity_date, level
      FROM user_profile
      ORDER BY id ASC
      LIMIT 1;
    `);
    return profile as UserProfile;
  }

  return memoryState.user_profile[0];
}

export async function updateXP(points: number): Promise<UserProfile> {
  await initDatabase();

  if (db) {
    db.runSync(
      `UPDATE user_profile SET xp_total = xp_total + ? WHERE id = (SELECT id FROM user_profile LIMIT 1);`,
      [points]
    );
    return getUserProfile();
  }

  const profile = memoryState.user_profile[0];
  profile.xp_total += points;
  return profile;
}

export async function updateStreak(): Promise<UserProfile> {
  await initDatabase();

  const today = todayIsoDate();
  if (db) {
    db.runSync(
      `
      UPDATE user_profile
      SET streak_count = CASE
          WHEN last_activity_date = ? THEN streak_count
          ELSE streak_count + 1
        END,
        last_activity_date = ?
      WHERE id = (SELECT id FROM user_profile LIMIT 1);
      `,
      [today, today]
    );
    return getUserProfile();
  }

  const profile = memoryState.user_profile[0];
  if (profile.last_activity_date !== today) {
    profile.streak_count += 1;
    profile.last_activity_date = today;
  }
  return profile;
}

export async function getProgressByMatiere(
  matiere: string
): Promise<ChapterProgress[]> {
  await initDatabase();

  if (db) {
    const rows = db.getAllSync(
      `
      SELECT id, matiere, chapitre, mastery_score, exercises_done, last_reviewed
      FROM chapter_progress
      WHERE matiere = ?
      ORDER BY chapitre ASC;
      `,
      [matiere]
    );
    return rows as ChapterProgress[];
  }

  return memoryState.chapter_progress.filter((row) => row.matiere === matiere);
}

export async function saveAttempt(input: Omit<Attempt, "id" | "created_at">) {
  await initDatabase();
  const createdAt = new Date().toISOString();

  if (db) {
    db.runSync(
      `
      INSERT INTO attempts (exercise_id, reponse_donnee, is_correct, score, created_at)
      VALUES (?, ?, ?, ?, ?);
      `,
      [
        input.exercise_id,
        input.reponse_donnee,
        input.is_correct,
        input.score,
        createdAt,
      ]
    );
    return;
  }

  memoryState.attempts.push({
    id: memoryState.attempts.length + 1,
    exercise_id: input.exercise_id,
    reponse_donnee: input.reponse_donnee,
    is_correct: input.is_correct,
    score: input.score,
    created_at: createdAt,
  });
}

export async function getAttempts(): Promise<Attempt[]> {
  await initDatabase();

  if (db) {
    const rows = db.getAllSync(
      `
      SELECT id, exercise_id, reponse_donnee, is_correct, score, created_at
      FROM attempts
      ORDER BY id DESC;
      `
    );
    return rows as Attempt[];
  }

  return [...memoryState.attempts].reverse();
}

export type { UserProfile, ChapterProgress, Exercise, Attempt };
