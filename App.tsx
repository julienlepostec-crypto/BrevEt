import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
  getAttempts,
  getProgressByMatiere,
  getUserProfile,
  initDatabase,
  saveAttempt,
  updateXP,
  updateStreak,
  type ChapterProgress,
  type UserProfile,
} from "./database/db";
import {
  calculateLevel,
  checkBadges,
  getXPMultiplier,
} from "./utils/gamification";

type TabKey = "accueil" | "matieres" | "defis" | "progres" | "profil";
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
    enonce:
      "Triangle rectangle avec côtés 3 cm et 4 cm. L'hypoténuse mesure :",
    choices: ["5 cm", "6 cm", "7 cm", "4.5 cm"],
    correctAnswer: "5 cm",
    explication: "3² + 4² = 9 + 16 = 25, donc l'hypoténuse vaut 5.",
    difficulty: 1,
  },
  {
    id: 3,
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
    enonce:
      "Un triangle rectangle a pour hypoténuse 13 et un côté 5. L'autre côté vaut :",
    choices: ["12", "10", "8", "18"],
    correctAnswer: "12",
    explication: "13² - 5² = 169 - 25 = 144, donc l'autre côté vaut 12.",
    difficulty: 2,
  },
  {
    id: 5,
    enonce: "Lequel de ces triplets est pythagoricien ?",
    choices: ["6, 8, 10", "2, 3, 4", "4, 5, 6", "5, 5, 8"],
    correctAnswer: "6, 8, 10",
    explication: "6² + 8² = 36 + 64 = 100 = 10².",
    difficulty: 3,
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilBrevet(targetDate: Date): number {
  const diffMs = startOfDay(targetDate).getTime() - startOfDay(new Date()).getTime();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

function averageMastery(rows: ChapterProgress[]): number {
  if (!rows.length) {
    return 0;
  }
  const total = rows.reduce((sum, row) => sum + row.mastery_score, 0);
  return Math.round(total / rows.length);
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
  const [shortAnswerText, setShortAnswerText] = useState("");
  const [shortFeedback, setShortFeedback] = useState<string | null>(null);
  const [shortSubmitted, setShortSubmitted] = useState(false);
  const [shortWasCorrect, setShortWasCorrect] = useState(false);

  const [analysisIndex, setAnalysisIndex] = useState(0);
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
  const questionCardAnim = useRef(new Animated.Value(1)).current;
  const qcmFeedbackAnim = useRef(new Animated.Value(0)).current;

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

  async function refreshAttemptStats() {
    const attempts = await getAttempts();
    setTotalAttempts(attempts.length);
    setCorrectAttempts(attempts.filter((attempt) => attempt.is_correct === 1).length);
  }

  useEffect(() => {
    async function bootstrap() {
      await initDatabase();
      await updateStreak();
      const user = await getUserProfile();
      setProfile(user);

      const [maths, fr, hg, physique, svt] = await Promise.all([
        getProgressByMatiere("Mathématiques"),
        getProgressByMatiere("Français"),
        getProgressByMatiere("Histoire-Géo"),
        getProgressByMatiere("Physique-Chimie"),
        getProgressByMatiere("SVT"),
      ]);

      setProgressMap({
        maths: averageMastery(maths),
        fr: averageMastery(fr),
        hg: averageMastery(hg),
        physique: averageMastery(physique),
        svt: averageMastery(svt),
      });

      await refreshAttemptStats();
    }

    void bootstrap();
  }, []);

  const encouragement = useMemo(() => {
    const dayOfMonth = new Date().getDate();
    return ENCOURAGEMENTS[dayOfMonth % ENCOURAGEMENTS.length];
  }, []);

  const xPProgress = Math.min(
    100,
    Math.round(((profile?.xp_total ?? 0) / DAILY_XP_GOAL) * 100)
  );

  const selectedSubject = SUBJECTS.find((subject) => subject.id === selectedSubjectId);
  const selectedChapters = CHAPTERS_BY_SUBJECT[selectedSubjectId];

  async function handleDemoXP() {
    const updated = await updateXP(10);
    setProfile(updated);
  }

  function openSubjectDetail(subjectId: SubjectId) {
    setSelectedSubjectId(subjectId);
    setView("matiere-detail");
  }

  function startQcm() {
    setQuestionIndex(0);
    setSelectedChoice(null);
    setSessionCorrectCount(0);
    setSessionXpEarned(0);
    setView("qcm");
  }

  async function handleChooseAnswer(choice: string) {
    if (selectedChoice) {
      return;
    }
    const question = QCM_QUESTIONS[questionIndex];
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

    if (isCorrect) {
      setSessionCorrectCount((value) => value + 1);
      setSessionXpEarned((value) => value + points);
      const updated = await updateXP(points);
      setProfile(updated);
    }
  }

  function nextQuestion() {
    if (questionIndex < QCM_QUESTIONS.length - 1) {
      setQuestionIndex((value) => value + 1);
      setSelectedChoice(null);
      return;
    }
    setQuestionIndex(QCM_QUESTIONS.length);
  }

  function leaveQcm() {
    if (sessionCorrectCount === QCM_QUESTIONS.length) {
      setPerfectSessions((value) => value + 1);
    }
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

    if (isCorrect) {
      const updated = await updateXP(points);
      setProfile(updated);
    }

    setCalcIsCorrect(isCorrect);
    setCalcCompleted(true);
  }

  function startShortAnswer() {
    setShortIndex(0);
    setShortAnswerText("");
    setShortFeedback(null);
    setShortSubmitted(false);
    setShortWasCorrect(false);
    setView("short-answer");
  }

  async function submitShortAnswer() {
    if (shortSubmitted) {
      return;
    }
    const exercise = SHORT_ANSWER_EXERCISES[shortIndex];
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

    if (isCorrect) {
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
    if (shortIndex < SHORT_ANSWER_EXERCISES.length - 1) {
      setShortIndex((value) => value + 1);
      setShortAnswerText("");
      setShortFeedback(null);
      setShortSubmitted(false);
      setShortWasCorrect(false);
      return;
    }
    setView("tabs");
  }

  function startAnalysisDoc() {
    setAnalysisIndex(0);
    setAnalysisAnswerText("");
    setAnalysisFeedback(null);
    setAnalysisSubmitted(false);
    setAnalysisWasCorrect(false);
    setView("analysis-doc");
  }

  async function submitAnalysisAnswer() {
    if (analysisSubmitted) {
      return;
    }
    const exercise = ANALYSIS_EXERCISES[analysisIndex];
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

    if (isCorrect) {
      const updated = await updateXP(gainedPoints);
      setProfile(updated);
    }
    setAnalysisWasCorrect(isCorrect);
    setAnalysisFeedback(rubricFeedback);
    setAnalysisSubmitted(true);
  }

  function nextAnalysisExercise() {
    if (analysisIndex < ANALYSIS_EXERCISES.length - 1) {
      setAnalysisIndex((value) => value + 1);
      setAnalysisAnswerText("");
      setAnalysisFeedback(null);
      setAnalysisSubmitted(false);
      setAnalysisWasCorrect(false);
      return;
    }
    setView("tabs");
  }

  function startAnnalesMode() {
    setAnnalesSessionItems(ANNALES_ITEMS);
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
  }

  function startAnnalesExpertMode() {
    const expertItems = ANNALES_ITEMS.filter((item) => item.difficulty >= 2);
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

    if (isCorrect) {
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
    setAnnalesIndex(annalesSessionItems.length);
  }

  function renderQcmScreen() {
    if (questionIndex >= QCM_QUESTIONS.length) {
      return (
        <View style={styles.centered}>
          <Text style={styles.h1}>Résultat QCM ✅</Text>
          <Text style={styles.subtitle}>
            Score: {sessionCorrectCount}/{QCM_QUESTIONS.length}
          </Text>
          <Text style={styles.subtitle}>XP gagné: +{sessionXpEarned}</Text>
          <Pressable style={styles.primaryButton} onPress={leaveQcm}>
            <Text style={styles.primaryButtonText}>Retour aux matières</Text>
          </Pressable>
        </View>
      );
    }

    const question = QCM_QUESTIONS[questionIndex];
    const isAnswered = selectedChoice !== null;

    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.screenContent}>
          <Text style={styles.h1}>QCM Pythagore</Text>
          <Text style={styles.subtitle}>
            Question {questionIndex + 1}/{QCM_QUESTIONS.length}
          </Text>
          <Text style={styles.subtitle}>
            Difficulté: {DIFFICULTY_LABELS[question.difficulty]} • {pointsForDifficulty(question.difficulty)} pts
          </Text>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: `${((questionIndex + 1) / QCM_QUESTIONS.length) * 100}%` },
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
          <Pressable style={styles.primaryButton} onPress={startQcm}>
            <Text style={styles.primaryButtonText}>Faire un QCM de Maths</Text>
          </Pressable>
        )}

        <Pressable style={styles.secondaryButton} onPress={startShortAnswer}>
          <Text style={styles.secondaryButtonText}>Réponse courte</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={startAnalysisDoc}>
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
            />
            <TextInput
              style={styles.input}
              value={timeValue}
              onChangeText={setTimeValue}
              keyboardType="numeric"
              placeholder="Temps (h)"
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
            <Pressable style={styles.feedbackButton} onPress={() => setView("tabs")}>
              <Text style={styles.feedbackButtonText}>Retour à l'accueil</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderShortAnswerScreen() {
    const exercise = SHORT_ANSWER_EXERCISES[shortIndex];
    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Text style={styles.h1}>Réponse courte ✍️</Text>
        <Text style={styles.subtitle}>
          Exercice {shortIndex + 1}/{SHORT_ANSWER_EXERCISES.length}
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
            <Pressable style={styles.feedbackButton} onPress={() => setView("tabs")}>
              <Text style={styles.feedbackButtonText}>Retour</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  }

  function renderAnalysisDocScreen() {
    const exercise = ANALYSIS_EXERCISES[analysisIndex];
    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
        <Text style={styles.h1}>Analyse de document 🧠</Text>
        <Text style={styles.subtitle}>
          Exercice {analysisIndex + 1}/{ANALYSIS_EXERCISES.length}
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
            <Pressable style={styles.feedbackButton} onPress={() => setView("tabs")}>
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
          <Pressable style={styles.primaryButton} onPress={() => setView("tabs")}>
            <Text style={styles.primaryButtonText}>Terminer</Text>
          </Pressable>
        </View>
      );
    }

    const item = annalesSessionItems[annalesIndex];

    return (
      <ScrollView contentContainerStyle={styles.screenContent}>
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
              />
              <TextInput
                style={styles.input}
                value={annalesResultInput}
                onChangeText={setAnnalesResultInput}
                editable={!annalesSubmitted}
                keyboardType="numeric"
                placeholder={`Resultat (${item.unit})`}
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
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.h1}>Bonjour {profile.prenom} ! 👋</Text>
              <Text style={styles.subtitle}>Prêt pour une mini-session ?</Text>
            </View>
            <View style={styles.streakPill}>
              <Text style={styles.streakText}>🔥 {profile.streak_count}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Objectif quotidien</Text>
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
              <View style={[styles.progressFill, { width: `${xPProgress}%` }]} />
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
            <Pressable style={styles.primaryButton} onPress={handleDemoXP}>
              <Text style={styles.primaryButtonText}>+10 XP (démo)</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={startQcm}>
              <Text style={styles.secondaryButtonText}>Lancer QCM Maths</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Jours avant le brevet</Text>
            <Text style={styles.bigNumber}>{daysUntilBrevet(new Date(2026, 5, 27))}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Continuer</Text>
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

          <View style={styles.breviCard}>
            <Text style={styles.breviText}>🦉 {encouragement}</Text>
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
          <Text style={styles.h1}>Défis 🏆</Text>
          <Text style={styles.subtitle}>Modes annales et entraînements avancés :</Text>
          <Pressable style={styles.primaryButton} onPress={startQcm}>
            <Text style={styles.primaryButtonText}>QCM du jour</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={startCalcul}>
            <Text style={styles.secondaryButtonText}>Calcul guidé</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={startShortAnswer}>
            <Text style={styles.secondaryButtonText}>Réponse courte</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={startAnalysisDoc}>
            <Text style={styles.secondaryButtonText}>Analyse de document</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={startAnnalesMode}>
            <Text style={styles.primaryButtonText}>Mini mode Annales (mixte)</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={startAnnalesExpertMode}>
            <Text style={styles.primaryButtonText}>Mode Expert Annales (difficile)</Text>
          </Pressable>
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
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Text style={styles.h1}>Profil ⚙️</Text>
        <Text style={styles.subtitle}>Avatar: {profile.avatar}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.contentInner}>
          {view === "tabs" && renderScreen()}
          {view === "qcm" && renderQcmScreen()}
          {view === "matiere-detail" && renderMatiereDetail()}
          {view === "calcul" && renderCalculScreen()}
          {view === "short-answer" && renderShortAnswerScreen()}
          {view === "analysis-doc" && renderAnalysisDocScreen()}
          {view === "annales" && renderAnnalesScreen()}
        </View>
      </View>
      {view === "tabs" && (
        <View style={styles.tabBar}>
          {TAB_ITEMS.map((item) => {
            const active = item.key === activeTab;
            return (
              <Pressable
                key={item.key}
                style={styles.tabItem}
                onPress={() => setActiveTab(item.key)}
              >
                <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{item.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EEF3FF" },
  content: { flex: 1 },
  contentInner: {
    flex: 1,
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
  },
  screenContent: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 30, gap: 14 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: { fontSize: 16, color: "#667085" },
  h1: { fontSize: 28, fontWeight: "800", color: "#102A71" },
  subtitle: { fontSize: 15, color: "#42526B", lineHeight: 20 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  streakPill: {
    backgroundColor: "#FFF4D8",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#FFE4A8",
  },
  streakText: { fontWeight: "800", color: "#B25D00" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4EAF8",
    shadowColor: "#1A2A4D",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#13337A" },
  valueText: { fontSize: 14, color: "#2D3A4A", fontWeight: "700" },
  progressBg: {
    width: "100%",
    height: 11,
    borderRadius: 999,
    backgroundColor: "#DFE8FA",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#4FBF1B",
  },
  primaryButton: {
    backgroundColor: "#103A9B",
    borderRadius: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#103A9B",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#1E4CB2",
    borderRadius: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F7FAFF",
  },
  secondaryButtonText: { color: "#1A48AA", fontWeight: "800" },
  bigNumber: { fontSize: 44, fontWeight: "800", color: "#123684" },
  subjectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3FF",
  },
  subjectLabel: { fontSize: 14, color: "#1F2B3D", fontWeight: "700" },
  subjectPercent: { fontSize: 14, fontWeight: "800", color: "#123684" },
  breviCard: {
    backgroundColor: "#E7F0FF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D8E7FF",
  },
  breviText: { fontSize: 16, color: "#103A9B", fontWeight: "800" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  subjectCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5ECFA",
    shadowColor: "#16274B",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  subjectEmoji: { fontSize: 24 },
  subjectName: { fontSize: 14, fontWeight: "800", color: "#1D2A3E" },
  pressedScale: {
    transform: [{ scale: 0.98 }],
  },
  chapterRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F7",
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#DDE6F8",
    backgroundColor: "#F8FBFF",
    paddingVertical: 9,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabIcon: { fontSize: 18, color: "#9CA9C4" },
  tabIconActive: { color: "#103A9B" },
  tabLabel: { fontSize: 11, color: "#9CA9C4", fontWeight: "700" },
  tabLabelActive: { color: "#103A9B" },
  choiceButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D5DEEE",
    backgroundColor: "#fff",
    padding: 12,
    marginTop: 8,
  },
  choiceDefault: { backgroundColor: "#fff" },
  choiceCorrect: {
    backgroundColor: "#E9F9DF",
    borderColor: "#58CC02",
  },
  choiceWrong: {
    backgroundColor: "#FFE5E5",
    borderColor: "#FF4B4B",
  },
  choiceText: { color: "#1A1A1A", fontWeight: "600" },
  feedbackBar: {
    borderTopWidth: 1,
    borderTopColor: "#DCE6FA",
    backgroundColor: "#F8FBFF",
    padding: 14,
    gap: 8,
  },
  feedbackText: { fontSize: 16, fontWeight: "800", color: "#123684" },
  feedbackHint: { fontSize: 14, color: "#34455C", lineHeight: 20 },
  feedbackButton: {
    marginTop: 4,
    backgroundColor: "#103A9B",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  feedbackButtonText: { color: "#fff", fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#D7E2F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
});
