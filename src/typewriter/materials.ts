import * as THREE from 'three';

export type BodyColorId = 'sage' | 'bordeaux' | 'black' | 'cream';

export const BODY_COLORS: Record<BodyColorId, string> = {
  sage: '#6d8c80',
  bordeaux: '#6b1f26',
  black: '#151515',
  cream: '#d9cfb8',
};

export interface Materials {
  lacquer: THREE.MeshPhysicalMaterial;
  chrome: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  bakelite: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  felt: THREE.MeshStandardMaterial;
  ribbon: THREE.MeshStandardMaterial;
  ribbonRed: THREE.MeshStandardMaterial;
}

export function createMaterials(): Materials {
  return {
    lacquer: new THREE.MeshPhysicalMaterial({
      color: BODY_COLORS.sage,
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    }),
    chrome: new THREE.MeshStandardMaterial({ color: '#e6e6e6', metalness: 1, roughness: 0.14 }),
    steel: new THREE.MeshStandardMaterial({ color: '#a7a9ab', metalness: 0.9, roughness: 0.35 }),
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
}
