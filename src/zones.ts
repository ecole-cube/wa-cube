/* =========================================================
   Zones de la map, pour dire "Salle 3" plutôt que des pixels.
   Les plus précises d'abord : la première qui contient le point gagne.
   ========================================================= */

export interface Zone {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ZONES: Zone[] = [
  { name: "Agora", x: 2656, y: 1664, w: 608, h: 704 },
  { name: "Salle AI Automation Builder", x: 3744, y: 2368, w: 416, h: 400 },
  { name: "Salle 1", x: 1440, y: 352, w: 640, h: 864 },
  { name: "Salle 2", x: 2112, y: 352, w: 640, h: 864 },
  { name: "Salle 3", x: 2784, y: 352, w: 640, h: 864 },
  { name: "Salle 4", x: 3456, y: 352, w: 640, h: 864 },
  { name: "Salle 5", x: 4128, y: 352, w: 640, h: 864 },
  { name: "Salle 6", x: 4800, y: 352, w: 640, h: 864 },
  { name: "Salle 7", x: 5136, y: 1376, w: 336, h: 448 },
  { name: "Staff", x: 346, y: 1240, w: 462, h: 722 },
  { name: "Showroom", x: 119, y: 3497, w: 1470, h: 440 },
  { name: "Événement", x: 4864, y: 2776, w: 514, h: 1040 },
  // Parvis devant l'arche "Bienvenue" jusqu'au point d'arrivée (spawn, y ≈ 4416).
  { name: "Entrée", x: 2800, y: 3680, w: 800, h: 768 },
  { name: "Campus", x: 1408, y: 352, w: 4128, h: 2432 },
];

export function zoneAt(x: number, y: number): string | null {
  const z = ZONES.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  return z ? z.name : null;
}
