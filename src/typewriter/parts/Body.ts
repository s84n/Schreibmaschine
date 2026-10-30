import * as THREE from 'three';
import { DIMS, keyboardDeckY } from '../dims';
import { MODELS, type Materials, type ModelId } from '../materials';
import { box, shadow, textTexture } from './util';

const WALL = 1.4;
const SPOOL_X = 10;
const SPOOL_Z = -6.4;

/** Seitenprofil (z, y) je Modell: rund geschwungen, hoch gestuft oder flacher Keil. */
function sideProfile(model: ModelId): THREE.Shape {
  const F = DIMS.bodyFrontZ;
  const B = DIMS.bodyBackZ;
  const K = DIMS.keyboardBackZ;
  const D = DIMS.deckFrontZ;
  const Y = DIMS.deckY;
  const kY = keyboardDeckY(K);
  const s = new THREE.Shape();
  s.moveTo(F, 0);
  if (model === 'reise') {
    s.lineTo(F, 1.7);
    s.quadraticCurveTo(F, 2.6, F - 1, 2.95);
    s.lineTo(K + 1, kY + 0.1);
    s.bezierCurveTo(K - 2.5, kY + 0.8, 1.5, Y + 0.05, D, Y + 0.1);
    s.lineTo(B + 1.4, Y + 0.1);
    s.quadraticCurveTo(B, Y + 0.1, B, Y - 1.3);
    s.lineTo(B, 0);
  } else if (model === 'kontor') {
    s.lineTo(F, 3.5);
    s.lineTo(F - 0.8, 3.9);
    s.lineTo(K + 0.4, kY + 1.2);
    s.lineTo(K - 0.8, kY + 2.1);
    s.lineTo(D + 1.2, Y + 1.15);
    s.lineTo(D, Y + 1.3);
    s.lineTo(B + 0.7, Y + 1.3);
    s.lineTo(B, Y + 0.7);
    s.lineTo(B, 0);
  } else {
    s.lineTo(F, 2.3);
    s.lineTo(D + 1, Y - 0.15);
    s.lineTo(D, Y);
    s.lineTo(B + 0.2, Y);
    s.lineTo(B, Y - 0.2);
    s.lineTo(B, 0);
  }
  s.closePath();
  return s;
}

/** Feine Krispellack-Struktur als Bump-Map für die Tastaturplatte. */
function crinkleTexture(): THREE.CanvasTexture {
  const tex = textTexture(
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 90 + Math.random() * 110;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    },
    256,
    256,
  );
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(7, 4);
  return tex;
}

