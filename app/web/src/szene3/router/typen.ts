import type { V3 } from "../../szene2/huelle";
export type { V3 };

/** Achsparalleler Geraetekoerper in Weltkoordinaten. */
export interface Koerper { schluessel: string; min: V3; max: V3 }
/** Leitung fuer den Pruefer. `netz`: zusammenhaengendes Rohrsystem (T-Abzweige im selben Netz erlaubt). */
export interface PruefLeitung { id: string; netz: string; punkte: V3[]; radius: number; enden: string[] }
export type Regel = "abstand" | "durch_geraet" | "selbst" | "rueckwaerts" | "schraeg" | "boegen" | "kreuzung" | "zyklus" | "kein_weg";
/** `hart`: muss in jeder Welt 0 sein. `kreuzung` (Grundriss-Ueberkreuzung auf verschiedenen Hoehen) ist weich. */
export interface Befund { regel: Regel; leitungen: string[]; ort: V3; hart: boolean }

/** Pruefgrenzen [A] (Spec 5.5). maxBoegen je Geschossabschnitt (PO 14.11.); steigleitung: ab dieser Laenge teilt ein senkrechtes Stueck die Abschnitte. */
export const GRENZEN = { fuge: 0.04, maxBoegen: 6, steigleitung: 1.0, luftUeberGeraet: 0.15, geraetZuschlag: 0.05, geraetNahbereich: 0.15 } as const;
/** Routerwerte [A] (Spec 5.3/5.4). Zelle = halbe Spur (SPUR 0.18). */
export const ROUTER = { zelle: 0.09, bogen: 2, ebenenwechsel: 25, wand: 2, spurFaktor: 0.4, ausweich: 0.25, trasseWand: 0.3, aussenRand: 0.15, fassade: 0.35, runden: 3, startFrei: 0.35, korridor: 0.4 } as const;
