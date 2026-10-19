/// <reference types="@workadventure/iframe-api-typings" />

import { accessAt, accessRule, canEnterAt, zoneAt } from "./zones";

/* =========================================================
   Arrivée directe par lien d'invitation
   ---------------------------------------------------------
   Un lien d'invitation de Plan & FAQ a la forme  <adresse du campus>#start&goto=x,y
   La personne est placée à (x, y) dès son arrivée, sans marcher depuis l'entrée.
   Jamais plus loin que ses droits ne le permettent à pied : si l'endroit est réservé
   (premium, staff…), elle reste au point d'arrivée habituel.
   ========================================================= */

/** Paramètre du fragment d'adresse : "goto=1200,3400". */
const GOTO_PARAM = "goto";
/** Où l'on reste quand l'endroit est refusé : devant l'arche d'entrée. */
const ENTRANCE = { x: 3200, y: 4160 };

/**
 * Dit à la personne pourquoi elle n'a pas été amenée où le lien le promettait.
 * Elle reste à l'entrée et sait qui contacter.
 */
function explainRefusal(x: number, y: number): void {
  const place = zoneAt(x, y) ?? "cet endroit";
  const text = `Tu ne peux pas aller à ${place} : cet endroit est réservé ${accessRule(accessAt(x, y))}. Tu restes à l'entrée. Contacte la personne qui t'a invité pour en savoir plus.`;
  try {
    WA.ui.banner.openBanner({
      id: "acces-refuse",
      text,
      bgColor: "#b3261e",
      textColor: "#ffffff",
      closable: true,
      timeToClose: 30000,
    });
  } catch (e) {
    console.warn("[arrivée] bandeau indisponible", e);
  }
  try {
    WA.chat.sendChatMessage(text, { scope: "local", author: "Campus" });
  } catch {
    /* le bandeau suffit */
  }
}

export function initArrival(): void {
  try {
    const params = WA.room.hashParameters ?? {};
    if (Object.keys(params).length === 0) return; // arrivée normale : rien à contrôler
    const tags = WA.player.tags ?? [];
    const raw = params[GOTO_PARAM];
    if (raw) {
      const [x, y] = raw.split(",").map((n) => Number(n));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      // Hors de la carte : on ignore.
      if (x < 0 || y < 0 || x > 7040 || y > 4448) return;
      if (!canEnterAt(tags, x, y)) {
        // Lien vers un endroit réservé : la personne reste au point d'arrivée habituel, avec l'explication.
        setTimeout(() => explainRefusal(x, y), 1500);
        return;
      }
      // Petit délai : le point d'arrivée de la carte est appliqué juste avant.
      setTimeout(() => {
        WA.player.teleport(Math.round(x), Math.round(y)).catch((e) => console.warn("[arrivée] téléportation impossible", e));
      }, 400);
      return;
    }
    // Lien vers un point d'entrée nommé (#salle-3, #agora…) : la carte place la personne, sans contrôle
    // de droits. On vérifie donc où elle se trouve, et on la ramène à l'entrée si elle n'a pas le droit d'y être.
    let refused = false;
    const check = async () => {
      if (refused) return;
      try {
        const p = await WA.player.getPosition();
        if (canEnterAt(tags, p.x, p.y)) return;
        refused = true;
        await WA.player.teleport(ENTRANCE.x, ENTRANCE.y);
        explainRefusal(p.x, p.y);
      } catch (e) {
        console.warn("[arrivée] contrôle impossible", e);
      }
    };
    setTimeout(() => void check(), 900);
    setTimeout(() => void check(), 2500);
  } catch (e) {
    console.warn("[arrivée] paramètre illisible", e);
  }
}
