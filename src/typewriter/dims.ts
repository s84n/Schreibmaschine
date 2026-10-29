import * as THREE from 'three';

/**
 * Zentrale Maße der Maschine in cm (1 Three.js-Einheit = 1 cm).
 * x: rechts, y: oben, z: zum Betrachter.
 */
export const DIMS = {
  bodyHalfWidth: 15,
  bodyFrontZ: 13,
  bodyBackZ: -9.5,
  baseHeight: 1.2,
  /** Oberkante des hinteren Gehäusedecks (unter dem Wagen) */
  deckY: 7.0,
  deckFrontZ: -3.0,

  platenRadius: 1.6,
  platenLength: 25.6,
  platenCenter: new THREE.Vector3(0, 11, -5.6),

  /** Zentrum des Typenhebel-Segments (Drehpunktbogen) */
  segmentCenter: new THREE.Vector3(0, 6.2, -4.0),
  segmentRadius: 5,
  segmentSpreadDeg: 70,
  typebarRestDeg: 28,
};

/** Druckpunkt: Vorderseite der Walze auf Höhe der Achse. */
export const PRINT_POINT = new THREE.Vector3(0, DIMS.platenCenter.y, DIMS.platenCenter.z + DIMS.platenRadius);

/** Höhe der Tastaturplatte (schräg) an Position z. */
export function keyboardDeckY(z: number): number {
  return 2.4 + (DIMS.bodyFrontZ - z) * 0.33;
}
