# PRD - BrevEt (MVP)

## 1) Product Overview

`BrevEt` is a French-language revision app for a single 3eme student preparing the DNB.
The app focuses on short, gamified study sessions inspired by Duolingo, with progress visibility and daily momentum.

- **Target platforms:** iOS first (Expo Go + iPhone), then macOS/web.
- **Target user:** one student profile, no multi-account support.
- **UI language:** French only.

## 2) Scope and Constraints

- **No external API calls in MVP.**
- Any AI-driven or remote feature is represented by **local stubs**.
- **No backend, no auth, no cloud dependency.**
- Local data only.
- Repository is **public-safe** (no secrets committed).

## 3) MVP Goals

1. Student can start app and see a personalized home dashboard.
2. Student can navigate major sections (Accueil, Matieres, Defis, Progres, Profil).
3. Student can earn XP and maintain streak locally.
4. Parent can inspect progress from local app screens.

## 4) Core Features (MVP)

### 4.1 Navigation

Bottom tab navigation with five areas:

- Accueil
- Matieres
- Defis
- Progres
- Profil

### 4.2 Home Dashboard

- Greeting + profile name.
- Current streak.
- Daily XP target progress.
- Countdown to brevet date.
- Quick "continue learning" section for top subjects.
- Encouragement message from mascot "Brevi".

### 4.3 Subjects Overview

- Main subjects displayed as cards with progress bars.
- Initial subset:
  - Mathematiques
  - Francais
  - Histoire-Geo

### 4.4 Gamification Basics

- XP accumulation (local).
- Streak update on daily activity (local).
- Progress percentages per subject.

## 5) Data Model (Local)

### user_profile

- id
- prenom
- avatar
- xp_total
- streak_count
- last_activity_date
- level

### exercises

- id
- matiere
- chapitre
- type (`QCM|CALCUL|REDACTION|DICTE|ANALYSE`)
- enonce
- choices (JSON string)
- correct_answer
- explication
- difficulte (1-3)

### attempts

- id
- exercise_id
- reponse_donnee
- is_correct (0/1)
- score
- created_at

### chapter_progress

- id
- matiere
- chapitre
- mastery_score
- exercises_done
- last_reviewed

## 6) Technical Architecture

- React Native with Expo + TypeScript.
- Local persistence layer designed for SQLite.
- Runtime fallback to in-memory store when SQLite module is unavailable in the execution environment.
- No network required for MVP flow.

## 7) Non-Goals (MVP)

- No Claude/Anthropic integration.
- No multiplayer, ranking services, or external identity.
- No cloud sync.
- No production publishing pipeline.

## 8) Milestones

### Milestone A

- Working tabs and base UI.
- Local DB bootstrap with default profile.

### Milestone B

- Subject progression cards.
- XP and streak demo flow.

### Milestone C

- QCM exercise flow with result storage.
- Basic progress screen metrics.

## 9) Acceptance Criteria (Current Iteration)

- App starts without backend credentials.
- Tabs are usable.
- Default profile appears automatically.
- Updating XP updates home metrics.
- Local progress per subject is retrievable from data layer.
