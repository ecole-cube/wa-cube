/// <reference types="@workadventure/iframe-api-typings" />

/* =========================================================
   Présence (script de la map)
   ---------------------------------------------------------
   - rejoint l'espace de présence : le serveur WorkAdventure en tient la liste
     (nom, tags, carte), la page admin la reçoit en direct, sans interroger personne ;
   - répond avec sa position quand un admin la demande à CETTE personne ;
   - reçoit les demandes d'un admin : "rejoins-moi", ou un message.
   Rien n'est forcé : la personne voit une invitation et choisit.

   Modération : un admin peut déconnecter une session précise (inactive, restée
   à l'entrée, ou ancien onglet d'une double connexion). La commande passe par la
   variable de salle "adminCommand", inscriptible par les admins seulement
   (contrôlé par le serveur). La personne arrive sur la page /deconnecte et peut
   revenir quand elle veut.

   Les notifications s'affichent en haut à droite, dans une petite page
   Lovable (/notification) ouverte comme "site d'interface" : elle reste au
   premier plan, y compris devant un partage d'écran. Quand la personne clique,
   la page renvoie un accusé de réception à l'admin (admin:ack), qui voit
   alors "X a lu ton message" de la même façon.
   ========================================================= */

import { currentTagColors } from "../tagColors";
import { colorForTags } from "../tagColors/config";
import { canEnterAt, zoneAt } from "../zones";
import {
  ADMIN_COMMAND_MAX_AGE_MS,
  ADMIN_COMMAND_VARIABLE,
  AckAction,
  AckKind,
  AdminAck,
  PRESENCE_EVENTS,
  PRESENCE_SPACE,
  PRESENCE_SPACE_FILTER,
  PRESENCE_VERSION,
  PresenceInfo,
  ackText,
  isAdminAck,
  isAdminMessage,
  isAdminSummon,
  isHelloForMe,
  parseAdminCommand,
  roleFromTags,
} from "./protocol";

const connectedAt = Date.now();
/** Propre à cet onglet : sert à viser le bon onglet en cas de double connexion. */
const sessionId = `${connectedAt.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
/** Dernier déplacement du joueur dans cet onglet. */
let lastMoveAt = connectedAt;

/** Page affichée à la personne déconnectée par un admin. */
const LEFT_URL = "https://campus-entry-cube.lovable.app/deconnecte";
/** Réponses à une demande générale étalées dans le temps, pour ne pas saturer la page admin. */
const HELLO_JITTER_MS = 1500;

/** Page de notification hébergée sur Lovable (même domaine que Plan & FAQ). */
const NOTIFICATION_URL = "https://campus-entry-cube.lovable.app/notification";
const NOTIFICATION_WIDTH = "380px";
const NOTIFICATION_AUTO_CLOSE_MS = 60_000;
const ACK_AUTO_CLOSE_MS = 8_000;

type UIWebsite = Awaited<ReturnType<typeof WA.ui.website.open>>;
let currentNotification: UIWebsite | null = null;

interface NotificationData {
  kind: AckKind | "ack";
  id: string;
  fromName: string;
  fromUuid?: string;
  text?: string;
  zone?: string | null;
  x?: number;
  y?: number;
}

/**
 * Ouvre la notification en haut à droite. Les données passent dans le fragment (#),
 * qui n'est jamais envoyé au serveur : le texte d'un message ne finit pas dans des logs.
 * Une seule notification à la fois : la nouvelle remplace l'ancienne.
 */
async function showNotification(n: NotificationData, autoCloseMs: number): Promise<void> {
  const params = new URLSearchParams({
    kind: n.kind,
    id: n.id,
    from: n.fromName,
    fromUuid: n.fromUuid ?? "",
    text: (n.text ?? "").slice(0, 280),
    zone: n.zone ?? "",
    x: String(Math.round(n.x ?? 0)),
    y: String(Math.round(n.y ?? 0)),
  });
  await currentNotification?.close().catch(() => undefined);
  currentNotification = null;
  const site = await WA.ui.website.open({
    url: `${NOTIFICATION_URL}#${params.toString()}`,
    allowApi: true,
    visible: true,
    position: { vertical: "top", horizontal: "right" },
    size: { width: NOTIFICATION_WIDTH, height: n.kind === "ack" ? "96px" : "220px" },
    margin: { top: "16px", right: "16px" },
  });
  currentNotification = site;
  setTimeout(() => {
    site.close().catch(() => undefined);
    if (currentNotification === site) currentNotification = null;
  }, autoCloseMs);
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Accusé de réception envoyé à l'admin (utilisé par les solutions de repli ci-dessous). */
function sendAck(to: string | undefined, id: string, kind: AckKind, action: AckAction): void {
  if (!to) return;
  const ack: AdminAck = {
    v: PRESENCE_VERSION,
    to,
    id,
    kind,
    action,
    fromName: WA.player.name,
    fromUuid: WA.player.uuid ?? "",
  };
  WA.event.broadcast(PRESENCE_EVENTS.ack, ack).catch((e) => console.warn("[presence] accusé non envoyé", e));
}
async function myInfo(): Promise<PresenceInfo> {
  const pos = await WA.player.getPosition();
  const tags = WA.player.tags ?? [];
  const isLogged = WA.player.isLogged === true;
  const f = colorForTags(currentTagColors(), tags);
  return {
    v: PRESENCE_VERSION,
    uuid: WA.player.uuid ?? "",
    name: WA.player.name,
    isLogged,
    role: roleFromTags(tags, isLogged),
    formation: f ? { tag: f.tag, label: f.label, color: f.color } : null,
    zone: zoneAt(pos.x, pos.y),
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    connectedAt,
    sessionId,
    idleMs: Math.max(0, Date.now() - lastMoveAt),
  };
}

