/// <reference types="@workadventure/iframe-api-typings" />

/* =========================================================
   Espace de coworking (script de la map)
   ---------------------------------------------------------
   Quand on entre dans la zone "Coworking 1" du map editor, le panneau du site
   (/cowork) s'ouvre à droite : explication, tables, thèmes, personnes présentes.
   Il s'ouvre tout seul une fois par visite, puis par le bouton "Cowork" de la barre
   d'actions, présent tant qu'on est dans la zone.
   Les chats de table et la bulle de chaque table sont réglés dans le map editor
   (zones "Cowork-Table N") : ce script n'y touche pas.
   ========================================================= */

/** Nom exact de la zone du map editor. */
const COWORK_AREA = "Coworking 1";
const PANEL_URL = "https://campus-entry-cube.lovable.app/cowork";
const BUTTON_ID = "cowork-btn";
/** Réouverture automatique au plus une fois toutes les 10 minutes. */
const AUTO_OPEN_EVERY_MS = 10 * 60_000;

type UIWebsite = Awaited<ReturnType<typeof WA.ui.website.open>>;

let panel: UIWebsite | null = null;
let lastAutoOpen = 0;

async function closePanel(): Promise<void> {
  const current = panel;
  panel = null;
  await current?.close().catch(() => undefined);
}

async function openPanel(): Promise<void> {
  await closePanel();
  panel = await WA.ui.website.open({
    url: PANEL_URL,
    allowApi: true,
    visible: true,
    position: { vertical: "middle", horizontal: "right" },
    size: { width: "390px", height: "78vh" },
    margin: { right: "12px" },
  });
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
      if (Date.now() - lastAutoOpen > AUTO_OPEN_EVERY_MS) {
        lastAutoOpen = Date.now();
        openPanel().catch((e) => console.warn("[cowork] panneau", e));
      }
    });
    WA.mapEditor.area.onLeave(COWORK_AREA).subscribe(() => {
      try {
        WA.ui.actionBar.removeButton(BUTTON_ID);
      } catch {
        /* bouton déjà retiré */
      }
      closePanel().catch(() => undefined);
    });
  } catch (e) {
    console.warn("[cowork] zone indisponible", e);
  }
}
