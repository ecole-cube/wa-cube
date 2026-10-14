/// <reference types="@workadventure/iframe-api-typings" />

/* =========================================================
   Espace de coworking (script de la map)
   ---------------------------------------------------------
   Quand on entre dans la zone "Coworking 1" du map editor, le panneau du site
   (/cowork) s'ouvre à droite : explication, tables, thèmes, personnes présentes.
   Il s'ouvre tout seul une fois par visite, puis par le bouton "Cowork" de la barre
   d'actions, présent tant qu'on est dans la zone. Le bouton × du panneau le REPLIE en
   pastille (il n'est jamais fermé tant qu'on est dans la zone) : la page continue de
   signaler la table où l'on est assis.
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

/** Panneau déplié, et pastille repliée : le cadre reste affiché pour que la présence continue. */
const EXPANDED = { width: "390px", height: "78vh" };
const COLLAPSED = { width: "190px", height: "52px" };
/** Délai laissé au panneau pour signaler son départ avant qu'on le ferme. */
const LEAVE_GRACE_MS = 4000;

let panel: UIWebsite | null = null;
let lastAutoOpen = 0;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

async function closePanel(): Promise<void> {
  const current = panel;
  panel = null;
  await current?.close().catch(() => undefined);
}

/**
 * Ouvre le panneau, ou le déplie s'il existe déjà. Replié, il reste un cadre visible de
 * quelques pixels : la page continue donc de signaler la table où l'on est assis.
 */
async function openPanel(expanded: boolean): Promise<void> {
  if (panel) {
    panel.size = expanded ? EXPANDED : COLLAPSED;
    return;
  }
  panel = await WA.ui.website.open({
    url: PANEL_URL,
    allowApi: true,
    visible: true,
    position: { vertical: "middle", horizontal: "right" },
    size: expanded ? EXPANDED : COLLAPSED,
    margin: { right: "12px" },
  });
}

/** À appeler une fois, après WA.onInit(). */
export function initCowork(): void {
  try {
    WA.mapEditor.area.onEnter(COWORK_AREA).subscribe(() => {
      if (leaveTimer) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
      }
      WA.ui.actionBar.addButton({
        id: BUTTON_ID,
        label: "Cowork",
        bgColor: "#6D1FFF",
        textColor: "#FFFFFF",
        toolTip: "Ouvrir l'espace de coworking",
        callback: () => {
          openPanel(true).catch((e) => console.warn("[cowork] panneau", e));
        },
      });
      // Dans tous les cas le panneau est présent (déplié la première fois, replié ensuite),
      // sinon la personne n'apparaîtrait pas dans la liste.
      const unfold = Date.now() - lastAutoOpen > AUTO_OPEN_EVERY_MS;
      if (unfold) lastAutoOpen = Date.now();
      openPanel(unfold).catch((e) => console.warn("[cowork] panneau", e));
    });
    WA.mapEditor.area.onLeave(COWORK_AREA).subscribe(() => {
      try {
        WA.ui.actionBar.removeButton(BUTTON_ID);
      } catch {
        /* bouton déjà retiré */
      }
      // Le panneau signale son départ puis se ferme tout seul ; on le ferme ici à défaut.
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        closePanel().catch(() => undefined);
      }, LEAVE_GRACE_MS);
    });
  } catch (e) {
    console.warn("[cowork] zone indisponible", e);
  }
}