function isForMe(to: string): boolean {
  return !!to && to === (WA.player.uuid ?? "");
}

/** À appeler une fois, après WA.onInit(). */
export function initPresence(): void {
  // Apparaître dans la liste native des connectés (aucun trafic ensuite).
  WA.spaces
    .joinSpace(PRESENCE_SPACE, PRESENCE_SPACE_FILTER, [])
    .catch((e) => console.warn("[presence] espace indisponible", e));

  WA.event.on(PRESENCE_EVENTS.hello).subscribe((ev) => {
    // Seule la personne interrogée répond : un seul message au lieu d'une rafale.
    if (!isHelloForMe(ev.data, WA.player.uuid ?? "")) return;
    const targeted = !!(ev.data && typeof ev.data === "object" && (ev.data as { to?: unknown }).to);
    // Demande à une personne : réponse immédiate. Demande générale (analyse admin) : on s'étale.
    setTimeout(
      () => {
        myInfo()
          .then((info) => WA.event.broadcast(PRESENCE_EVENTS.here, info))
          .catch((e) => console.warn("[presence]", e));
      },
      targeted ? 0 : Math.random() * HELLO_JITTER_MS,
    );
  });

  // Activité : un déplacement suffit à remettre le compteur d'inactivité à zéro.
  try {
    WA.player.onPlayerMove(() => {
      lastMoveAt = Date.now();
    });
  } catch (e) {
    console.warn("[presence] suivi d'activité indisponible", e);
  }

  // Commande de modération envoyée par un admin.
  const done = new Set<string>();
  try {
    WA.state.onVariableChange(ADMIN_COMMAND_VARIABLE).subscribe((value) => {
      const cmd = parseAdminCommand(value);
      if (!cmd || done.has(cmd.id)) return;
      done.add(cmd.id);
      if (Math.abs(Date.now() - cmd.at) > ADMIN_COMMAND_MAX_AGE_MS) return;
      const me = WA.player.uuid ?? "";
      if (!cmd.targets.some((t) => t.uuid === me && t.sessionId === sessionId)) return;
      const back = WA.room.id.startsWith("/@/") ? `https://play.workadventu.re${WA.room.id}` : "";
      const url = `${LEFT_URL}?r=${encodeURIComponent(cmd.reason)}${back ? `&back=${encodeURIComponent(back)}` : ""}`;
      WA.nav.goToPage(url);
    });
  } catch (e) {
    console.warn("[presence] canal de modération indisponible", e);
  }

  WA.event.on(PRESENCE_EVENTS.summon).subscribe((ev) => {
    if (!isAdminSummon(ev.data) || !isForMe(ev.data.to)) return;
    const s = ev.data;
    const id = s.id ?? newId();
    showNotification(
      { kind: "summon", id, fromName: s.fromName, fromUuid: s.fromUuid, zone: s.zone, x: s.x, y: s.y },
      NOTIFICATION_AUTO_CLOSE_MS,
    ).catch((e) => {
      // Repli : l'ancien message en bas de l'écran (espace pour accepter).
      console.warn("[presence] notification indisponible", e);
      const where = s.zone ? ` (${s.zone})` : "";
      const msg = WA.ui.displayActionMessage({
        message: `${s.fromName} te demande de le rejoindre${where}. Appuie sur espace pour y aller.`,
        type: "message",
        callback: () => {
          // Jamais plus loin que ce que les droits de la personne permettent à pied.
          if (!canEnterAt(WA.player.tags ?? [], s.x, s.y + 32)) {
            sendAck(s.fromUuid, id, "summon", "denied");
            return;
          }
          sendAck(s.fromUuid, id, "summon", "accepted");
          WA.player.teleport(s.x, s.y + 32).catch((err) => console.warn(err));
        },
      });
      setTimeout(() => msg.remove().catch(() => undefined), NOTIFICATION_AUTO_CLOSE_MS);
    });
  });

  WA.event.on(PRESENCE_EVENTS.message).subscribe((ev) => {
    if (!isAdminMessage(ev.data) || !isForMe(ev.data.to)) return;
    const m = ev.data;
    showNotification(
      { kind: "message", id: m.id ?? newId(), fromName: m.fromName, fromUuid: m.fromUuid, text: m.text },
      NOTIFICATION_AUTO_CLOSE_MS,
    ).catch((e) => {
      // Repli : bandeau en haut (pas d'accusé possible, il n'a pas de clic).
      console.warn("[presence] notification indisponible", e);
      WA.ui.banner.openBanner({
        id: `admin-message-${Date.now()}`,
        text: `${m.fromName} : ${m.text.slice(0, 280)}`,
        bgColor: "#6D1FFF",
        textColor: "#FFFFFF",
        closable: true,
        timeToClose: NOTIFICATION_AUTO_CLOSE_MS,
      });
    });
  });

  // Côté admin : la personne a cliqué, on affiche l'accusé au même endroit.
  WA.event.on(PRESENCE_EVENTS.ack).subscribe((ev) => {
    if (!isAdminAck(ev.data) || !isForMe(ev.data.to)) return;
    const a = ev.data;
    showNotification(
      { kind: "ack", id: a.id, fromName: a.fromName, fromUuid: a.fromUuid, text: ackText(a) },
      ACK_AUTO_CLOSE_MS,
    ).catch((e) => console.warn("[presence] accusé non affiché", e));
  });
}
