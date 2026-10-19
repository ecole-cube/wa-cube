/// <reference types="@workadventure/iframe-api-typings" />

import { AAB_ROOM, accessDenied, tagsAllow } from "./zones";

/* =========================================================
   Salle AI Automation Builder : réservée au staff et au tag aab
   ---------------------------------------------------------
   La carte laisse entrer à pied toute personne qui a le tag premium. Cette salle est plus fermée :
   si quelqu'un s'y trouve sans y avoir droit (à pied, ou téléporté par un lien), il est ramené à
   l'agora avec le message « Vous devez être en formation AI Automation Builder pour entrer ».
   Le staff et les admins passent partout (tagsAllow).
   ========================================================= */

const POLL_MS = 500;
/** Où l'on ramène la personne : l'agora, juste au-dessus de la salle. */
const EXIT = { x: 2944, y: 2144 };

export function initAabRoom(): void {
  let ejecting = false;
  const tick = async () => {
    if (ejecting) return;
    try {
      const tags = WA.player.tags ?? [];
      if (tagsAllow("aab", tags)) return; // aab, staff, admin : rien à contrôler
      const p = await WA.player.getPosition();
      const inside = p.x >= AAB_ROOM.x && p.x < AAB_ROOM.x + AAB_ROOM.w && p.y >= AAB_ROOM.y && p.y < AAB_ROOM.y + AAB_ROOM.h;
      if (!inside) return;
      ejecting = true;
      await WA.player.teleport(EXIT.x, EXIT.y);
      const text = accessDenied("aab");
      try {
        WA.ui.banner.openBanner({ id: "salle-aab", text, bgColor: "#b3261e", textColor: "#ffffff", closable: true, timeToClose: 15000 });
      } catch {
        /* le message dans le chat suffit */
      }
      try {
        WA.chat.sendChatMessage(text, { scope: "local", author: "Campus" });
      } catch {
        /* sans effet */
      }
    } catch (e) {
      console.warn("[salle AAB] contrôle impossible", e);
    } finally {
      ejecting = false;
    }
  };
  setInterval(() => void tick(), POLL_MS);
}
