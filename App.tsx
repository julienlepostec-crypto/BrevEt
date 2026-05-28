import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Easing,
  ImageBackground,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CHAPTERS_BY_SUBJECT, type SubjectId } from "./data/chapters";
import {
  deleteMetaValue,
  getEventLogs,
  getMetaValue,
  getAttempts,
  getUserProfile,
  initDatabase,
  logEvent,
  resetStatsForFirstUseIfNeeded,
  saveAttempt,
  setMetaValue,
  updateXP,
  updateStreak,
  type Attempt,
  type UserProfile,
} from "./database/db";
import {
  calculateLevel,
  checkBadges,
  getXPMultiplier,
} from "./utils/gamification";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const CONFETTI_PARTICLES = [
  { left: "12%", drift: -26, emoji: "🏀" },
  { left: "24%", drift: 14, emoji: "✨" },
  { left: "36%", drift: -10, emoji: "🏀" },
  { left: "48%", drift: 20, emoji: "🎉" },
  { left: "60%", drift: -16, emoji: "✨" },
  { left: "72%", drift: 12, emoji: "🏀" },
  { left: "84%", drift: -22, emoji: "🎉" },
] as const;

type TabKey = "accueil" | "matieres" | "defis" | "progres" | "profil";
type DefiSubjectFilter = SubjectId | "mixte";
type ThemeId = "hall-of-fame" | "minimal-dark" | "neon-court";
type AppView =
  | "tabs"
  | "qcm"
  | "matiere-detail"
  | "calcul"
  | "short-answer"
  | "analysis-doc"
  | "annales";
type Difficulty = 1 | 2 | 3;

type Subject = {
  id: SubjectId;
  icon: string;
  name: string;
  color: string;
};

type QcmQuestion = {
  id: number;
  matiere: SubjectId;
  enonce: string;
  choices: string[];
  correctAnswer: string;
  explication: string;
  difficulty: Difficulty;
};

type ShortAnswerExercise = {
  id: number;
  matiere: SubjectId;
  title: string;
  enonce: string;
  acceptedAnswers: string[];
  hint: string;
  difficulty: Difficulty;
};

type AnalysisExercise = {
  id: number;
  matiere: SubjectId;
  title: string;
  prompt: string;
  sourceText: string;
  expectedKeywords: string[];
  difficulty: Difficulty;
};

type AnnalesItem =
  | {
      id: number;
      year: number;
      mode: "qcm";
      matiere: SubjectId;
      difficulty: Difficulty;
      enonce: string;
      choices: string[];
      correctAnswer: string;
      explanation: string;
    }
  | {
      id: number;
      year: number;
      mode: "short";
      matiere: SubjectId;
      difficulty: Difficulty;
      enonce: string;
      acceptedAnswers: string[];
      hint: string;
    }
  | {
      id: number;
      year: number;
      mode: "analysis";
      matiere: SubjectId;
      difficulty: Difficulty;
      enonce: string;
      sourceText: string;
      expectedKeywords: string[];
    }
  | {
      id: number;
      year: number;
      mode: "calcul";
      matiere: SubjectId;
      difficulty: Difficulty;
      enonce: string;
      expectedFormula: string;
      expectedResult: number;
      tolerance: number;
      unit: string;
    };

type ExerciseCatalogEntry = {
  subjectId: SubjectId;
  difficulty: Difficulty;
  label: string;
  mode: "qcm" | "short" | "analysis" | "calcul" | "annales";
};

type MistakeRow = {
  id: number;
  exerciseId: number;
  subjectId: SubjectId;
  label: string;
  createdAt: string;
};

type ThemePack = {
  id: ThemeId;
  label: string;
  palette: {
    root: string;
    card: string;
    cardBorder: string;
    accent: string;
    text: string;
    subText: string;
    buttonText: string;
  };
  muralTitle: string;
  muralHint: string;
  muralSymbols: string;
  wallpaperUris: string[];
  credits?: string;
};

const SUBJECTS: Subject[] = [
  { id: "maths", icon: "📐", name: "Mathématiques", color: "#4A90D9" },
  { id: "fr", icon: "📘", name: "Français", color: "#E8A838" },
  { id: "hg", icon: "🌍", name: "Histoire-Géo", color: "#E85D4A" },
  { id: "physique", icon: "⚗️", name: "Physique-Chimie", color: "#9B59B6" },
  { id: "svt", icon: "🔬", name: "SVT", color: "#5CB85C" },
];

const TAB_ITEMS: Array<{ key: TabKey; icon: string; label: string }> = [
  { key: "accueil", icon: "🏠", label: "Accueil" },
  { key: "matieres", icon: "📚", label: "Matières" },
  { key: "defis", icon: "🏆", label: "Défis" },
  { key: "progres", icon: "📊", label: "Progrès" },
  { key: "profil", icon: "👤", label: "Profil" },
];

const ENCOURAGEMENTS = [
  "C'est parti ! 💪",
  "Tu peux le faire !",
  "Chaque exercice compte !",
  "Le brevet, c'est dans ta poche !",
];

const DAILY_XP_GOAL = 100;

const QCM_QUESTIONS: QcmQuestion[] = [
  {
    id: 1,
    matiere: "maths",
    enonce: "Dans un triangle rectangle, quel côté est l'hypoténuse ?",
    choices: [
      "Le côté opposé à l'angle droit",
      "Le côté adjacent à l'angle droit",
      "Le plus petit côté",
      "Le côté vertical",
    ],
    correctAnswer: "Le côté opposé à l'angle droit",
    explication:
      "L'hypoténuse est toujours le côté en face de l'angle droit.",
    difficulty: 1,
  },
  {
    id: 2,
    matiere: "maths",
    enonce:
      "Triangle rectangle avec côtés 3 cm et 4 cm. L'hypoténuse mesure :",
    choices: ["5 cm", "6 cm", "7 cm", "4.5 cm"],
    correctAnswer: "5 cm",
    explication: "3² + 4² = 9 + 16 = 25, donc l'hypoténuse vaut 5.",
    difficulty: 1,
  },
  {
    id: 3,
    matiere: "maths",
    enonce:
      "Si AB² = AC² + BC², que peut-on conclure pour le triangle ABC ?",
    choices: [
      "Il est rectangle en C",
      "Il est rectangle en A",
      "Il est isocèle",
      "Impossible à conclure",
    ],
    correctAnswer: "Il est rectangle en C",
    explication:
      "Par la réciproque de Pythagore, le triangle est rectangle au sommet opposé à AB.",
    difficulty: 2,
  },
  {
    id: 4,
    matiere: "maths",
    enonce:
      "Un triangle rectangle a pour hypoténuse 13 et un côté 5. L'autre côté vaut :",
    choices: ["12", "10", "8", "18"],
    correctAnswer: "12",
    explication: "13² - 5² = 169 - 25 = 144, donc l'autre côté vaut 12.",
    difficulty: 2,
  },
  {
    id: 5,
    matiere: "maths",
    enonce: "Lequel de ces triplets est pythagoricien ?",
    choices: ["6, 8, 10", "2, 3, 4", "4, 5, 6", "5, 5, 8"],
    correctAnswer: "6, 8, 10",
    explication: "6² + 8² = 36 + 64 = 100 = 10².",
    difficulty: 3,
  },
  {
    id: 6,
    matiere: "fr",
    enonce: "Dans « Nous lisons un roman », quel est le COD ?",
    choices: ["Nous", "lisons", "un roman", "aucun"],
    correctAnswer: "un roman",
    explication: "Le COD complète directement le verbe « lisons » : « un roman ».",
    difficulty: 1,
  },
  {
    id: 7,
    matiere: "hg",
    enonce: "La Première Guerre mondiale commence en :",
    choices: ["1905", "1914", "1918", "1939"],
    correctAnswer: "1914",
    explication: "La guerre débute en 1914 et se termine en 1918.",
    difficulty: 1,
  },
  {
    id: 8,
    matiere: "svt",
    enonce: "L'ADN est principalement localisé dans :",
    choices: ["Le noyau", "Le cytoplasme", "La membrane", "Les côtes"],
    correctAnswer: "Le noyau",
    explication: "Au collège, on retient que l'ADN est dans le noyau des cellules.",
    difficulty: 2,
  },
  {
    id: 9,
    matiere: "physique",
    enonce: "La formule de la vitesse moyenne est :",
    choices: ["v = d / t", "v = d × t", "v = t / d", "v = d + t"],
    correctAnswer: "v = d / t",
    explication: "La vitesse moyenne est distance divisée par le temps.",
    difficulty: 1,
  },
];

const FORMULA_OPTIONS = ["v = d / t", "v = d × t", "v = t / d"] as const;
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "Facile",
  2: "Moyen",
  3: "Difficile",
};

const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  1: 10,
  2: 20,
  3: 30,
};

const SHORT_ANSWER_EXERCISES: ShortAnswerExercise[] = [
  {
    id: 2001,
    matiere: "fr",
    title: "Réponse courte - Grammaire",
    enonce: "Dans la phrase 'Ils ont fini leurs devoirs', quel est le sujet ?",
    acceptedAnswers: ["ils"],
    hint: "Cherche qui fait l'action.",
    difficulty: 1,
  },
  {
    id: 2002,
    matiere: "maths",
    title: "Réponse courte - Calcul mental",
    enonce: "Calcule 15% de 200.",
    acceptedAnswers: ["30"],
    hint: "10% puis 5%.",
    difficulty: 2,
  },
  {
    id: 2003,
    matiere: "hg",
    title: "Réponse courte - Repère historique",
    enonce: "En quelle année commence la Première Guerre mondiale ?",
    acceptedAnswers: ["1914"],
    hint: "Début du XXe siècle.",
    difficulty: 1,
  },
  {
    id: 2004,
    matiere: "svt",
    title: "Réponse courte - SVT",
    enonce: "Quel acide est le support de l'information génétique ?",
    acceptedAnswers: ["adn", "acide desoxyribonucleique"],
    hint: "On l'abrège en trois lettres.",
    difficulty: 2,
  },
];

const ANALYSIS_EXERCISES: AnalysisExercise[] = [
  {
    id: 2101,
    matiere: "hg",
    title: "Analyse de document - Histoire",
    prompt: "Explique en 2-4 phrases ce que montre ce document et son contexte.",
    sourceText:
      "Document: Affiche de 1944 appelant les Français a soutenir l'effort de liberation. On y voit des symboles nationaux et un slogan sur l'unite.",
    expectedKeywords: ["1944", "liberation", "france", "unite"],
    difficulty: 2,
  },
  {
    id: 2102,
    matiere: "fr",
    title: "Analyse de document - Francais",
    prompt: "Identifie le ton du texte et justifie avec un element precis.",
    sourceText:
      "Extrait: 'Le vent hurlait sur la plaine, et chacun avancait en silence.'",
    expectedKeywords: ["ton", "inquietant", "silence", "vent"],
    difficulty: 3,
  },
  {
    id: 2103,
    matiere: "svt",
    title: "Analyse de document - SVT",
    prompt:
      "Analyse le document et explique le lien entre vaccination et réponse immunitaire en 3-4 phrases.",
    sourceText:
      "Document: Graphique montrant l'augmentation des anticorps après une première puis une deuxième injection vaccinale.",
    expectedKeywords: ["anticorps", "vaccin", "immunitaire", "memoire"],
    difficulty: 3,
  },
];

