/// <reference types="@workadventure/iframe-api-typings" />

/* =========================================================
   Bouton "Cowork" de la barre d'actions
   ---------------------------------------------------------
   Visible uniquement dans la zone "Coworking 1" du map editor : ajouté à l'entrée, retiré à
   la sortie. Un clic ouvre le panneau du site (/cowork) sur le côté, s'il n'est pas déjà ouvert.
   Un clic ne passe pas par la touche Espace : aucun conflit avec le déverrouillage des zones.
   ========================================================= */

/** Nom exact de la zone du map editor. */
const COWORK_AREA = "Coworking 1";
const PANEL_URL = "https://campus-entry-cube.lovable.app/cowork";
const BUTTON_ID = "cowork-btn";
/** Largeur du panneau, en pourcentage de l'écran. */
const PANEL_WIDTH_PERCENT = 30;

let opening = false;

async function openPanel(): Promise<void> {
  if (opening) return;
  opening = true;
  try {
    // Déjà ouvert (par la zone ou par un clic précédent) : on n'en ouvre pas un second.
    const open = await WA.nav.getCoWebSites();
    if (open.length > 0) return;
    await WA.nav.openCoWebSite(PANEL_URL, true, "", PANEL_WIDTH_PERCENT, undefined, true);
  } finally {
    opening = false;
  }
}

/** À appeler une fois, après WA.onInit(). */
export function initCowork(): void {
  try {
    WA.mapEditor.area.onEnter(COWORK_AREA).subscribe(() => {
      WA.ui.actionBar.addButton({
        id: BUTTON_ID,
        label: "Cowork",
        bgColor: "#6D1FFF",
        textColor: "#FFFFFF",
        toolTip: "Ouvrir l'espace de coworking",
        callback: () => {
          openPanel().catch((e) => console.warn("[cowork] panneau", e));
        },
      });
    });
    WA.mapEditor.area.onLeave(COWORK_AREA).subscribe(() => {
      try {
        WA.ui.actionBar.removeButton(BUTTON_ID);
      } catch {
        /* bouton déjà retiré */
      }
    });
  } catch (e) {
    console.warn("[cowork] zone indisponible", e);
  }
}
