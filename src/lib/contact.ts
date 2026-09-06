/**
 * Ämnen i kontaktformuläret. Nycklarna översätts via contact.subjects.<key>,
 * och den svenska texten följer med i mailet så att det går att sortera på
 * ämne även när användaren skrivit på engelska.
 */
export const CONTACT_SUBJECTS = ["konto", "pro", "bugg", "annons", "forslag", "ovrigt"] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const isContactSubject = (v: unknown): v is ContactSubject =>
  typeof v === "string" && (CONTACT_SUBJECTS as readonly string[]).includes(v);

/** Etikett på svenska för mailets ämnesrad, oberoende av användarens språk. */
export const SUBJECT_LABEL_SV: Record<ContactSubject, string> = {
  konto: "Fråga om kontot",
  pro: "Pro och betalning",
  bugg: "Något fungerar inte",
  annons: "Fel i en annons",
  forslag: "Förslag på förbättring",
  ovrigt: "Övrigt",
};

export const MESSAGE_MAX = 4000;