const ANNALES_ITEMS: AnnalesItem[] = [
  {
    id: 3001,
    year: 2019,
    mode: "qcm",
    matiere: "maths",
    difficulty: 1,
    enonce: "2019 Maths: Le triangle de cotes 6, 8 et 10 est-il rectangle ?",
    choices: ["Oui", "Non", "Impossible a dire"],
    correctAnswer: "Oui",
    explanation: "6² + 8² = 10², donc triangle rectangle.",
  },
  {
    id: 3002,
    year: 2021,
    mode: "short",
    matiere: "fr",
    difficulty: 2,
    enonce: "2021 Francais: Donne la classe grammaticale de 'rapidement'.",
    acceptedAnswers: ["adverbe", "un adverbe"],
    hint: "Ce mot complete souvent un verbe.",
  },
  {
    id: 3003,
    year: 2023,
    mode: "analysis",
    matiere: "hg",
    difficulty: 3,
    enonce: "2023 Histoire-Geo: Analyse l'interet du document en 3 phrases.",
    sourceText:
      "Source: Carte montrant l'evolution de la population urbaine en France entre 1950 et 2020.",
    expectedKeywords: ["population", "urbaine", "evolution", "france"],
  },
  {
    id: 3004,
    year: 2023,
    mode: "calcul",
    matiere: "physique",
    difficulty: 2,
    enonce: "2023 Physique: Distance 180 km en 3 h. Donne la vitesse moyenne (km/h).",
    expectedFormula: "v = d / t",
    expectedResult: 60,
    tolerance: 0.5,
    unit: "km/h",
  },
  {
    id: 3005,
    year: 2024,
    mode: "short",
    matiere: "svt",
    difficulty: 3,
    enonce:
      "2024 SVT: Cite le type de cellules responsables de la production d'anticorps.",
    acceptedAnswers: ["lymphocytes b", "lymphocyte b"],
    hint: "Ce sont des cellules du système immunitaire adaptatif.",
  },
  {
    id: 3006,
    year: 2024,
    mode: "analysis",
    matiere: "svt",
    difficulty: 3,
    enonce:
      "2024 SVT: Explique l'intérêt du rappel vaccinal à partir du document.",
    sourceText:
      "Source: Courbe d'anticorps comparant l'effet d'une dose initiale et d'un rappel à 6 mois.",
    expectedKeywords: ["rappel", "anticorps", "memoire", "protection"],
  },
];

const SESSION_RESUME_KEY = "active_training_session_v1";
const THEME_META_KEY = "theme_pack_v1";
const ONBOARDING_META_KEY = "onboarding_complete_v1";
const ONBOARDING_NAME_KEY = "onboarding_name_v1";
const ONBOARDING_SUBJECT_KEY = "onboarding_subject_v1";
const INPUT_PLACEHOLDER_COLOR = "#8F98AB";
const SUBJECT_LABEL_BY_ID: Record<SubjectId, string> = {
  maths: "Mathématiques",
  fr: "Français",
  hg: "Histoire-Géo",
  physique: "Physique-Chimie",
  svt: "SVT",
};

const EXERCISE_CATALOG: Record<number, ExerciseCatalogEntry> = (() => {
  const entries: Record<number, ExerciseCatalogEntry> = {};
  for (const question of QCM_QUESTIONS) {
    entries[question.id] = {
      subjectId: question.matiere,
      difficulty: question.difficulty,
      label: question.enonce,
      mode: "qcm",
    };
  }
  for (const exercise of SHORT_ANSWER_EXERCISES) {
    entries[exercise.id] = {
      subjectId: exercise.matiere,
      difficulty: exercise.difficulty,
      label: exercise.title,
      mode: "short",
    };
  }
  for (const exercise of ANALYSIS_EXERCISES) {
    entries[exercise.id] = {
      subjectId: exercise.matiere,
      difficulty: exercise.difficulty,
      label: exercise.title,
      mode: "analysis",
    };
  }
  for (const item of ANNALES_ITEMS) {
    entries[item.id] = {
      subjectId: item.matiere,
      difficulty: item.difficulty,
      label: item.enonce,
      mode: "annales",
    };
  }
  entries[1001] = {
    subjectId: "physique",
    difficulty: 2,
    label: "Calcul guidé vitesse",
    mode: "calcul",
  };
  return entries;
})();

const THEME_PACKS: Record<ThemeId, ThemePack> = {
  "hall-of-fame": {
    id: "hall-of-fame",
    label: "Hall of Fame",
    palette: {
      root: "#0D0D0D",
      card: "#161616",
      cardBorder: "#2E2E2E",
      accent: "#FF7A00",
      text: "#F8F5EF",
      subText: "#E2E6EE",
      buttonText: "#111111",
    },
    muralTitle: "Wall of Legends",
    muralHint: "Galerie privée des légendes NBA.",
    muralSymbols: "🏀 23 • 24 • 32 • 33 • 34 • 30",
    wallpaperUris: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Jordan_Lipofsky.jpg",
      "https://commons.wikimedia.org/wiki/Special:FilePath/Kobe_Bryant_8.jpg",
      "https://commons.wikimedia.org/wiki/Special:FilePath/LeBron_James_-_51959723161.jpg",
    ],
    credits: "Images Wikimedia Commons (usage privé)",
  },
  "minimal-dark": {
    id: "minimal-dark",
    label: "Minimal Dark",
    palette: {
      root: "#101114",
      card: "#171A20",
      cardBorder: "#2A2F38",
      accent: "#7CB7FF",
      text: "#EEF2F8",
      subText: "#C4CFDE",
      buttonText: "#0D1626",
    },
    muralTitle: "Focus Mode",
    muralHint: "Aucun bruit visuel, maximal concentration.",
    muralSymbols: "◼ ◻ ◼ ◻",
    wallpaperUris: ["https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1600&q=80"],
  },
  "neon-court": {
    id: "neon-court",
    label: "Neon Court",
    palette: {
      root: "#0C1018",
      card: "#11192A",
      cardBorder: "#213756",
      accent: "#28E1FF",
      text: "#EAFBFF",
      subText: "#B8E7F3",
      buttonText: "#04222C",
    },
    muralTitle: "Neon Arena",
    muralHint: "Ambiance night game, contraste élevé.",
    muralSymbols: "⚡ 🏀 ⚡ 🏀 ⚡",
    wallpaperUris: ["https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=1600&q=80"],
  },
};

function getRecencyWeight(createdAt: string): number {
  const date = new Date(createdAt).getTime();
  if (Number.isNaN(date)) {
    return 1;
  }
  const daysAgo = Math.max(0, (Date.now() - date) / 86_400_000);
  return 0.65 + 0.35 * Math.exp(-daysAgo / 14);
}

function getDifficultyWeight(difficulty: Difficulty): number {
  if (difficulty === 3) {
    return 1.4;
  }
  if (difficulty === 2) {
    return 1.2;
  }
  return 1;
}

function computeMasteryBySubject(attempts: Attempt[]): Record<SubjectId, number> {
  const subjectIds: SubjectId[] = ["maths", "fr", "hg", "physique", "svt"];
  const result: Record<SubjectId, number> = {
    maths: 0,
    fr: 0,
    hg: 0,
    physique: 0,
    svt: 0,
  };
  for (const subjectId of subjectIds) {
    let weightedTotal = 0;
    let weightedCorrect = 0;
    for (const attempt of attempts) {
      const meta = EXERCISE_CATALOG[attempt.exercise_id];
      if (!meta || meta.subjectId !== subjectId) {
        continue;
      }
      const weight = getDifficultyWeight(meta.difficulty) * getRecencyWeight(attempt.created_at);
      weightedTotal += weight;
      if (attempt.is_correct === 1) {
        weightedCorrect += weight;
      }
    }
    result[subjectId] = weightedTotal ? Math.round((weightedCorrect / weightedTotal) * 100) : 0;
  }
  return result;
}

