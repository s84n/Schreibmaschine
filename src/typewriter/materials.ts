import * as THREE from 'three';
import { applyPatina } from './patina';

export type BodyColorId = 'sage' | 'bordeaux' | 'black' | 'cream';

export const BODY_COLORS: Record<BodyColorId, string> = {
  sage: '#6d8c80',
  bordeaux: '#6b1f26',
  black: '#151515',
  cream: '#d9cfb8',
};

export type ModelId = 'reise' | 'kontor' | 'flach';

/** Maschinenmodelle: eigene Entwürfe nach Epochen, gleiche Mechanik, anderes Gehäuse. */
export const MODELS: Record<ModelId, { plaque: string; color: BodyColorId }> = {
  reise: { plaque: 'Reise', color: 'sage' },
  kontor: { plaque: 'Kontor', color: 'black' },
  flach: { plaque: 'Flach', color: 'cream' },
};

export interface Materials {
  lacquer: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  bakelite: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  felt: THREE.MeshStandardMaterial;
  ribbon: THREE.MeshStandardMaterial;
  ribbonRed: THREE.MeshStandardMaterial;
}

export function createMaterials(): Materials {
  const materials: Materials = {
    lacquer: new THREE.MeshPhysicalMaterial({
      color: BODY_COLORS.sage,
      roughness: 0.48,
      metalness: 0.3,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
    }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e6e6e6', metalness: 1, roughness: 0.14 }),
    steel: new THREE.MeshStandardMaterial({ color: '#a7a9ab', metalness: 0.9, roughness: 0.35 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c49a4a', metalness: 1, roughness: 0.28 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#0e0e0e', metalness: 0, roughness: 0.75 }),
    bakelite: new THREE.MeshPhysicalMaterial({
      color: '#161412',
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
    interior: new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.4, roughness: 0.7 }),
    felt: new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 1 }),
    ribbon: new THREE.MeshStandardMaterial({ color: '#0b0b0d', roughness: 0.85 }),
    ribbonRed: new THREE.MeshStandardMaterial({ color: '#7a1010', roughness: 0.85 }),
  };
  // Lack: stumpf, verkratzt, an den Kanten bis aufs Blech abgerieben
  applyPatina(materials.lacquer, {
    grime: 0.3,
    tarnish: '#2b241b',
    tarnishAmount: 0.18,
    pit: '#17120d',
    pitAmount: 0.22,
    scratch: '#b8b2a4',
    scratchAmount: 0.22,
    roughnessMin: 0.45,
    roughnessAdd: 0.25,
    bump: 0.035,
    chip: 0.03,
    bare: '#6a6158',
    coat: 0.8,
  });
  // Verchromtes: milchig angelaufen, mit feinem Lochfraß
  applyPatina(materials.chrome, {
    grime: 0.22,
    tarnish: '#9c8d72',
    tarnishAmount: 0.3,
    pit: '#3a2a1c',
    pitAmount: 0.35,
    scratch: '#f2f2f2',
    scratchAmount: 0.18,
    roughnessMin: 0.2,
    roughnessAdd: 0.28,
    bump: 0.012,
  });
  // Stahl: dunkel oxidiert, Rostpunkte in den Poren
  applyPatina(materials.steel, {
    grime: 0.35,
    tarnish: '#5a4a38',
    tarnishAmount: 0.35,
    pit: '#5c2f16',
    pitAmount: 0.45,
    scratch: '#d5d5d5',
    scratchAmount: 0.3,
    roughnessMin: 0.4,
    roughnessAdd: 0.25,
    bump: 0.02,
  });
  // Messing: fleckig angelaufen, stellenweise grünlich
  applyPatina(materials.brass, {
    grime: 0.3,
    tarnish: '#4c5236',
    tarnishAmount: 0.35,
    pit: '#22291c',
    pitAmount: 0.4,
    scratch: '#e8cf8c',
    scratchAmount: 0.3,
    roughnessMin: 0.32,
    roughnessAdd: 0.28,
    bump: 0.015,
  });
  return materials;
}