/** Feststehendes Gehäuse: Seitenwände mit Zierleisten, Tastaturplatte, Hinterdeck, Bodenplatte, Füße, Plaketten. */
export function buildBody(m: Materials, model: ModelId): THREE.Group {
  const g = new THREE.Group();
  g.name = 'body';
  const hw = DIMS.bodyHalfWidth;
  const inner = (hw - WALL) * 2;
  const depth = DIMS.bodyFrontZ - DIMS.bodyBackZ;
  const trim = model === 'kontor' ? m.brass : model === 'flach' ? m.steel : m.chrome;

  // Seitenwände aus Profil (z, y), entlang x extrudiert
  const profile = sideProfile(model);
  const wallGeo = new THREE.ExtrudeGeometry(profile, {
    depth: WALL - 0.4,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.2,
    bevelSegments: 4,
    curveSegments: 16,
  });
  wallGeo.rotateY(-Math.PI / 2);
  for (const side of [-1, 1]) {
    const wall = shadow(new THREE.Mesh(wallGeo, m.lacquer));
    // nach rotateY liegt die Extrusion bei x ∈ [-(WALL-0.4), 0]
    wall.position.x = side < 0 ? -hw + WALL - 0.2 : hw - 0.2;
    g.add(wall);
  }

  // Zierlinie folgt der Oberkante des Profils auf beiden Außenflächen
  const edge = profile
    .getPoints(10)
    .filter((p) => p.y > 1 && p.x < DIMS.bodyFrontZ - 0.1 && p.x > DIMS.bodyBackZ + 0.1)
    .map((p) => new THREE.Vector2(p.x, p.y - 0.62));
  for (const side of [-1, 1]) {
    const pts = edge.map((p) => new THREE.Vector3(side * (hw + 0.02), p.y, p.x));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(curve, 90, model === 'kontor' ? 0.045 : 0.075, 6), trim)));
    // Sockelleiste
    const sill = box(0.1, model === 'flach' ? 0.75 : 0.22, depth - 1.2, trim);
    sill.position.set(side * (hw + 0.02), model === 'flach' ? 1.05 : 0.7, (DIMS.bodyFrontZ + DIMS.bodyBackZ) / 2);
    g.add(sill);
    // Schrauben an der Flanke
    for (const z of [DIMS.bodyFrontZ - 1.6, DIMS.bodyBackZ + 1.6]) {
      g.add(screw(side * (hw + 0.03), 1.45, z, 'x', trim));
    }
  }

  // Bodenplatte
  const base = box(hw * 2 - 0.2, DIMS.baseHeight, depth - 0.2, m.lacquer);
  base.position.set(0, DIMS.baseHeight / 2, (DIMS.bodyFrontZ + DIMS.bodyBackZ) / 2);
  g.add(base);

  // Frontblende mit Zierleiste und Modellplakette
  const apron = box(inner, 2.4, 0.3, m.lacquer);
  apron.position.set(0, 1.2, DIMS.bodyFrontZ - 0.15);
  g.add(apron);
  const lip = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, inner - 0.4, 6, 12), trim));
  lip.rotation.z = Math.PI / 2;
  lip.position.set(0, 2.42, DIMS.bodyFrontZ - 0.28);
  g.add(lip);
  for (const side of [-1, 1]) {
    const strip = box(9.5, 0.13, 0.06, trim);
    strip.position.set(side * 8.2, 1.25, DIMS.bodyFrontZ + 0.02);
    g.add(strip);
  }
  const brassy = model === 'kontor';
  const plaqueTex = textTexture(
    (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, brassy ? '#f0d48c' : '#f4f4f4');
      grad.addColorStop(0.5, brassy ? '#a47c34' : '#9c9c9c');
      grad.addColorStop(1, brassy ? '#e2c070' : '#e4e4e4');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'italic bold 56px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(MODELS[model].plaque, w / 2, h / 2 + 3);
    },
    256,
    96,
  );
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.5, 0.08), new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.75, roughness: 0.3 }));
  plaque.position.set(0, 1.25, DIMS.bodyFrontZ + 0.03);
  g.add(plaque);

  // Schräge Tastaturplatte (dunkel, Krispellack)
  const zFront = DIMS.bodyFrontZ - 0.3;
  const zBack = DIMS.keyboardBackZ;
  const slope = Math.atan(0.33);
  const len = Math.hypot(zFront - zBack, keyboardDeckY(zBack) - keyboardDeckY(zFront));
  const deckMat = m.interior.clone();
  deckMat.bumpMap = crinkleTexture();
  deckMat.bumpScale = 0.6;
  deckMat.roughness = 0.82;
  const deck = box(inner, 0.25, len, deckMat);
  deck.position.set(0, (keyboardDeckY(zFront) + keyboardDeckY(zBack)) / 2 - 0.15, (zFront + zBack) / 2);
  deck.rotation.x = slope;
  g.add(deck);
  // Einfassung der Platte: an den Wangen und zum Typenkorb hin
  for (const side of [-1, 1]) {
    const strip = box(0.16, 0.12, len, trim);
    strip.position.set(side * (inner / 2 - 0.08), deck.position.y + 0.17, deck.position.z);
    strip.rotation.x = slope;
    g.add(strip);
  }
  const backStrip = box(inner, 0.14, 0.18, trim);
  backStrip.position.set(0, keyboardDeckY(zBack) + 0.02, zBack);
  g.add(backStrip);

  // Hinterdeck (trägt den Wagen)
  const backDepth = DIMS.deckFrontZ - DIMS.bodyBackZ;
  const back = box(inner, DIMS.deckY - DIMS.baseHeight, backDepth, m.lacquer);
  back.position.set(0, (DIMS.deckY + DIMS.baseHeight) / 2, DIMS.bodyBackZ + backDepth / 2);
  g.add(back);

  // Deckplatte zwischen den Spulen, verschraubt und eingefasst
  const plateZ = (DIMS.bodyBackZ + DIMS.deckFrontZ) / 2 - 0.1;
  const plateD = backDepth - 1;
  const plate = box(15, 0.28, plateD, m.lacquer);
  plate.position.set(0, DIMS.deckY + 0.14, plateZ);
  g.add(plate);
  for (const z of [plateZ - plateD / 2, plateZ + plateD / 2]) {
    const s = box(15.2, 0.1, 0.1, trim);
    s.position.set(0, DIMS.deckY + 0.23, z);
    g.add(s);
    for (const x of [-6.8, 6.8]) g.add(screw(x, DIMS.deckY + 0.3, z + (z < plateZ ? 0.55 : -0.55), 'y', trim));
  }

  // Schale um die Farbbandspulen
  for (const side of [-1, 1]) {
    const ring = shadow(new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.11, 10, 40), trim));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(side * SPOOL_X, DIMS.deckY + 0.04, SPOOL_Z);
    const well = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), m.interior);
    well.rotation.x = -Math.PI / 2;
    well.position.set(side * SPOOL_X, DIMS.deckY + 0.02, SPOOL_Z);
    g.add(ring, well);
  }

  // Farbband-Wahlhebel rechts neben der Tastatur
  const leverBase = box(0.5, 0.1, 1.7, trim);
  leverBase.position.set(hw - 2.1, keyboardDeckY(9.6) + 0.1, 9.6);
  leverBase.rotation.x = slope;
  const leverStem = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 10), m.chrome));
  leverStem.position.set(hw - 2.1, keyboardDeckY(9.6) + 0.5, 9.6);
  leverStem.rotation.x = -0.35;
  const leverKnob = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), m.bakelite));
  leverKnob.position.set(hw - 2.1, keyboardDeckY(9.6) + 0.95, 9.44);
  g.add(leverBase, leverStem, leverKnob);

  // Randsteller auf der Führungsschiene
  for (const x of [-11.5, 11.5]) {
    const stop = box(0.8, 0.7, 0.55, trim);
    stop.position.set(x, DIMS.deckY + 0.42, -8.4);
    g.add(stop);
  }

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
      const foot = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.5, 24), m.rubber));
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

/** Senkkopfschraube mit Schlitz; `axis` ist die Blickrichtung auf den Kopf. */
function screw(x: number, y: number, z: number, axis: 'x' | 'y', mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 16), mat)));
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: '#0a0a0a' }));
  slot.position.y = 0.04;
  slot.rotation.y = (x * 7 + z * 3) % 3;
  g.add(slot);
  g.position.set(x, y, z);
  if (axis === 'x') g.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
  return g;
}
