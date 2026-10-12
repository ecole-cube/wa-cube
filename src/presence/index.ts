/// <reference types="@workadventure/iframe-api-typings" />

/* =========================================================
   Présence (script de la map)
   ---------------------------------------------------------
   - répond "je suis là" quand la page admin demande qui est présent ;
   - reçoit les demandes d'un admin : "rejoins-moi", ou un message.
   Rien n'est forcé : la personne voit une invitation et choisit.
   ========================================================= */

import { currentTagColors } from "../tagColors";
import { colorForTags } from "../tagColors/config";
import { zoneAt } from "../zones";
import {
  PRESENCE_EVENTS,
  PRESENCE_VERSION,
  PresenceInfo,
  isAdminMessage,
  isAdminSummon,
  roleFromTags,
} from "./protocol";

const connectedAt = Date.now();

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
  };
}

function isForMe(to: string): boolean {
  return !!to && to === (WA.player.uuid ?? "");
}

/** À appeler une fois, après WA.onInit(). */
export function initPresence(): void {
  WA.event.on(PRESENCE_EVENTS.hello).subscribe(() => {
    // délai aléatoire pour que tout le monde ne réponde pas à la même milliseconde
    setTimeout(() => {
      myInfo()
        .then((info) => WA.event.broadcast(PRESENCE_EVENTS.here, info))
        .catch((e) => console.warn("[presence]", e));
    }, Math.random() * 1200);
  });

  WA.event.on(PRESENCE_EVENTS.summon).subscribe((ev) => {
    if (!isAdminSummon(ev.data) || !isForMe(ev.data.to)) return;
    const s = ev.data;
    const where = s.zone ? ` (${s.zone})` : "";
    const msg = WA.ui.displayActionMessage({
      message: `${s.fromName} te demande de le rejoindre${where}. Appuie pour y aller.`,
      type: "message",
      callback: () => {
        WA.player.teleport(s.x, s.y + 32).catch((e) => console.warn(e));
      },
    });
    setTimeout(() => msg.remove().catch(() => undefined), 30_000);
  });

  WA.event.on(PRESENCE_EVENTS.message).subscribe((ev) => {
    if (!isAdminMessage(ev.data) || !isForMe(ev.data.to)) return;
    const m = ev.data;
    WA.ui.banner.openBanner({
      id: `admin-message-${Date.now()}`,
      text: `${m.fromName} : ${m.text.slice(0, 280)}`,
      bgColor: "#6D1FFF",
      textColor: "#FFFFFF",
      closable: true,
      timeToClose: 30_000,
    });
  });
}
