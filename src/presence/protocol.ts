/* =========================================================
   Présence et actions admin : protocole partagé
   ---------------------------------------------------------
   Copié TEL QUEL dans l'app Lovable (src/lib/presence-protocol.ts).
   Ne dépend pas de l'API WorkAdventure.
   ========================================================= */

export const PRESENCE_VERSION = 1;

/**
 * Espace WorkAdventure (API Spaces) que chaque joueur rejoint dès son arrivée.
 * C'est le serveur qui tient la liste de tous les connectés du monde, sans interrogation.
 * "streaming" : personne n'est audible tant que personne ne lance de diffusion,
 * donc rejoindre cet espace ne mélange jamais les conversations.
 */
export const PRESENCE_SPACE = "cube-presence";
export const PRESENCE_SPACE_FILTER = "streaming" as const;

export const PRESENCE_EVENTS = {
  /** "Où es-tu ?" : envoyé par la page admin à UNE personne (champ `to`). */
  hello: "presence:hello",
  /** Réponse de la personne interrogée : sa position et sa zone. */
  here: "presence:here",
  /** Un admin demande à quelqu'un de le rejoindre. */
  summon: "admin:summon",
  /** Un admin envoie un message à quelqu'un. */
  message: "admin:message",
  /** Accusé de réception : la personne a pris en compte le message ou la demande. */
  ack: "admin:ack",
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

export interface PresenceHello {
  v: number;
  /** uuid de la personne interrogée. Absent = ancien format, tout le monde répond. */
  to?: string;
}

/** Faut-il répondre à cette demande de position ? */
export function isHelloForMe(data: unknown, myUuid: string): boolean {
  if (!data || typeof data !== "object") return true;
  const to = (data as { to?: unknown }).to;
  return typeof to !== "string" || (!!myUuid && to === myUuid);
}

export interface AdminSummon {
  v: number;
  /** Identifiant de la demande, repris dans l'accusé de réception. */
  id?: string;
  to: string;
  /** uuid de l'admin, pour que l'accusé lui revienne. */
  fromUuid?: string;
  fromName: string;
  x: number;
  y: number;
  zone: string | null;
}

export interface AdminMessage {
  v: number;
  id?: string;
  to: string;
  fromUuid?: string;
  fromName: string;
  text: string;
}

export type AckKind = "message" | "summon";
/** read : message lu. accepted : la personne vient. declined : pas maintenant. */
export type AckAction = "read" | "accepted" | "declined";

/** Réponse envoyée à l'admin quand la personne clique sur la notification. */
export interface AdminAck {
  v: number;
  /** uuid de l'admin à prévenir. */
  to: string;
  id: string;
  kind: AckKind;
  action: AckAction;
  /** Nom de la personne qui a répondu. */
  fromName: string;
  fromUuid: string;
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

export function isAdminAck(v: unknown): v is AdminAck {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.to === "string" &&
    typeof a.id === "string" &&
    typeof a.fromName === "string" &&
    (a.kind === "message" || a.kind === "summon") &&
    (a.action === "read" || a.action === "accepted" || a.action === "declined")
  );
}

/** Phrase affichée à l'admin quand la personne a répondu. */
export function ackText(a: Pick<AdminAck, "kind" | "action" | "fromName">): string {
  if (a.action === "declined") return `${a.fromName} ne peut pas te rejoindre pour l'instant.`;
  if (a.action === "accepted") return `${a.fromName} te rejoint.`;
  return `${a.fromName} a lu ton message.`;
}

export function roleFromTags(tags: readonly string[], isLogged: boolean): PresenceRole {
  if (tags.includes("admin")) return "admin";
  if (tags.includes("staff")) return "staff";
  if (tags.includes("premium")) return "premium";
  return isLogged ? "membre" : "visiteur";
}
