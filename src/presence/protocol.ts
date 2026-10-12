/* =========================================================
   Présence et actions admin : protocole partagé
   ---------------------------------------------------------
   Copié TEL QUEL dans l'app Lovable (src/lib/presence-protocol.ts).
   Ne dépend pas de l'API WorkAdventure.
   ========================================================= */

export const PRESENCE_VERSION = 1;

export const PRESENCE_EVENTS = {
  /** "Qui est là ?" : envoyé par la page admin. */
  hello: "presence:hello",
  /** Réponse de chaque joueur. */
  here: "presence:here",
  /** Un admin demande à quelqu'un de le rejoindre. */
  summon: "admin:summon",
  /** Un admin envoie un message à quelqu'un. */
  message: "admin:message",
} as const;

/**
 * Rôle affiché dans la liste, du plus fort au plus faible.
 * Mêmes règles que main.ts : admin = tag admin (admins WorkAdventure),
 * staff = tag staff, premium = accès à l'intérieur du campus.
 */
export type PresenceRole = "admin" | "staff" | "premium" | "membre" | "visiteur";

export interface PresenceInfo {
  v: number;
  uuid: string;
  name: string;
  isLogged: boolean;
  role: PresenceRole;
  /** Formation déduite des tags, avec la couleur en vigueur. */
  formation: { tag: string; label: string; color: string } | null;
  zone: string | null;
  x: number;
  y: number;
  /** Heure d'arrivée sur le campus (ms epoch). */
  connectedAt: number;
}

export interface AdminSummon {
  v: number;
  to: string;
  fromName: string;
  x: number;
  y: number;
  zone: string | null;
}

export interface AdminMessage {
  v: number;
  to: string;
  fromName: string;
  text: string;
}

export const MAX_MESSAGE_LENGTH = 280;

export function isPresenceInfo(v: unknown): v is PresenceInfo {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.uuid === "string" && typeof p.name === "string" && typeof p.x === "number" && typeof p.y === "number";
}

export function isAdminSummon(v: unknown): v is AdminSummon {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return typeof s.to === "string" && typeof s.fromName === "string" && typeof s.x === "number" && typeof s.y === "number";
}

export function isAdminMessage(v: unknown): v is AdminMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.to === "string" && typeof m.fromName === "string" && typeof m.text === "string";
}

export function roleFromTags(tags: readonly string[], isLogged: boolean): PresenceRole {
  if (tags.includes("admin")) return "admin";
  if (tags.includes("staff")) return "staff";
  if (tags.includes("premium")) return "premium";
  return isLogged ? "membre" : "visiteur";
}
