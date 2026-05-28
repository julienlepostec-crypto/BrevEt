export type SubjectId = "maths" | "fr" | "hg" | "physique" | "svt";

type Chapter = {
  id: string;
  title: string;
};

export const CHAPTERS_BY_SUBJECT: Record<SubjectId, Chapter[]> = {
  maths: [
    { id: "pythagore", title: "Pythagore" },
    { id: "thales", title: "Théorème de Thalès" },
    { id: "trigonometrie", title: "Trigonométrie" },
  ],
  fr: [
    { id: "grammaire", title: "Grammaire" },
    { id: "conjugaison", title: "Conjugaison" },
    { id: "orthographe", title: "Orthographe" },
  ],
  hg: [
    { id: "guerres", title: "Guerres mondiales" },
    { id: "guerre-froide", title: "Guerre froide" },
    { id: "republique", title: "La République française" },
  ],
  physique: [
    { id: "mouvements", title: "Mouvements et interactions" },
    { id: "energie", title: "Énergie et conversions" },
    { id: "signaux", title: "Signaux et communication" },
  ],
  svt: [
    { id: "genetique", title: "Génétique et ADN" },
    { id: "immunite", title: "Immunité et vaccination" },
    { id: "planete", title: "Planète Terre et risques" },
  ],
};
