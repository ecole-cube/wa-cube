/// <reference types="@workadventure/iframe-api-typings" />

/* =========================================================
   Cloche « Nouveautés »
   ---------------------------------------------------------
   Un bouton « 🔔 » dans la barre d'actions du haut, à droite de « Plan & FAQ » (même ligne, même hauteur : c'est
   un bouton natif de WorkAdventure), avec le nombre de nouveautés non lues. Un clic ouvre la liste (page du site,
   fenêtre à droite) : message, vidéo, lien, et « Marquer comme lu », qui enlève le compteur. Les nouveautés lues
   restent consultables. Elles sont publiées depuis l'onglet Admin du site (« Nouveautés (cloche) »).
   Le compteur est relu au chargement, toutes les 2 minutes et à chaque « lu » (variable newsTick).
   ========================================================= */

const COUNT_URL = "https://campus-entry-cube.lovable.app/api/public/news";
const PAGE_URL = "https://campus-entry-cube.lovable.app/nouveautes";
const REFRESH_MS = 2 * 60_000;
const BUTTON_ID = "news-btn";

let unread = 0;

async function fetchUnread(): Promise<number | null> {
  const token = WA.player.userRoomToken;
  if (!token) return null;
  try {
    const res = await fetch(COUNT_URL, {
      method: "POST",
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "text/plain" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { unread?: number };
    return typeof body.unread === "number" ? body.unread : null;
  } catch {
    return null;
  }
}

function openList(): void {
  WA.ui.modal.openModal({
    title: "Nouveautés",
    src: PAGE_URL,
    allow: "fullscreen; clipboard-write",
    allowApi: true,
    position: "right",
    closable: true,
    allowFullScreen: false,
  });
}

/** (Re)pose le bouton : orange avec le nombre quand il y a du non lu, sombre sinon. */
function draw(): void {
  try {
    WA.ui.actionBar.removeButton(BUTTON_ID);
  } catch {
    /* pas encore posé */
  }
  WA.ui.actionBar.addButton({
    id: BUTTON_ID,
    label: unread > 0 ? `🔔 ${unread > 9 ? "9+" : unread}` : "🔔",
    bgColor: unread > 0 ? "#F5821F" : "#2C2C30",
    textColor: unread > 0 ? "#1D1D23" : "#FFFFFF",
    toolTip: unread > 0 ? "Nouveautés non lues" : "Nouveautés",
    callback: openList,
  });
}

function setUnread(n: number): void {
  if (n === unread) return;
  unread = n;
  draw();
}

async function refresh(): Promise<void> {
  const n = await fetchUnread();
  if (n !== null) setUnread(n);
}

/** À appeler une fois, après WA.onInit(). */
export async function initNews(): Promise<void> {
  draw();
  // Le volet donne directement le nombre restant ; on le relit aussi sur le serveur pour confirmer.
  WA.player.state.onVariableChange("newsTick").subscribe((value) => {
    const left = (value as { unread?: unknown } | undefined)?.unread;
    if (typeof left === "number") setUnread(left);
    void refresh();
  });
  void refresh();
  setInterval(() => void refresh(), REFRESH_MS);
}
