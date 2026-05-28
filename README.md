# BrevEt

Application de revision du brevet (3eme), en francais, local-first, sans backend.

## Lancer le projet

```bash
npm install
npm run start
```

## Etat actuel

- Navigation 5 onglets (Accueil, Matieres, Defis, Progres, Profil)
- Couche de donnees locale avec schema SQLite cible
- Fallback memoire active si `expo-sqlite` n'est pas disponible
- Objectif XP, streak, progression matieres (MVP)
- Modes d'exercices non-QCM:
  - `Reponse courte` (correction immediate, match exact/proche)
  - `Analyse de document` (source + reponse ouverte + feedback type rubrique)
  - `Calcul guide` (etapes de resolution)
- Mini mode `Annales` dans Defis (items 2019-2024 melanges: QCM, reponse courte, analyse, calcul, SVT inclus)
- Mode `Expert Annales` (selection plus difficile, sans simplification)
- Progression de difficulte (`easy`/`medium`/`hard`) avec points/XP qui augmentent selon la difficulte
- Systeme de gamification complet en cours: niveaux/titres, multiplicateur streak et badges debloques
- Polish UX en cours: barres XP/niveau animees, transitions de questions, feedback anime, press feedback
- Progres enrichi avec stats de tentatives (`getAttempts`): total, taux de reussite, statut badge
- Modes d'exercice disponibles:
  - QCM maths (Pythagore) avec progression par difficulte
  - Calcul guide (etapes + correction)
  - Reponse courte (saisie libre + correction immediate)
  - Analyse de document (source + reponse ouverte + feedback rubric)
- Defi "Mini Annales" local (2019, 2021, 2023) avec sequence mixte QCM/reponse courte/analyse/calcul
- Onglet Progres enrichi: total tentatives, taux de reussite et badge de statut

## Variables d'environnement

Pas de cle API requise pour ce MVP.
Les fichiers `.env` et `.env.local` sont ignores par git.

## Document produit

Le PRD officiel du MVP est disponible dans `docs/PRD.md`.
