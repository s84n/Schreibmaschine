import * as THREE from 'three';
import { DIMS, keyboardDeckY } from '../dims';
import type { Materials } from '../materials';
import { box, shadow, textTexture } from './util';

const WALL = 1.4;

/** Feststehendes Gehäuse: Seitenwände, Tastaturplatte, Hinterdeck, Bodenplatte, Füße, Plakette. */
export function buildBody(m: Materials): THREE.Group {
  const g = new THREE.Group();
  g.name = 'body';
  const hw = DIMS.bodyHalfWidth;
  const inner = (hw - WALL) * 2;
  const depth = DIMS.bodyFrontZ - DIMS.bodyBackZ;

  // Seitenwände aus Profil (z, y), entlang x extrudiert
  const profile = new THREE.Shape();
  const pts: [number, number][] = [
    [DIMS.bodyFrontZ, 0],
    [DIMS.bodyFrontZ, 2.4],
    [DIMS.keyboardBackZ, keyboardDeckY(DIMS.keyboardBackZ) + 0.3],
    [2.5, 6.8],
    [DIMS.deckFrontZ, DIMS.deckY],
    [DIMS.bodyBackZ, DIMS.deckY],
    [DIMS.bodyBackZ, 0],
  ];
  profile.moveTo(pts[0][0], pts[0][1]);
  for (const [z, y] of pts.slice(1)) profile.lineTo(z, y);
  profile.closePath();
  const wallGeo = new THREE.ExtrudeGeometry(profile, {
    depth: WALL - 0.4,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.2,
    bevelSegments: 4,
  });
  wallGeo.rotateY(-Math.PI / 2);
  for (const side of [-1, 1]) {
    const wall = shadow(new THREE.Mesh(wallGeo, m.lacquer));
    // nach rotateY liegt die Extrusion bei x ∈ [-(WALL-0.4), 0]
    wall.position.x = side < 0 ? -hw + WALL - 0.2 : hw - 0.2;
    g.add(wall);
  }

  // Bodenplatte
  const base = box(hw * 2 - 0.2, DIMS.baseHeight, depth - 0.2, m.lacquer);
  base.position.set(0, DIMS.baseHeight / 2, (DIMS.bodyFrontZ + DIMS.bodyBackZ) / 2);
  g.add(base);

  // Frontblende
  const apron = box(inner, 2.4, 0.3, m.lacquer);
  apron.position.set(0, 1.2, DIMS.bodyFrontZ - 0.15);
  g.add(apron);

  // Schräge Tastaturplatte (dunkel)
  const zFront = DIMS.bodyFrontZ - 0.3;
  const zBack = DIMS.keyboardBackZ;
  const len = Math.hypot(zFront - zBack, keyboardDeckY(zBack) - keyboardDeckY(zFront));
  const deck = box(inner, 0.25, len, m.interior);
  deck.position.set(0, (keyboardDeckY(zFront) + keyboardDeckY(zBack)) / 2 - 0.15, (zFront + zBack) / 2);
  deck.rotation.x = Math.atan(0.33);
  g.add(deck);

  // Hinterdeck (trägt den Wagen)
  const backDepth = DIMS.deckFrontZ - DIMS.bodyBackZ;
  const back = box(inner, DIMS.deckY - DIMS.baseHeight, backDepth, m.lacquer);
  back.position.set(0, (DIMS.deckY + DIMS.baseHeight) / 2, DIMS.bodyBackZ + backDepth / 2);
  g.add(back);

  // Innenraum unter dem Typenkorb
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(inner, DIMS.bodyFrontZ - DIMS.deckFrontZ), m.interior);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, DIMS.baseHeight + 0.01, (DIMS.bodyFrontZ + DIMS.deckFrontZ) / 2);
  floor.receiveShadow = true;
  g.add(floor);

  // Feste Führungsschiene hinten
  const rail = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, hw * 2 - 1, 16), m.chrome));
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, DIMS.deckY + 0.3, -8.4);
  g.add(rail);

  // Gummifüße
  for (const x of [-hw + 2, hw - 2]) {
    for (const z of [DIMS.bodyFrontZ - 2, DIMS.bodyBackZ + 2]) {
      const foot = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.5, 20), m.rubber));
      foot.position.set(x, -0.2, z);
      g.add(foot);
    }
  }

  // Plakette auf der Vorderseite des Hinterdecks
  const badgeTex = textTexture(
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f2f2f2');
      grad.addColorStop(0.5, '#9a9a9a');
      grad.addColorStop(1, '#e0e0e0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'italic bold 52px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Schreibmaschine', w / 2, h / 2 + 3);
    },
    512,
    96,
  );
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.2),
    new THREE.MeshStandardMaterial({ map: badgeTex, metalness: 0.8, roughness: 0.3 }),
  );
  badge.position.set(0, 5.2, DIMS.deckFrontZ + 0.01);
  g.add(badge);

  return g;
}
