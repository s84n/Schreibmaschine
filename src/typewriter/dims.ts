import * as THREE from 'three';

/**
 * Zentrale Maße der Maschine in cm (1 Three.js-Einheit = 1 cm).
 * x: rechts, y: oben, z: zum Betrachter.
 */
export const DIMS = {
  bodyHalfWidth: 15,
  bodyFrontZ: 17,
  bodyBackZ: -9.5,
  baseHeight: 1.2,
  /** Oberkante des hinteren Gehäusedecks (unter dem Wagen) */
  deckY: 7.0,
  deckFrontZ: -4.6,
  /** Hinterkante der schrägen Tastaturplatte – davor liegt der offene Typenkorb */
  keyboardBackZ: 8.0,

  platenRadius: 1.6,
  platenLength: 25.6,
  platenCenter: new THREE.Vector3(0, 11, -5.6),

  /**
   * Zentrum des Typenhebel-Segments (Drehpunktbogen). Wie bei echten Reisemaschinen:
   * kleiner Bogen tief vor der Walze, lange Hebel liegen in Ruhe fast waagerecht im
   * offenen Korb hinter der letzten Tastenreihe und schwingen ~120° zum Druckpunkt.
   */
  segmentCenter: new THREE.Vector3(0, 4.0, -4.0),
  segmentRadius: 3.6,
  segmentSpreadDeg: 70,
  typebarRestDeg: 4,
};

/** Druckpunkt: Vorderseite der Walze auf Höhe der Achse. */
export const PRINT_POINT = new THREE.Vector3(0, DIMS.platenCenter.y, DIMS.platenCenter.z + DIMS.platenRadius);

/** Höhe der Tastaturplatte (schräg) an Position z. */
export function keyboardDeckY(z: number): number {
  return 2.4 + (DIMS.bodyFrontZ - z) * 0.33;
}
