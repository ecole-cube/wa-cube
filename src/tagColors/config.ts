/* =========================================================
   Couleurs des formations : format partagé
   ---------------------------------------------------------
   Ce fichier est copié TEL QUEL dans l'app Lovable
   (src/lib/tag-colors-config.ts). Il ne dépend pas de l'API
   WorkAdventure. Toute modification ici doit être reportée là-bas.
   ========================================================= */

/** Nom de la variable de salle déclarée dans campus.tmj (writableBy: admin). */
export const TAG_COLORS_VARIABLE = "tagColors";

export interface TagColor {
  /** Tag WorkAdventure, en minuscules, exactement comme dans l'admin WA. */
  tag: string;
  /** Libellé lisible (affiché dans les pages, pas dans le jeu). */
  label: string;
  /** Couleur au format #RRGGBB. */
  color: string;
}

export interface TagColorsConfig {
  v: 1;
  /** Ordre = priorité : le premier tag que possède le joueur l'emporte. */
  entries: TagColor[];
  updatedAt: number;
  updatedBy: string;
}

/**
 * Couleurs utilisées tant que personne ne les a modifiées depuis la page admin.
 * Reprend exactement l'ancien comportement de main.ts (mêmes tags, même ordre).
 */
export const DEFAULT_TAG_COLORS: TagColor[] = [
  { tag: "staff", label: "Équipe encadrante", color: "#9467BD" },
  { tag: "autom", label: "Autom & agents IA", color: "#1F77B4" },
  { tag: "dev", label: "Développement d'app IA", color: "#FF7F0E" },
  { tag: "projet", label: "Chef de projet IA", color: "#D62728" },
  { tag: "seo", label: "Acquisition organique", color: "#E377C2" },
  { tag: "paid", label: "Acquisition payante", color: "#17BECF" },
  { tag: "iagen", label: "IA générative", color: "#BCBD22" },
  { tag: "pbn", label: "Product Builder", color: "#2CA02C" },
  { tag: "growth", label: "Growth Marketer", color: "#8C564B" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const TAG = /^[^\s]{1,64}$/;

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

export function normalizeTag(v: string): string {
  return v.trim().toLowerCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Rapport de contraste entre la couleur et du texte blanc (1 à 21). */
export function contrastWithWhite(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return Math.round((1.05 / (lum + 0.05)) * 100) / 100;
}

/** Seuil en dessous duquel le nom en blanc devient difficile à lire. */
export const MIN_CONTRAST = 3;

/**
 * Lit la valeur de la variable de salle, quelle que soit sa forme
 * (texte JSON ou objet). Renvoie null si elle est vide ou illisible :
 * on retombe alors sur DEFAULT_TAG_COLORS.
 */
export function parseTagColors(value: unknown): TagColor[] | null {
  let data: unknown = value;
  if (typeof data === "string") {
    if (!data.trim()) return null;
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const entries = (data as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return null;

  const seen = new Set<string>();
  const clean: TagColor[] = [];
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const raw = e as Record<string, unknown>;
    if (typeof raw.tag !== "string" || !isHexColor(raw.color)) continue;
    const tag = normalizeTag(raw.tag);
    if (!TAG.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    clean.push({
      tag,
      label: typeof raw.label === "string" ? raw.label.slice(0, 60) : tag,
      color: raw.color.toUpperCase(),
    });
  }
  return clean.length > 0 ? clean : null;
}

/** Prépare la valeur à enregistrer dans la variable (texte JSON). */
export function serializeTagColors(entries: TagColor[], updatedBy: string): string {
  const config: TagColorsConfig = {
    v: 1,
    entries: entries.map((e) => ({ tag: normalizeTag(e.tag), label: e.label, color: e.color.toUpperCase() })),
    updatedAt: Date.now(),
    updatedBy,
  };
  return JSON.stringify(config);
}

/** Première entrée dont le joueur possède le tag (ordre = priorité). */
export function colorForTags(entries: TagColor[], tags: readonly string[]): TagColor | null {
  const mine = new Set(tags.map(normalizeTag));
  return entries.find((e) => mine.has(e.tag)) ?? null;
}