function getQcmCoachingHint(question: QcmQuestion): string {
  if (question.matiere === "maths") {
    return "Méthode: repère les données, applique la formule étape par étape, puis vérifie l'unité.";
  }
  if (question.matiere === "fr") {
    return "Méthode: identifie d'abord la fonction grammaticale, puis valide avec la question du verbe.";
  }
  if (question.matiere === "hg") {
    return "Méthode: place l'événement sur une frise mentale (avant/après) pour éliminer les pièges.";
  }
  if (question.matiere === "svt") {
    return "Méthode: relie le mot-clé scientifique à sa fonction biologique avant de répondre.";
  }
  return "Méthode: liste formule + données + unité, puis contrôle la cohérence du résultat.";
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilBrevet(targetDate: Date): number {
  const diffMs = startOfDay(targetDate).getTime() - startOfDay(new Date()).getTime();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeFormula(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/vitesse/g, "v")
    .replace(/distance/g, "d")
    .replace(/temps/g, "t")
    .replace(/\s+/g, "")
    .replace(/[×x*]/g, "*")
    .replace(/[÷:]/g, "/");
}

function isSpeedFormulaEquivalent(value: string): boolean {
  const normalized = normalizeFormula(value);
  return (
    normalized === "v=d/t" ||
    normalized === "d/t=v" ||
    normalized === "v=d÷t" ||
    normalized === "d÷t=v"
  );
}

function computeBadge(totalAttempts: number, successRate: number): string {
  if (totalAttempts >= 12 && successRate >= 80) {
    return "Badge Expert Annales";
  }
  if (totalAttempts >= 6 && successRate >= 60) {
    return "Badge En progression";
  }
  return "Badge Demarrage";
}

function difficultyTag(difficulty: Difficulty): "easy" | "medium" | "hard" {
  if (difficulty === 1) {
    return "easy";
  }
  if (difficulty === 2) {
    return "medium";
  }
  return "hard";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("accueil");
  const [view, setView] = useState<AppView>("tabs");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progressMap, setProgressMap] = useState<Record<SubjectId, number>>({
    maths: 0,
    fr: 0,
    hg: 0,
    physique: 0,
    svt: 0,
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<SubjectId>("maths");
  const [defiSubjectFilter, setDefiSubjectFilter] =
    useState<DefiSubjectFilter>("mixte");
  const [qcmSessionQuestions, setQcmSessionQuestions] =
    useState<QcmQuestion[]>(QCM_QUESTIONS.filter((q) => q.matiere === "maths"));
  const [qcmRetryQueue, setQcmRetryQueue] = useState<QcmQuestion[]>([]);
  const [qcmRetryRound, setQcmRetryRound] = useState(false);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0);
  const [sessionXpEarned, setSessionXpEarned] = useState(0);
  const [perfectSessions, setPerfectSessions] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [correctAttempts, setCorrectAttempts] = useState(0);

  const [calcStep, setCalcStep] = useState(1);
  const [formulaChoice, setFormulaChoice] = useState<string | null>(null);
  const [distanceValue, setDistanceValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [conclusionText, setConclusionText] = useState("");
  const [calcCompleted, setCalcCompleted] = useState(false);
  const [calcIsCorrect, setCalcIsCorrect] = useState(false);

  const [shortIndex, setShortIndex] = useState(0);
  const [shortSessionExercises, setShortSessionExercises] =
    useState<ShortAnswerExercise[]>(SHORT_ANSWER_EXERCISES);
  const [shortAnswerText, setShortAnswerText] = useState("");
  const [shortFeedback, setShortFeedback] = useState<string | null>(null);
  const [shortSubmitted, setShortSubmitted] = useState(false);
  const [shortWasCorrect, setShortWasCorrect] = useState(false);

  const [analysisIndex, setAnalysisIndex] = useState(0);
  const [analysisSessionExercises, setAnalysisSessionExercises] =
    useState<AnalysisExercise[]>(ANALYSIS_EXERCISES);
  const [analysisAnswerText, setAnalysisAnswerText] = useState("");
  const [analysisFeedback, setAnalysisFeedback] = useState<string | null>(null);
  const [analysisSubmitted, setAnalysisSubmitted] = useState(false);
  const [analysisWasCorrect, setAnalysisWasCorrect] = useState(false);

  const [annalesIndex, setAnnalesIndex] = useState(0);
  const [annalesChoice, setAnnalesChoice] = useState<string | null>(null);
  const [annalesTextAnswer, setAnnalesTextAnswer] = useState("");
  const [annalesFormulaInput, setAnnalesFormulaInput] = useState("");
  const [annalesResultInput, setAnnalesResultInput] = useState("");
  const [annalesSubmitted, setAnnalesSubmitted] = useState(false);
  const [annalesWasCorrect, setAnnalesWasCorrect] = useState(false);
  const [annalesFeedback, setAnnalesFeedback] = useState<string | null>(null);
  const [annalesScore, setAnnalesScore] = useState(0);
  const [annalesXp, setAnnalesXp] = useState(0);
  const [annalesSessionItems, setAnnalesSessionItems] = useState<AnnalesItem[]>(ANNALES_ITEMS);
  const [recentMistakes, setRecentMistakes] = useState<MistakeRow[]>([]);
  const [eventStats, setEventStats] = useState<Record<string, number>>({});
  const [resumeSuggestion, setResumeSuggestion] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>("hall-of-fame");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingSubject, setOnboardingSubject] = useState<SubjectId>("maths");
  const questionCardAnim = useRef(new Animated.Value(1)).current;
  const qcmFeedbackAnim = useRef(new Animated.Value(0)).current;
  const pulseButtonAnim = useRef(new Animated.Value(1)).current;
  const xpProgressAnim = useRef(new Animated.Value(0)).current;
  const xpShineAnim = useRef(new Animated.Value(-180)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const screenTransitionAnim = useRef(new Animated.Value(1)).current;
  const streakPulseAnim = useRef(new Animated.Value(1)).current;
  const activeTabPulseAnim = useRef(new Animated.Value(1)).current;
  const successFlashAnim = useRef(new Animated.Value(0)).current;
  const [xpProgressDisplay, setXpProgressDisplay] = useState(0);
  const themePack = THEME_PACKS[themeId];
  const wallpaperUri = useMemo(() => {
    const list = themePack.wallpaperUris;
    if (!list.length) {
      return null;
    }
    const index = new Date().getDate() % list.length;
    return list[index];
  }, [themePack]);

  const successRate = totalAttempts
    ? Math.round((correctAttempts / totalAttempts) * 100)
    : 0;
  const progressBadge = computeBadge(totalAttempts, successRate);
  const levelInfo = calculateLevel(profile?.xp_total ?? 0);
  const xpMultiplier = getXPMultiplier(profile?.streak_count ?? 0);
  const pointsForDifficulty = (difficulty: Difficulty) =>
    Math.round(DIFFICULTY_POINTS[difficulty] * xpMultiplier);
  const unlockedBadges = checkBadges({
    streakCount: profile?.streak_count ?? 0,
    totalAttempts,
    successRate,
    perfectSessions,
  });
  const xPProgress = Math.min(
    100,
    Math.round(((profile?.xp_total ?? 0) / DAILY_XP_GOAL) * 100)
  );

  function triggerConfetti() {
    confettiAnim.stopAnimation();
    confettiAnim.setValue(0);
    successFlashAnim.stopAnimation();
    successFlashAnim.setValue(0.18);
    Animated.timing(confettiAnim, {
      toValue: 1,
      duration: 850,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    Animated.timing(successFlashAnim, {
      toValue: 0,
      duration: 420,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }

  useEffect(() => {
    questionCardAnim.setValue(0.88);
    Animated.timing(questionCardAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [view, questionIndex, annalesIndex, shortIndex, analysisIndex, calcStep, questionCardAnim]);

  useEffect(() => {
    if (selectedChoice !== null) {
      qcmFeedbackAnim.setValue(0);
      Animated.timing(qcmFeedbackAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [selectedChoice, qcmFeedbackAnim]);

  useEffect(() => {
    const listenerId = xpProgressAnim.addListener(({ value }) => {
      const clamped = Math.max(0, Math.min(100, value));
      setXpProgressDisplay(clamped);
    });
    return () => {
      xpProgressAnim.removeListener(listenerId);
    };
  }, [xpProgressAnim]);

  useEffect(() => {
    Animated.timing(xpProgressAnim, {
      toValue: xPProgress,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    xpShineAnim.setValue(-180);
    Animated.timing(xpShineAnim, {
      toValue: 260,
      duration: 520,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [xPProgress, xpProgressAnim, xpShineAnim]);

  useEffect(() => {
    if (view !== "tabs") {
      pulseButtonAnim.setValue(1);
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseButtonAnim, {
          toValue: 1.03,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseButtonAnim, {
          toValue: 1,
          duration: 780,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [view, pulseButtonAnim]);

  useEffect(() => {
    screenTransitionAnim.setValue(0);
    Animated.timing(screenTransitionAnim, {
      toValue: 1,
      duration: 230,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [view, activeTab, screenTransitionAnim]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    streakPulseAnim.setValue(1);
    Animated.sequence([
      Animated.timing(streakPulseAnim, {
        toValue: 1.07,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(streakPulseAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [profile?.xp_total, streakPulseAnim]);

  useEffect(() => {
    activeTabPulseAnim.setValue(0.96);
    Animated.spring(activeTabPulseAnim, {
      toValue: 1,
      stiffness: 240,
      damping: 16,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [activeTab, activeTabPulseAnim]);

  async function refreshAttemptStats() {
    const attempts = await getAttempts();
    setTotalAttempts(attempts.length);
    setCorrectAttempts(attempts.filter((attempt) => attempt.is_correct === 1).length);
    setProgressMap(computeMasteryBySubject(attempts));
    setRecentMistakes(
      attempts
        .filter((attempt) => attempt.is_correct === 0)
        .slice(0, 6)
        .map((attempt) => {
          const meta = EXERCISE_CATALOG[attempt.exercise_id];
          return {
            id: attempt.id,
            exerciseId: attempt.exercise_id,
            subjectId: meta?.subjectId ?? "maths",
            label: meta?.label ?? `Exercice #${attempt.exercise_id}`,
            createdAt: attempt.created_at,
          };
        })
    );
  }

  async function refreshEventStats() {
    const logs = await getEventLogs(400);
    const summary = logs.reduce<Record<string, number>>((acc, log) => {
      acc[log.event_name] = (acc[log.event_name] ?? 0) + 1;
      return acc;
    }, {});
    setEventStats(summary);
  }

  async function saveSessionResume(mode: string, subjectId?: SubjectId) {
    await setMetaValue(
      SESSION_RESUME_KEY,
      JSON.stringify({
        mode,
        subjectId: subjectId ?? null,
        at: new Date().toISOString(),
      })
    );
  }

  async function clearSessionResume() {
    await deleteMetaValue(SESSION_RESUME_KEY);
  }

  function confirmLeaveFlow() {
    Alert.alert(
      "Quitter l'entraînement ?",
      "Ta progression en cours sera interrompue.",
      [
        { text: "Continuer", style: "cancel" },
        {
          text: "Quitter",
          style: "destructive",
          onPress: () => {
            void logEvent("session_abandon", { view });
            void clearSessionResume();
            setResumeSuggestion(null);
            setView("tabs");
          },
        },
      ]
    );
  }

  function completeSessionAndReturn(mode: string, payload?: Record<string, unknown>) {
    void clearSessionResume();
    setResumeSuggestion(null);
    void logEvent("session_complete", { mode, ...(payload ?? {}) });
    setView("tabs");
  }

  async function applyTheme(nextTheme: ThemeId) {
    setThemeId(nextTheme);
    await setMetaValue(THEME_META_KEY, nextTheme);
    await logEvent("theme_changed", { theme: nextTheme });
    await refreshEventStats();
  }

  async function completeOnboarding() {
    const trimmedName = onboardingName.trim();
    const finalName = trimmedName.length > 0 ? trimmedName : profile?.prenom ?? "Champion";
    setProfile((current) => (current ? { ...current, prenom: finalName } : current));
    setSelectedSubjectId(onboardingSubject);
    await Promise.all([
      setMetaValue(ONBOARDING_META_KEY, "1"),
      setMetaValue(ONBOARDING_NAME_KEY, finalName),
      setMetaValue(ONBOARDING_SUBJECT_KEY, onboardingSubject),
      setMetaValue(THEME_META_KEY, themeId),
      logEvent("onboarding_completed", { theme: themeId, subject: onboardingSubject }),
    ]);
    await refreshEventStats();
    setShowOnboarding(false);
  }

  function handleTopBackPress() {
    if (view === "matiere-detail") {
      setView("tabs");
      return;
    }
    if (view === "qcm" || view === "calcul" || view === "short-answer" || view === "analysis-doc" || view === "annales") {
      confirmLeaveFlow();
      return;
    }
    setView("tabs");
  }

  useEffect(() => {
    async function bootstrap() {
      await initDatabase();
      const didResetForFirstUse = await resetStatsForFirstUseIfNeeded();
      if (!didResetForFirstUse) {
        await updateStreak();
      }
      const user = await getUserProfile();
      setProfile(user);
      await refreshAttemptStats();
      await refreshEventStats();
      const [savedTheme, onboardingDone, savedName, savedSubject] = await Promise.all([
        getMetaValue(THEME_META_KEY),
        getMetaValue(ONBOARDING_META_KEY),
        getMetaValue(ONBOARDING_NAME_KEY),
        getMetaValue(ONBOARDING_SUBJECT_KEY),
      ]);
      if (
        savedTheme &&
        (savedTheme === "hall-of-fame" ||
          savedTheme === "minimal-dark" ||
          savedTheme === "neon-court")
      ) {
        setThemeId(savedTheme);
      }
      if (savedName && savedName.trim().length > 0) {
        setOnboardingName(savedName.trim());
        setProfile((current) => (current ? { ...current, prenom: savedName.trim() } : current));
      } else {
        setOnboardingName(user.prenom);
      }
      if (
        savedSubject &&
        (savedSubject === "maths" ||
          savedSubject === "fr" ||
          savedSubject === "hg" ||
          savedSubject === "physique" ||
          savedSubject === "svt")
      ) {
        setOnboardingSubject(savedSubject);
        setSelectedSubjectId(savedSubject);
      }
      setShowOnboarding(onboardingDone !== "1");
      const resumeRaw = await getMetaValue(SESSION_RESUME_KEY);
      if (resumeRaw) {
        try {
          const parsed = JSON.parse(resumeRaw) as { mode?: string; subjectId?: SubjectId | null };
          if (parsed.mode) {
            setResumeSuggestion(
              parsed.subjectId
                ? `Reprendre ${parsed.mode} (${SUBJECT_LABEL_BY_ID[parsed.subjectId]})`
                : `Reprendre ${parsed.mode}`
            );
          }
        } catch {
          setResumeSuggestion(null);
        }
      }
    }

    void bootstrap();
  }, []);

  const encouragement = useMemo(() => {
    const dayOfMonth = new Date().getDate();
    return ENCOURAGEMENTS[dayOfMonth % ENCOURAGEMENTS.length];
  }, []);

  const selectedSubject = SUBJECTS.find((subject) => subject.id === selectedSubjectId);
  const selectedChapters = CHAPTERS_BY_SUBJECT[selectedSubjectId];

  async function resumeLastSession() {
    const resumeRaw = await getMetaValue(SESSION_RESUME_KEY);
    if (!resumeRaw) {
      return;
    }
    try {
      const parsed = JSON.parse(resumeRaw) as { mode?: string; subjectId?: SubjectId | null };
      const subjectId = parsed.subjectId ?? undefined;
      if (!parsed.mode) {
        return;
      }
      if (parsed.mode.toLowerCase().includes("qcm")) {
        startQcm(subjectId);
        return;
      }
      if (parsed.mode.toLowerCase().includes("calcul")) {
        startCalcul();
        return;
      }
      if (parsed.mode.toLowerCase().includes("réponse courte")) {
        startShortAnswer(subjectId);
        return;
      }
      if (parsed.mode.toLowerCase().includes("analyse")) {
        startAnalysisDoc(subjectId);
        return;
      }
      if (parsed.mode.toLowerCase().includes("expert")) {
        startAnnalesExpertMode(subjectId);
        return;
      }
      startAnnalesMode(subjectId);
    } catch {
      setResumeSuggestion(null);
    }
  }

  async function handleDemoXP() {
    const updated = await updateXP(10);
    setProfile(updated);
  }

  function openSubjectDetail(subjectId: SubjectId) {
    setSelectedSubjectId(subjectId);
    setView("matiere-detail");
  }

  function startQcm(subjectId?: SubjectId) {
    const scopedQuestionsBase = subjectId
      ? QCM_QUESTIONS.filter((question) => question.matiere === subjectId)
      : QCM_QUESTIONS.filter((question) => question.matiere === "maths");
    const scopedQuestions = scopedQuestionsBase.length ? scopedQuestionsBase : QCM_QUESTIONS;
    const mistakes = recentMistakes
      .filter((mistake) =>
        scopedQuestions.some((question) => question.id === mistake.exerciseId)
      )
      .map((mistake) =>
        scopedQuestions.find((question) => question.id === mistake.exerciseId)
      )
      .filter((value): value is QcmQuestion => Boolean(value));
    const uniqueMistakes = Array.from(new Map(mistakes.map((q) => [q.id, q])).values());
    const remainder = scopedQuestions.filter(
      (question) => !uniqueMistakes.some((mistake) => mistake.id === question.id)
    );
    const orderedAdaptive = [...uniqueMistakes, ...remainder].sort(
      (a, b) => b.difficulty - a.difficulty
    );
    setQcmSessionQuestions(orderedAdaptive);
    setQcmRetryQueue([]);
    setQcmRetryRound(false);
    setQuestionIndex(0);
    setSelectedChoice(null);
    setSessionCorrectCount(0);
    setSessionXpEarned(0);
    setView("qcm");
    setResumeSuggestion(
      `Reprendre QCM (${SUBJECT_LABEL_BY_ID[(subjectId ?? "maths") as SubjectId]})`
    );
    void saveSessionResume("QCM", subjectId);
    void logEvent("session_start", { mode: "qcm", subjectId: subjectId ?? "maths" });
  }

  async function handleChooseAnswer(choice: string) {
    if (selectedChoice) {
      return;
    }
    const question = qcmSessionQuestions[questionIndex];
    const isCorrect = question.correctAnswer === choice;
    const points = pointsForDifficulty(question.difficulty);
    setSelectedChoice(choice);

    await saveAttempt({
      exercise_id: question.id,
      reponse_donnee: choice,
      is_correct: isCorrect ? 1 : 0,
      score: isCorrect ? points : 0,
    });
    await refreshAttemptStats();
    await logEvent("answer_submitted", {
      mode: "qcm",
      exerciseId: question.id,
      isCorrect,
    });
    await refreshEventStats();

    if (isCorrect) {
      triggerConfetti();
      setSessionCorrectCount((value) => value + 1);
      setSessionXpEarned((value) => value + points);
      const updated = await updateXP(points);
      setProfile(updated);
    } else {
      setQcmRetryQueue((current) =>
        current.some((queued) => queued.id === question.id) ? current : [...current, question]
      );
    }
  }

  function nextQuestion() {
    if (questionIndex < qcmSessionQuestions.length - 1) {
      setQuestionIndex((value) => value + 1);
      setSelectedChoice(null);
      return;
    }
    if (!qcmRetryRound && qcmRetryQueue.length) {
      setQcmSessionQuestions(qcmRetryQueue);
      setQcmRetryRound(true);
      setQcmRetryQueue([]);
      setQuestionIndex(0);
      setSelectedChoice(null);
      return;
    }
    setQuestionIndex(qcmSessionQuestions.length);
  }

  function leaveQcm() {
    if (sessionCorrectCount === qcmSessionQuestions.length) {
      setPerfectSessions((value) => value + 1);
    }
    void clearSessionResume();
    void logEvent("session_complete", {
      mode: "qcm",
      score: sessionCorrectCount,
      total: qcmSessionQuestions.length,
      xp: sessionXpEarned,
    });
    setView("tabs");
    setQuestionIndex(0);
    setSelectedChoice(null);
  }

  function startCalcul() {
    setCalcStep(1);
    setFormulaChoice(null);
    setDistanceValue("");
    setTimeValue("");
    setConclusionText("");
    setCalcCompleted(false);
    setCalcIsCorrect(false);
    setView("calcul");
    setResumeSuggestion("Reprendre Calcul guidé");
    void saveSessionResume("Calcul guidé", "physique");
    void logEvent("session_start", { mode: "calcul" });
  }

  function goToStep2() {
    if (!formulaChoice) {
      return;
    }
    setCalcStep(2);
  }

  function goToStep3() {
    if (!distanceValue || !timeValue) {
      return;
    }
    setCalcStep(3);
  }

  async function validateCalculation() {
    if (calcCompleted) {
      return;
    }

    const d = Number(distanceValue);
    const t = Number(timeValue);
    const isFormulaCorrect = formulaChoice === "v = d / t";
    const areValuesCorrect = d === 150 && t === 2;
    const hasConclusion = conclusionText.trim().length > 8;
    const isCorrect = isFormulaCorrect && areValuesCorrect && hasConclusion;
    const points = Math.round(DIFFICULTY_POINTS[2] * xpMultiplier);

    await saveAttempt({
      exercise_id: 1001,
      reponse_donnee: JSON.stringify({
        formulaChoice,
        distanceValue,
        timeValue,
        conclusionText,
      }),
      is_correct: isCorrect ? 1 : 0,
      score: isCorrect ? points : 0,
    });
    await refreshAttemptStats();
    await logEvent("answer_submitted", {
      mode: "calcul",
      exerciseId: 1001,
      isCorrect,
    });
    await refreshEventStats();

    if (isCorrect) {
      triggerConfetti();
      const updated = await updateXP(points);
      setProfile(updated);
    }

    setCalcIsCorrect(isCorrect);
    setCalcCompleted(true);
  }

  function startShortAnswer(subjectId?: SubjectId) {
    const scopedExercises = subjectId
      ? SHORT_ANSWER_EXERCISES.filter((exercise) => exercise.matiere === subjectId)
      : SHORT_ANSWER_EXERCISES;
    setShortSessionExercises(
      scopedExercises.length ? scopedExercises : SHORT_ANSWER_EXERCISES
    );
    setShortIndex(0);
    setShortAnswerText("");
    setShortFeedback(null);
    setShortSubmitted(false);
    setShortWasCorrect(false);
    setView("short-answer");
    setResumeSuggestion(
      subjectId
        ? `Reprendre Réponse courte (${SUBJECT_LABEL_BY_ID[subjectId]})`
        : "Reprendre Réponse courte"
    );
    void saveSessionResume("Réponse courte", subjectId);
    void logEvent("session_start", { mode: "short-answer", subjectId: subjectId ?? "mixte" });
  }

  async function submitShortAnswer() {
    if (shortSubmitted) {
      return;
    }
    const exercise = shortSessionExercises[shortIndex];
    const answer = normalizeAnswer(shortAnswerText);
    const isCorrect = exercise.acceptedAnswers
      .map(normalizeAnswer)
      .some((accepted) => answer === accepted || answer.includes(accepted));
    const points = pointsForDifficulty(exercise.difficulty);

    await saveAttempt({
      exercise_id: exercise.id,
      reponse_donnee: shortAnswerText,
      is_correct: isCorrect ? 1 : 0,
      score: isCorrect ? points : 0,
    });
    await refreshAttemptStats();
    await logEvent("answer_submitted", {
      mode: "short-answer",
      exerciseId: exercise.id,
      isCorrect,
    });
    await refreshEventStats();

    if (isCorrect) {
      triggerConfetti();
      const updated = await updateXP(points);
      setProfile(updated);
      setShortFeedback(`Bonne reponse. +${points} XP`);
    } else {
      setShortFeedback(
        `Reponse attendue: ${exercise.acceptedAnswers[0]}. Astuce: ${exercise.hint}`
      );
    }
    setShortWasCorrect(isCorrect);
    setShortSubmitted(true);
  }

  function nextShortExercise() {
    if (shortIndex < shortSessionExercises.length - 1) {
      setShortIndex((value) => value + 1);
      setShortAnswerText("");
      setShortFeedback(null);
      setShortSubmitted(false);
      setShortWasCorrect(false);
      return;
    }
    void clearSessionResume();
    void logEvent("session_complete", {
      mode: "short-answer",
      score: shortWasCorrect ? 1 : 0,
      total: shortSessionExercises.length,
    });
    setView("tabs");
  }

  function startAnalysisDoc(subjectId?: SubjectId) {
    const scopedExercises = subjectId
      ? ANALYSIS_EXERCISES.filter((exercise) => exercise.matiere === subjectId)
      : ANALYSIS_EXERCISES;
    setAnalysisSessionExercises(
      scopedExercises.length ? scopedExercises : ANALYSIS_EXERCISES
    );
    setAnalysisIndex(0);
    setAnalysisAnswerText("");
    setAnalysisFeedback(null);
    setAnalysisSubmitted(false);
    setAnalysisWasCorrect(false);
    setView("analysis-doc");
    setResumeSuggestion(
      subjectId
        ? `Reprendre Analyse document (${SUBJECT_LABEL_BY_ID[subjectId]})`
        : "Reprendre Analyse document"
    );
    void saveSessionResume("Analyse document", subjectId);
    void logEvent("session_start", { mode: "analysis-doc", subjectId: subjectId ?? "mixte" });
  }

  async function submitAnalysisAnswer() {
    if (analysisSubmitted) {
      return;
    }
    const exercise = analysisSessionExercises[analysisIndex];
    const normalizedAnswer = normalizeAnswer(analysisAnswerText);
    const hits = exercise.expectedKeywords.filter((keyword) =>
      normalizedAnswer.includes(normalizeAnswer(keyword))
    );
    const hasStructure = analysisAnswerText.trim().length >= 45;
    const isCorrect = hits.length >= 2 && hasStructure;
    const points = DIFFICULTY_POINTS[exercise.difficulty];
    const gainedPoints = pointsForDifficulty(exercise.difficulty);
    const rubricFeedback = [
      `Mots-cles trouves: ${hits.length}/${exercise.expectedKeywords.length}`,
      hasStructure ? "Longueur: OK" : "Longueur: ajoute 1-2 phrases",
      isCorrect ? `Resultat: acquis (+${gainedPoints} XP)` : "Resultat: a renforcer",
    ].join(" • ");

    await saveAttempt({
      exercise_id: exercise.id,
      reponse_donnee: analysisAnswerText,
      is_correct: isCorrect ? 1 : 0,
      score: isCorrect ? gainedPoints : 0,
    });
    await refreshAttemptStats();
    await logEvent("answer_submitted", {
      mode: "analysis-doc",
      exerciseId: exercise.id,
      isCorrect,
    });
    await refreshEventStats();

    if (isCorrect) {
      triggerConfetti();
      const updated = await updateXP(gainedPoints);
      setProfile(updated);
    }
    setAnalysisWasCorrect(isCorrect);
    setAnalysisFeedback(rubricFeedback);
    setAnalysisSubmitted(true);
  }

  function nextAnalysisExercise() {
    if (analysisIndex < analysisSessionExercises.length - 1) {
      setAnalysisIndex((value) => value + 1);
      setAnalysisAnswerText("");
      setAnalysisFeedback(null);
      setAnalysisSubmitted(false);
      setAnalysisWasCorrect(false);
      return;
    }
    void clearSessionResume();
    void logEvent("session_complete", {
      mode: "analysis-doc",
      score: analysisWasCorrect ? 1 : 0,
      total: analysisSessionExercises.length,
    });
    setView("tabs");
  }

  function startAnnalesMode(subjectId?: SubjectId) {
    const scopedItems = subjectId
      ? ANNALES_ITEMS.filter((item) => item.matiere === subjectId)
      : ANNALES_ITEMS;
    setAnnalesSessionItems(scopedItems.length ? scopedItems : ANNALES_ITEMS);
    setAnnalesIndex(0);
    setAnnalesChoice(null);
    setAnnalesTextAnswer("");
    setAnnalesFormulaInput("");
    setAnnalesResultInput("");
    setAnnalesSubmitted(false);
    setAnnalesWasCorrect(false);
    setAnnalesFeedback(null);
    setAnnalesScore(0);
    setAnnalesXp(0);
    setView("annales");
    setResumeSuggestion(
      subjectId
        ? `Reprendre Annales mixte (${SUBJECT_LABEL_BY_ID[subjectId]})`
        : "Reprendre Annales mixte"
    );
    void saveSessionResume("Annales mixte", subjectId);
    void logEvent("session_start", { mode: "annales", level: "mixte", subjectId: subjectId ?? "mixte" });
  }

  function startAnnalesExpertMode(subjectId?: SubjectId) {
    const expertItems = ANNALES_ITEMS.filter((item) => {
      const difficultyOk = item.difficulty >= 2;
      const subjectOk = subjectId ? item.matiere === subjectId : true;
      return difficultyOk && subjectOk;
    });
    setAnnalesSessionItems(expertItems.length ? expertItems : ANNALES_ITEMS);
    setAnnalesIndex(0);
    setAnnalesChoice(null);
    setAnnalesTextAnswer("");
    setAnnalesFormulaInput("");
    setAnnalesResultInput("");
    setAnnalesSubmitted(false);
    setAnnalesWasCorrect(false);
    setAnnalesFeedback(null);
    setAnnalesScore(0);
    setAnnalesXp(0);
    setView("annales");
    setResumeSuggestion(
      subjectId
        ? `Reprendre Annales expert (${SUBJECT_LABEL_BY_ID[subjectId]})`
        : "Reprendre Annales expert"
    );
    void saveSessionResume("Annales expert", subjectId);
    void logEvent("session_start", { mode: "annales", level: "expert", subjectId: subjectId ?? "mixte" });
  }

  async function submitAnnalesItem() {
    if (annalesSubmitted) {
      return;
    }
    const item = annalesSessionItems[annalesIndex];
    const points = pointsForDifficulty(item.difficulty);
    let isCorrect = false;
    let responsePayload = "";
    let feedback = "";

    if (item.mode === "qcm") {
      isCorrect = annalesChoice === item.correctAnswer;
      responsePayload = annalesChoice ?? "";
      feedback = isCorrect ? `Correct. ${item.explanation}` : `Correction: ${item.correctAnswer}`;
    }

    if (item.mode === "short") {
      const normalized = normalizeAnswer(annalesTextAnswer);
      isCorrect = item.acceptedAnswers
        .map(normalizeAnswer)
        .some((accepted) => normalized === accepted || normalized.includes(accepted));
      responsePayload = annalesTextAnswer;
      feedback = isCorrect
        ? "Bonne reponse."
        : `Reponse attendue: ${item.acceptedAnswers[0]}. Astuce: ${item.hint}`;
    }

    if (item.mode === "analysis") {
      const normalized = normalizeAnswer(annalesTextAnswer);
      const hits = item.expectedKeywords.filter((keyword) =>
        normalized.includes(normalizeAnswer(keyword))
      ).length;
      isCorrect = hits >= 2 && annalesTextAnswer.trim().length >= 40;
      responsePayload = annalesTextAnswer;
      feedback = `Rubrique: ${hits}/${item.expectedKeywords.length} mots-cles pertinents`;
    }

    if (item.mode === "calcul") {
      const providedResult = Number(annalesResultInput);
      const formulaOk = isSpeedFormulaEquivalent(annalesFormulaInput);
      const resultOk = Math.abs(providedResult - item.expectedResult) <= item.tolerance;
      isCorrect = formulaOk && resultOk;
      responsePayload = JSON.stringify({
        formula: annalesFormulaInput,
        result: annalesResultInput,
      });
      feedback = isCorrect
        ? `Correct: ${item.expectedResult} ${item.unit}`
        : `Attendu: formule ${item.expectedFormula} (formats acceptés: V=D/T, V = D / T, d/t=v) et ${item.expectedResult} ${item.unit}`;
    }

    await saveAttempt({
      exercise_id: item.id,
      reponse_donnee: responsePayload,
      is_correct: isCorrect ? 1 : 0,
      score: isCorrect ? points : 0,
    });
    await refreshAttemptStats();
    await logEvent("answer_submitted", {
      mode: "annales",
      exerciseId: item.id,
      isCorrect,
    });
    await refreshEventStats();

    if (isCorrect) {
      triggerConfetti();
      const updated = await updateXP(points);
      setProfile(updated);
      setAnnalesScore((value) => value + 1);
      setAnnalesXp((value) => value + points);
    }
    setAnnalesWasCorrect(isCorrect);
    setAnnalesFeedback(feedback);
    setAnnalesSubmitted(true);
  }

  function goNextAnnalesItem() {
    if (annalesIndex < annalesSessionItems.length - 1) {
      setAnnalesIndex((value) => value + 1);
      setAnnalesChoice(null);
      setAnnalesTextAnswer("");
      setAnnalesFormulaInput("");
      setAnnalesResultInput("");
      setAnnalesSubmitted(false);
      setAnnalesWasCorrect(false);
      setAnnalesFeedback(null);
      return;
    }
    if (annalesScore === annalesSessionItems.length) {
      setPerfectSessions((value) => value + 1);
    }
    void clearSessionResume();
    void logEvent("session_complete", {
      mode: "annales",
      score: annalesScore,
      total: annalesSessionItems.length,
      xp: annalesXp,
    });
    setAnnalesIndex(annalesSessionItems.length);
  }

  function renderQcmScreen() {
    if (!qcmSessionQuestions.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>QCM</Text>
          <Text style={styles.subtitle}>
            Aucun QCM disponible pour cette matière pour le moment.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => setView("tabs")}>
            <Text style={styles.secondaryButtonText}>Retour</Text>
          </Pressable>
        </View>
      );
    }

    if (questionIndex >= qcmSessionQuestions.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>Résultat QCM ✅</Text>
          <Text style={styles.subtitle}>
            Score: {sessionCorrectCount}/{qcmSessionQuestions.length}
          </Text>
          <Text style={styles.subtitle}>XP gagné: +{sessionXpEarned}</Text>
          <Pressable style={styles.primaryButton} onPress={leaveQcm}>
            <Text style={styles.primaryButtonText}>Retour aux matières</Text>
          </Pressable>
        </View>
      );
    }

    const question = qcmSessionQuestions[questionIndex];
    const isAnswered = selectedChoice !== null;
    const subjectName =
      SUBJECTS.find((subject) => subject.id === question.matiere)?.name ?? "Matière";

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.screenContent}>
          <Pressable style={styles.secondaryButton} onPress={confirmLeaveFlow}>
            <Text style={styles.secondaryButtonText}>← Retour</Text>
          </Pressable>
          <Text style={styles.h1}>QCM • {subjectName}</Text>
          <Text style={styles.subtitle}>
            Question {questionIndex + 1}/{qcmSessionQuestions.length}
          </Text>
          <Text style={styles.subtitle}>
            Difficulté: {DIFFICULTY_LABELS[question.difficulty]} • {pointsForDifficulty(question.difficulty)} pts
          </Text>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${((questionIndex + 1) / qcmSessionQuestions.length) * 100}%` },
              ]}
            />
          </View>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: questionCardAnim,
                transform: [
                  {
                    translateY: questionCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.cardTitle}>{question.enonce}</Text>
            {question.choices.map((choice) => {
              const isCorrect = choice === question.correctAnswer;
              const isSelected = choice === selectedChoice;
              const choiceStyle =
                isAnswered && isCorrect
                  ? styles.choiceCorrect
                  : isAnswered && isSelected
                  ? styles.choiceWrong
                  : styles.choiceDefault;

              return (
                <Pressable
                  key={choice}
                  onPress={() => void handleChooseAnswer(choice)}
                  style={[styles.choiceButton, choiceStyle]}
                >
                  <Text style={styles.choiceText}>{choice}</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        </ScrollView>

        {isAnswered && (
          <Animated.View
            style={[
              styles.feedbackBar,
              {
                opacity: qcmFeedbackAnim,
                transform: [
                  {
                    translateY: qcmFeedbackAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.feedbackText}>
              {selectedChoice === question.correctAnswer
                ? `✅ Correct ! +${pointsForDifficulty(question.difficulty)} XP`
                : "❌ Incorrect"}
            </Text>
            <Text style={styles.feedbackHint}>{question.explication}</Text>
            {selectedChoice !== question.correctAnswer && (
              <Text style={styles.feedbackHint}>{getQcmCoachingHint(question)}</Text>
            )}
            <Pressable style={styles.feedbackButton} onPress={nextQuestion}>
              <Text style={styles.feedbackButtonText}>Continuer</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    );
  }

  function renderMatiereDetail() {
    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Text style={styles.h1}>
          {selectedSubject?.icon} {selectedSubject?.name}
        </Text>
        <Text style={styles.subtitle}>
          Progression: {progressMap[selectedSubjectId]}%
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chapitres</Text>
          {selectedChapters.map((chapter, index) => (
            <View key={chapter.id} style={styles.chapterRow}>
              <Text style={styles.subjectLabel}>
                {index + 1}. {chapter.title}
              </Text>
            </View>
          ))}
        </View>

        {selectedSubjectId === "maths" && (
          <Pressable style={styles.primaryButton} onPress={() => startQcm("maths")}>
            <Text style={styles.primaryButtonText}>Faire un QCM de Maths</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.secondaryButton}
          onPress={() => startShortAnswer(selectedSubjectId)}
        >
          <Text style={styles.secondaryButtonText}>Réponse courte</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => startAnalysisDoc(selectedSubjectId)}
        >
          <Text style={styles.secondaryButtonText}>Analyse de document</Text>
        </Pressable>

        {(selectedSubjectId === "maths" || selectedSubjectId === "physique") && (
          <Pressable style={styles.secondaryButton} onPress={startCalcul}>
            <Text style={styles.secondaryButtonText}>Exercice calcul guidé</Text>
          </Pressable>
        )}

        <Pressable style={styles.secondaryButton} onPress={() => setView("tabs")}>
          <Text style={styles.secondaryButtonText}>Retour aux matières</Text>
        </Pressable>
      </ScrollView>
    );
  }

  function renderCalculScreen() {
    const expectedSpeed = 75;
    const enteredDistance = Number(distanceValue);
    const enteredTime = Number(timeValue);
    const computedSpeed =
      enteredDistance > 0 && enteredTime > 0 ? enteredDistance / enteredTime : 0;

    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Pressable style={styles.secondaryButton} onPress={confirmLeaveFlow}>
          <Text style={styles.secondaryButtonText}>← Retour</Text>
        </Pressable>
        <Text style={styles.h1}>Calcul guidé ⚗️</Text>
        <Text style={styles.subtitle}>
          Une voiture parcourt 150 km en 2 heures. Quelle est sa vitesse ?
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Étape 1 — Choisir la formule</Text>
          {FORMULA_OPTIONS.map((option) => (
            <Pressable
              key={option}
              style={[
                styles.choiceButton,
                formulaChoice === option ? styles.choiceCorrect : styles.choiceDefault,
              ]}
              onPress={() => setFormulaChoice(option)}
            >
              <Text style={styles.choiceText}>{option}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.primaryButton} onPress={goToStep2}>
            <Text style={styles.primaryButtonText}>Valider étape 1</Text>
          </Pressable>
        </View>

        {calcStep >= 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Étape 2 — Remplacer les valeurs</Text>
            <Text style={styles.subtitle}>v = d / t</Text>
            <TextInput
              style={styles.input}
              value={distanceValue}
              onChangeText={setDistanceValue}
              keyboardType="numeric"
              placeholder="Distance (km)"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              keyboardAppearance="dark"
            />
            <TextInput
              style={styles.input}
              value={timeValue}
              onChangeText={setTimeValue}
              keyboardType="numeric"
              placeholder="Temps (h)"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              keyboardAppearance="dark"
            />
            <Pressable style={styles.primaryButton} onPress={goToStep3}>
              <Text style={styles.primaryButtonText}>Calculer</Text>
            </Pressable>
          </View>
        )}

        {calcStep >= 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Étape 3 — Rédiger la conclusion</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={conclusionText}
              onChangeText={setConclusionText}
              multiline
              placeholder="La vitesse est de..."
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              keyboardAppearance="dark"
            />
            <Pressable style={styles.primaryButton} onPress={() => void validateCalculation()}>
              <Text style={styles.primaryButtonText}>Valider (20 pts)</Text>
            </Pressable>
          </View>
        )}

        {calcCompleted && (
          <View style={styles.feedbackBar}>
            <Text style={styles.feedbackText}>
              {calcIsCorrect ? "Correction complète ✅ (+20 XP)" : "Correction complète"}
            </Text>
            <Text style={styles.feedbackHint}>Formule correcte: v = d / t</Text>
            <Text style={styles.feedbackHint}>Remplacement: v = 150 / 2</Text>
            <Text style={styles.feedbackHint}>
              Résultat: v = {computedSpeed || expectedSpeed} km/h (attendu: 75 km/h)
            </Text>
            <Text style={styles.feedbackHint}>
              Conclusion type: La vitesse moyenne de la voiture est de 75 km/h.
            </Text>
            <Pressable
              style={styles.feedbackButton}
              onPress={() =>
                completeSessionAndReturn("calcul", { success: calcIsCorrect ? 1 : 0 })
              }
            >
              <Text style={styles.feedbackButtonText}>Retour à l'accueil</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderShortAnswerScreen() {
    const exercise = shortSessionExercises[shortIndex];
    if (!exercise) {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>Réponse courte ✍️</Text>
          <Text style={styles.subtitle}>
            Aucun exercice disponible pour cette matière pour le moment.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => setView("tabs")}>
            <Text style={styles.secondaryButtonText}>Retour</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Pressable style={styles.secondaryButton} onPress={confirmLeaveFlow}>
          <Text style={styles.secondaryButtonText}>← Retour</Text>
        </Pressable>
        <Text style={styles.h1}>Réponse courte ✍️</Text>
        <Text style={styles.subtitle}>
          Exercice {shortIndex + 1}/{shortSessionExercises.length}
        </Text>
        <Text style={styles.subtitle}>
          Difficulté: {DIFFICULTY_LABELS[exercise.difficulty]} ({difficultyTag(exercise.difficulty)}) •{" "}
          {DIFFICULTY_POINTS[exercise.difficulty]} pts
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{exercise.title}</Text>
          <Text style={styles.subtitle}>{exercise.enonce}</Text>
          <TextInput
            style={styles.input}
            value={shortAnswerText}
            onChangeText={setShortAnswerText}
            editable={!shortSubmitted}
            placeholder="Ecris une reponse courte"
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            keyboardAppearance="dark"
          />
          {!shortSubmitted ? (
            <Pressable style={styles.primaryButton} onPress={() => void submitShortAnswer()}>
              <Text style={styles.primaryButtonText}>Verifier la reponse</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryButton} onPress={nextShortExercise}>
              <Text style={styles.primaryButtonText}>Exercice suivant</Text>
            </Pressable>
          )}
        </View>
        {shortFeedback && (
          <View style={styles.feedbackBar}>
            <Text style={styles.feedbackText}>{shortWasCorrect ? "✅ Valide" : "❌ A corriger"}</Text>
            <Text style={styles.feedbackHint}>{shortFeedback}</Text>
            <Pressable
              style={styles.feedbackButton}
              onPress={() =>
                completeSessionAndReturn("short-answer", { success: shortWasCorrect ? 1 : 0 })
              }
            >
              <Text style={styles.feedbackButtonText}>Retour</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderAnalysisDocScreen() {
    const exercise = analysisSessionExercises[analysisIndex];
    if (!exercise) {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>Analyse de document 🧠</Text>
          <Text style={styles.subtitle}>
            Aucun exercice disponible pour cette matière pour le moment.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => setView("tabs")}>
            <Text style={styles.secondaryButtonText}>Retour</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Pressable style={styles.secondaryButton} onPress={confirmLeaveFlow}>
          <Text style={styles.secondaryButtonText}>← Retour</Text>
        </Pressable>
        <Text style={styles.h1}>Analyse de document 🧠</Text>
        <Text style={styles.subtitle}>
          Exercice {analysisIndex + 1}/{analysisSessionExercises.length}
        </Text>
        <Text style={styles.subtitle}>
          Difficulté: {DIFFICULTY_LABELS[exercise.difficulty]} ({difficultyTag(exercise.difficulty)}) •{" "}
          {DIFFICULTY_POINTS[exercise.difficulty]} pts
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{exercise.title}</Text>
          <Text style={styles.subtitle}>Source</Text>
          <Text style={styles.feedbackHint}>{exercise.sourceText}</Text>
          <Text style={styles.subtitle}>{exercise.prompt}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={analysisAnswerText}
            onChangeText={setAnalysisAnswerText}
            editable={!analysisSubmitted}
            multiline
            placeholder="Redige ton analyse"
            placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
            keyboardAppearance="dark"
          />
          {!analysisSubmitted ? (
            <Pressable style={styles.primaryButton} onPress={() => void submitAnalysisAnswer()}>
              <Text style={styles.primaryButtonText}>Evaluer avec rubrique</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryButton} onPress={nextAnalysisExercise}>
              <Text style={styles.primaryButtonText}>Exercice suivant</Text>
            </Pressable>
          )}
        </View>
        {analysisFeedback && (
          <View style={styles.feedbackBar}>
            <Text style={styles.feedbackText}>
              {analysisWasCorrect ? "✅ Analyse validee" : "❌ Analyse partielle"}
            </Text>
            <Text style={styles.feedbackHint}>{analysisFeedback}</Text>
            <Pressable
              style={styles.feedbackButton}
              onPress={() =>
                completeSessionAndReturn("analysis-doc", {
                  success: analysisWasCorrect ? 1 : 0,
                })
              }
            >
              <Text style={styles.feedbackButtonText}>Retour</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderAnnalesScreen() {
    if (annalesIndex >= annalesSessionItems.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>Recap Annales 🏁</Text>
          <Text style={styles.subtitle}>
            Score: {annalesScore}/{annalesSessionItems.length}
          </Text>
          <Text style={styles.subtitle}>XP gagne: +{annalesXp}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              completeSessionAndReturn("annales", {
                score: annalesScore,
                total: annalesSessionItems.length,
                xp: annalesXp,
              })
            }
          >
            <Text style={styles.primaryButtonText}>Terminer</Text>
          </Pressable>
        </View>
      );
    }

    const item = annalesSessionItems[annalesIndex];

    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Pressable style={styles.secondaryButton} onPress={confirmLeaveFlow}>
          <Text style={styles.secondaryButtonText}>← Retour</Text>
        </Pressable>
        <Text style={styles.h1}>Défi Annales 📚</Text>
        <Text style={styles.subtitle}>
          Sujet {item.year} • {annalesIndex + 1}/{annalesSessionItems.length}
        </Text>
        <Text style={styles.subtitle}>
          Type: {item.mode.toUpperCase()} • {DIFFICULTY_LABELS[item.difficulty]} ({difficultyTag(item.difficulty)}) •{" "}
          {DIFFICULTY_POINTS[item.difficulty]} pts
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.enonce}</Text>

          {item.mode === "qcm" &&
            item.choices.map((choice) => (
              <Pressable
                key={choice}
                style={[
                  styles.choiceButton,
                  annalesChoice === choice ? styles.choiceCorrect : styles.choiceDefault,
                ]}
                onPress={() => setAnnalesChoice(choice)}
              >
                <Text style={styles.choiceText}>{choice}</Text>
              </Pressable>
            ))}

          {(item.mode === "short" || item.mode === "analysis") && (
            <TextInput
              style={[styles.input, item.mode === "analysis" && styles.textArea]}
              value={annalesTextAnswer}
              onChangeText={setAnnalesTextAnswer}
              editable={!annalesSubmitted}
              multiline={item.mode === "analysis"}
              placeholder="Entre ta reponse"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              keyboardAppearance="dark"
            />
          )}

          {item.mode === "analysis" && (
            <View style={styles.card}>
              <Text style={styles.subtitle}>Document source</Text>
              <Text style={styles.feedbackHint}>{item.sourceText}</Text>
            </View>
          )}

          {item.mode === "calcul" && (
            <View style={{ gap: 8 }}>
              <TextInput
                style={styles.input}
                value={annalesFormulaInput}
                onChangeText={setAnnalesFormulaInput}
                editable={!annalesSubmitted}
                placeholder="Formule utilisee"
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardAppearance="dark"
              />
              <TextInput
                style={styles.input}
                value={annalesResultInput}
                onChangeText={setAnnalesResultInput}
                editable={!annalesSubmitted}
                keyboardType="numeric"
                placeholder={`Resultat (${item.unit})`}
                placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                keyboardAppearance="dark"
              />
            </View>
          )}

          {!annalesSubmitted ? (
            <Pressable style={styles.primaryButton} onPress={() => void submitAnnalesItem()}>
              <Text style={styles.primaryButtonText}>Valider</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryButton} onPress={goNextAnnalesItem}>
              <Text style={styles.primaryButtonText}>Question suivante</Text>
            </Pressable>
          )}
        </View>

        {annalesFeedback && (
          <View style={styles.feedbackBar}>
            <Text style={styles.feedbackText}>
              {annalesWasCorrect ? "✅ Reponse validee" : "❌ Reponse corrigee"}
            </Text>
            <Text style={styles.feedbackHint}>{annalesFeedback}</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderScreen() {
    if (!profile) {
      return (
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Chargement de BrevEt...</Text>
        </View>
      );
    }

    if (activeTab === "accueil") {
      return (
        <ScrollView contentContainerStyle={styles.screenContent}>
          <View
            style={[
              styles.muralCard,
              {
                backgroundColor: themePack.palette.card,
                borderColor: themePack.palette.cardBorder,
              },
            ]}
          >
            <ImageBackground
              source={wallpaperUri ? { uri: wallpaperUri } : undefined}
              resizeMode="cover"
              style={styles.muralBackground}
              imageStyle={styles.muralBackgroundImage}
            >
              <View style={styles.muralOverlay}>
                <Text style={[styles.muralTitle, { color: themePack.palette.accent }]}>
                  {themePack.muralTitle}
                </Text>
                <Text style={[styles.muralHint, { color: themePack.palette.subText }]}>
                  {themePack.muralHint}
                </Text>
                <Text style={[styles.muralSymbols, { color: themePack.palette.text }]}>
                  {themePack.muralSymbols}
                </Text>
                {themePack.credits ? (
                  <Text style={styles.muralCredits}>{themePack.credits}</Text>
                ) : null}
              </View>
            </ImageBackground>
          </View>
          <View style={styles.rowBetween}>
            <View>
              <Text style={[styles.h1, { color: themePack.palette.accent }]}>
                BrevEt • Mode entraînement
              </Text>
              <Text style={[styles.subtitle, { color: themePack.palette.subText }]}>
                Salut {profile.prenom}, prêt à entrer sur le parquet ?
              </Text>
            </View>
            <Animated.View
              style={[
                styles.streakPill,
                {
                  transform: [{ scale: streakPulseAnim }],
                  borderColor: themePack.palette.accent,
                },
              ]}
            >
              <Text style={styles.streakText}>🔥 {profile.streak_count}</Text>
            </Animated.View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Objectif du jour</Text>
            <Text style={styles.valueText}>
              {profile.xp_total} / {DAILY_XP_GOAL} XP aujourd'hui
            </Text>
            <Text style={styles.subtitle}>
              Niveau {levelInfo.level} • {levelInfo.title}
            </Text>
            <Text style={styles.subtitle}>
              Multiplicateur streak: x{xpMultiplier.toFixed(2)}
            </Text>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${xpProgressDisplay}%` }]} />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.progressShine,
                  {
                    transform: [{ translateX: xpShineAnim }],
                  },
                ]}
              />
            </View>
            <Text style={styles.feedbackHint}>
              Progression niveau: {levelInfo.progress_percent}%
            </Text>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${levelInfo.progress_percent}%`, backgroundColor: "#FFD700" },
                ]}
              />
            </View>
            <AnimatedPressable
              style={[styles.primaryButton, { transform: [{ scale: pulseButtonAnim }] }]}
              onPress={handleDemoXP}
            >
              <Text style={styles.primaryButtonText}>+10 XP (démo)</Text>
            </AnimatedPressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => startQcm("maths")}
            >
              <Text style={styles.secondaryButtonText}>Lancer QCM Maths</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Jours avant le brevet</Text>
            <Text style={styles.bigNumber}>{daysUntilBrevet(new Date(2026, 5, 27))}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Continue ta saison</Text>
            {SUBJECTS.map((subject) => (
              <Pressable
                key={subject.id}
                style={({ pressed }) => [styles.subjectRow, pressed && styles.pressedScale]}
                onPress={() => openSubjectDetail(subject.id)}
              >
                <Text style={styles.subjectLabel}>
                  {subject.icon} {subject.name}
                </Text>
                <Text style={styles.subjectPercent}>{progressMap[subject.id] ?? 0}%</Text>
              </Pressable>
            ))}
          </View>

          {resumeSuggestion && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Reprise intelligente</Text>
              <Text style={styles.subtitle}>{resumeSuggestion}</Text>
              <Pressable style={styles.primaryButton} onPress={() => void resumeLastSession()}>
                <Text style={styles.primaryButtonText}>Reprendre maintenant</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.breviCard}>
            <Text style={styles.breviText}>🦉 {encouragement} 🏀</Text>
          </View>
        </ScrollView>
      );
    }

    if (activeTab === "matieres") {
      return (
        <ScrollView contentContainerStyle={styles.screenContent}>
          <Text style={styles.h1}>Matières 📚</Text>
          <View style={styles.grid}>
            {SUBJECTS.map((subject) => (
              <Pressable
                key={subject.id}
                style={({ pressed }) => [styles.subjectCard, pressed && styles.pressedScale]}
                onPress={() => openSubjectDetail(subject.id)}
              >
                <Text style={styles.subjectEmoji}>{subject.icon}</Text>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressMap[subject.id] ?? 0}%`,
                        backgroundColor: subject.color,
                      },
                    ]}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      );
    }

    if (activeTab === "defis") {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>Défis Annales 🏀</Text>
          <Text style={styles.subtitle}>Mode mixte, expert, et entraînements avancés :</Text>
          <View style={styles.filterWrap}>
            <Pressable
              style={[
                styles.filterChip,
                defiSubjectFilter === "mixte" && styles.filterChipActive,
              ]}
              onPress={() => setDefiSubjectFilter("mixte")}
            >
              <Text
                style={[
                  styles.filterChipText,
                  defiSubjectFilter === "mixte" && styles.filterChipTextActive,
                ]}
              >
                Mixte
              </Text>
            </Pressable>
            {SUBJECTS.map((subject) => (
              <Pressable
                key={`defi-${subject.id}`}
                style={[
                  styles.filterChip,
                  defiSubjectFilter === subject.id && styles.filterChipActive,
                ]}
                onPress={() => setDefiSubjectFilter(subject.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    defiSubjectFilter === subject.id && styles.filterChipTextActive,
                  ]}
                >
                  {subject.icon} {subject.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <AnimatedPressable
            style={[styles.primaryButton, { transform: [{ scale: pulseButtonAnim }] }]}
            onPress={() =>
              startQcm(
                defiSubjectFilter === "mixte"
                  ? "maths"
                  : (defiSubjectFilter as SubjectId)
              )
            }
          >
            <Text style={styles.primaryButtonText}>QCM du jour</Text>
          </AnimatedPressable>
          <Pressable style={styles.secondaryButton} onPress={startCalcul}>
            <Text style={styles.secondaryButtonText}>Calcul guidé</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              startShortAnswer(
                defiSubjectFilter === "mixte" ? undefined : defiSubjectFilter
              )
            }
          >
            <Text style={styles.secondaryButtonText}>Réponse courte</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              startAnalysisDoc(
                defiSubjectFilter === "mixte" ? undefined : defiSubjectFilter
              )
            }
          >
            <Text style={styles.secondaryButtonText}>Analyse de document</Text>
          </Pressable>
          <AnimatedPressable
            style={[styles.primaryButton, { transform: [{ scale: pulseButtonAnim }] }]}
            onPress={() =>
              startAnnalesMode(
                defiSubjectFilter === "mixte" ? undefined : defiSubjectFilter
              )
            }
          >
            <Text style={styles.primaryButtonText}>Mini mode Annales (mixte)</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.primaryButton, { transform: [{ scale: pulseButtonAnim }] }]}
            onPress={() =>
              startAnnalesExpertMode(
                defiSubjectFilter === "mixte" ? undefined : defiSubjectFilter
              )
            }
          >
            <Text style={styles.primaryButtonText}>Mode Expert Annales (difficile)</Text>
          </AnimatedPressable>
        </View>
      );
    }

    if (activeTab === "progres") {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>Progrès 📊</Text>
          <Text style={styles.subtitle}>
            XP total: {profile.xp_total} • Streak: {profile.streak_count} jours
          </Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Niveau {levelInfo.level} — {levelInfo.title}
            </Text>
            <Text style={styles.valueText}>
              Progression niveau: {levelInfo.progress_percent}%
            </Text>
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${levelInfo.progress_percent}%`, backgroundColor: "#FFD700" },
                ]}
              />
            </View>
            <Text style={styles.feedbackHint}>
              Prochain cap XP: {levelInfo.xp_next_level}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Statistiques tentatives</Text>
            <Text style={styles.valueText}>Total tentatives: {totalAttempts}</Text>
            <Text style={styles.valueText}>Réussite: {successRate}%</Text>
            <Text style={styles.valueText}>
              Correctes: {correctAttempts} / {totalAttempts}
            </Text>
            <Text style={styles.feedbackHint}>Statut: {progressBadge}</Text>
            <Text style={styles.feedbackHint}>Sessions parfaites: {perfectSessions}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Badges débloqués</Text>
            {unlockedBadges.length ? (
              unlockedBadges.map((badge) => (
                <Text key={badge} style={styles.valueText}>
                  {badge}
                </Text>
              ))
            ) : (
              <Text style={styles.feedbackHint}>Aucun badge pour l'instant.</Text>
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Revoir mes erreurs</Text>
            {recentMistakes.length ? (
              recentMistakes.map((mistake) => (
                <Text key={mistake.id} style={styles.feedbackHint}>
                  {SUBJECT_LABEL_BY_ID[mistake.subjectId]} • {mistake.label}
                </Text>
              ))
            ) : (
              <Text style={styles.feedbackHint}>
                Aucune erreur récente. Continue comme ça.
              </Text>
            )}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Qualité d'apprentissage</Text>
            <Text style={styles.feedbackHint}>
              Sessions lancées: {eventStats.session_start ?? 0}
            </Text>
            <Text style={styles.feedbackHint}>
              Réponses soumises: {eventStats.answer_submitted ?? 0}
            </Text>
            <Text style={styles.feedbackHint}>
              Sessions terminées: {eventStats.session_complete ?? 0}
            </Text>
            <Text style={styles.feedbackHint}>
              Sessions abandonnées: {eventStats.session_abandon ?? 0}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Text style={[styles.h1, { color: themePack.palette.accent }]}>Profil ⚙️</Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: themePack.palette.card,
              borderColor: themePack.palette.cardBorder,
            },
          ]}
        >
          <Text style={styles.cardTitle}>Avatar: {profile.avatar}</Text>
          <Text style={[styles.subtitle, { color: themePack.palette.subText }]}>
            Prénom: {profile.prenom}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: themePack.palette.card,
              borderColor: themePack.palette.cardBorder,
            },
          ]}
        >
          <Text style={styles.cardTitle}>Skins / Thèmes</Text>
          {(["hall-of-fame", "minimal-dark", "neon-court"] as ThemeId[]).map((id) => (
            <Pressable
              key={id}
              style={[
                styles.choiceButton,
                id === themeId ? styles.filterChipActive : styles.choiceDefault,
                {
                  borderColor: id === themeId ? themePack.palette.accent : themePack.palette.cardBorder,
                },
              ]}
              onPress={() => void applyTheme(id)}
            >
              <Text
                style={[
                  styles.choiceText,
                  id === themeId && { color: themePack.palette.buttonText },
                ]}
              >
                {THEME_PACKS[id].label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.secondaryButton, { borderColor: themePack.palette.accent }]}
            onPress={() => setShowOnboarding(true)}
          >
            <Text style={[styles.secondaryButtonText, { color: themePack.palette.accent }]}>
              Relancer onboarding
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: themePack.palette.root }]}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {view !== "tabs" && (
          <View style={styles.topNavBar}>
            <Pressable
              style={[
                styles.topNavBackButton,
                { borderColor: themePack.palette.accent },
              ]}
              onPress={handleTopBackPress}
            >
              <Text style={[styles.topNavBackText, { color: themePack.palette.accent }]}>
                ← Retour
              </Text>
            </Pressable>
          </View>
        )}
        <Animated.View
          style={[
            styles.contentInner,
            {
              opacity: screenTransitionAnim,
              transform: [
                {
                  translateY: screenTransitionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
                {
                  scale: screenTransitionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.995, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {view === "tabs" && renderScreen()}
          {view === "qcm" && renderQcmScreen()}
          {view === "matiere-detail" && renderMatiereDetail()}
          {view === "calcul" && renderCalculScreen()}
          {view === "short-answer" && renderShortAnswerScreen()}
          {view === "analysis-doc" && renderAnalysisDocScreen()}
          {view === "annales" && renderAnnalesScreen()}
        </Animated.View>
      </View>
      {view === "tabs" && (
        <View style={styles.tabBar}>
          {TAB_ITEMS.map((item) => {
            const active = item.key === activeTab;
            return (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.tabItem,
                  active && styles.tabItemActive,
                  pressed && styles.tabItemPressed,
                  {
                    transform: [{ scale: pressed ? 0.96 : active ? activeTabPulseAnim : 1 }],
                  },
                ]}
                onPress={() => setActiveTab(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Onglet ${item.label}`}
                accessibilityState={{ selected: active }}
                hitSlop={8}
              >
                <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{item.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Animated.View pointerEvents="none" style={[styles.successFlash, { opacity: successFlashAnim }]} />
      <View pointerEvents="none" style={styles.confettiLayer}>
        {CONFETTI_PARTICLES.map((particle, index) => (
          <Animated.Text
            key={`${particle.left}-${index}`}
            style={[
              styles.confettiParticle,
              {
                left: particle.left,
                opacity: confettiAnim.interpolate({
                  inputRange: [0, 0.08, 0.85, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -(150 + index * 12)],
                    }),
                  },
                  {
                    translateX: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, particle.drift],
                    }),
                  },
                  {
                    scale: confettiAnim.interpolate({
                      inputRange: [0, 0.25, 1],
                      outputRange: [0.8, 1.15, 0.95],
                    }),
                  },
                  {
                    rotate: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", `${particle.drift * 4}deg`],
                    }),
                  },
                ],
              },
            ]}
          >
            {particle.emoji}
          </Animated.Text>
        ))}
      </View>
      {showOnboarding && (
        <View style={styles.onboardingOverlay}>
          <View
            style={[
              styles.onboardingCard,
              { backgroundColor: themePack.palette.card, borderColor: themePack.palette.cardBorder },
            ]}
          >
            <Text style={[styles.h1, { color: themePack.palette.accent }]}>Bienvenue sur BrevEt</Text>
            <Text style={[styles.subtitle, { color: themePack.palette.subText }]}>
              Personnalise ton expérience de révision pour démarrer fort.
            </Text>
            <TextInput
              style={styles.input}
              value={onboardingName}
              onChangeText={setOnboardingName}
              placeholder="Ton prénom"
              placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
              keyboardAppearance="dark"
            />
            <Text style={[styles.cardTitle, { marginTop: 4 }]}>Matière prioritaire</Text>
            <View style={styles.filterWrap}>
              {SUBJECTS.map((subject) => (
                <Pressable
                  key={`onboard-${subject.id}`}
                  style={[
                    styles.filterChip,
                    onboardingSubject === subject.id && styles.filterChipActive,
                  ]}
                  onPress={() => setOnboardingSubject(subject.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      onboardingSubject === subject.id && styles.filterChipTextActive,
                    ]}
                  >
                    {subject.icon} {subject.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.cardTitle, { marginTop: 6 }]}>Style visuel</Text>
            <View style={styles.filterWrap}>
              {(["hall-of-fame", "minimal-dark", "neon-court"] as ThemeId[]).map((id) => (
                <Pressable
                  key={`theme-${id}`}
                  style={[styles.filterChip, themeId === id && styles.filterChipActive]}
                  onPress={() => setThemeId(id)}
                >
                  <Text style={[styles.filterChipText, themeId === id && styles.filterChipTextActive]}>
                    {THEME_PACKS[id].label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.primaryButton, { marginTop: 10, alignSelf: "stretch" }]}
              onPress={() => void completeOnboarding()}
            >
              <Text style={styles.primaryButtonText}>Commencer ma session</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111111" },
  content: { flex: 1 },
  topNavBar: {
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 2,
    zIndex: 40,
  },
  topNavBackButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#FF7A00",
    borderRadius: 12,
    backgroundColor: "#101010",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  topNavBackText: {
    color: "#FF7A00",
    fontWeight: "800",
    fontSize: 15,
  },
  muralCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  muralBackground: {
    width: "100%",
    minHeight: 150,
    justifyContent: "flex-end",
  },
  muralBackgroundImage: {
    opacity: 0.78,
  },
  muralOverlay: {
    padding: 14,
    gap: 6,
    backgroundColor: "rgba(8,10,12,0.42)",
  },
  muralTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  muralHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  muralSymbols: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  muralCredits: {
    marginTop: 2,
    fontSize: 11,
    color: "#A6B2C3",
    fontWeight: "600",
  },
  contentInner: {
    flex: 1,
    width: "100%",
    maxWidth: 980,
    alignSelf: "center",
  },
  screenContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34, gap: 16 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: { fontSize: 16, color: "#D0D4DE" },
  h1: { fontSize: 30, fontWeight: "800", color: "#FF7A00", lineHeight: 36 },
  subtitle: { fontSize: 15, color: "#E2E6EE", lineHeight: 22 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  streakPill: {
    backgroundColor: "#1E1E1E",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#FF7A00",
  },
  streakText: { fontWeight: "800", color: "#FF7A00" },
  card: {
    backgroundColor: "#171717",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2B2B2B",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: "#F8F5EF" },
  valueText: { fontSize: 14, color: "#ECEFF5", fontWeight: "700" },
  progressBg: {
    width: "100%",
    height: 11,
    borderRadius: 999,
    backgroundColor: "#2E323A",
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FF7A00",
  },
  progressShine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.26)",
  },
  primaryButton: {
    backgroundColor: "#FF7A00",
    borderRadius: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FF9A3E",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: { color: "#111111", fontWeight: "800" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#FF7A00",
    borderRadius: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 46,
    justifyContent: "center",
    backgroundColor: "#101010",
  },
  secondaryButtonText: { color: "#FF7A00", fontWeight: "800" },
  bigNumber: { fontSize: 44, fontWeight: "800", color: "#FF7A00" },
  subjectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#2B2B2B",
  },
  subjectLabel: { fontSize: 14, color: "#F8F5EF", fontWeight: "700" },
  subjectPercent: { fontSize: 14, fontWeight: "800", color: "#FF7A00" },
  breviCard: {
    backgroundColor: "#0F2A6B",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#244B9A",
  },
  breviText: { fontSize: 16, color: "#F8F5EF", fontWeight: "800" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  subjectCard: {
    width: "48%",
    backgroundColor: "#171717",
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#2B2B2B",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  subjectEmoji: { fontSize: 24 },
  subjectName: { fontSize: 14, fontWeight: "800", color: "#F8F5EF" },
  pressedScale: {
    transform: [{ scale: 0.98 }],
  },
  chapterRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#2B2B2B",
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    backgroundColor: "#111111",
    paddingVertical: 9,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginHorizontal: 6,
    borderRadius: 999,
    paddingVertical: 10,
    minHeight: 52,
  },
  tabItemPressed: {
    opacity: 0.86,
  },
  tabItemActive: {
    backgroundColor: "#2A1806",
    borderWidth: 1,
    borderColor: "#FF7A00",
  },
  tabIcon: { fontSize: 18, color: "#8F98AB" },
  tabIconActive: { color: "#FF7A00" },
  tabLabel: { fontSize: 11, color: "#8F98AB", fontWeight: "700" },
  tabLabelActive: { color: "#FF7A00" },
  choiceButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3A3A3A",
    backgroundColor: "#151515",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 50,
    justifyContent: "center",
    marginTop: 8,
  },
  choiceDefault: { backgroundColor: "#151515" },
  choiceCorrect: {
    backgroundColor: "#1A3320",
    borderColor: "#3FAF5B",
  },
  choiceWrong: {
    backgroundColor: "#351E1E",
    borderColor: "#E5383B",
  },
  choiceText: { color: "#F8F5EF", fontWeight: "600", fontSize: 15, lineHeight: 21 },
  feedbackBar: {
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
    backgroundColor: "#121212",
    padding: 14,
    gap: 8,
  },
  feedbackText: { fontSize: 16, fontWeight: "800", color: "#FF7A00" },
  feedbackHint: { fontSize: 15, color: "#E2E6EE", lineHeight: 22 },
  feedbackButton: {
    marginTop: 4,
    backgroundColor: "#FF7A00",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  feedbackButtonText: { color: "#111111", fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: "#3A3A3A",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    backgroundColor: "#101010",
    color: "#F8F5EF",
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  filterWrap: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#424242",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#111111",
  },
  filterChipActive: {
    backgroundColor: "#FF7A00",
    borderColor: "#FF7A00",
  },
  filterChipText: {
    fontSize: 12,
    color: "#F8F5EF",
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#111111",
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingBottom: 72,
    zIndex: 30,
  },
  confettiParticle: {
    position: "absolute",
    bottom: 16,
    fontSize: 22,
  },
  successFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FF7A00",
    zIndex: 20,
  },
  onboardingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(7,9,12,0.86)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 60,
  },
  onboardingCard: {
    width: "100%",
    maxWidth: 620,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
});
