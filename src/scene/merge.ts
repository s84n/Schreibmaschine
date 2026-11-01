import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const prepared = (mesh: THREE.Mesh, toRoot: THREE.Matrix4): THREE.BufferGeometry => {
  const src = mesh.geometry;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) geo.setAttribute('normal', src.getAttribute('normal').clone());
  else geo.computeVertexNormals();
  const count = geo.getAttribute('position').count;
  geo.setAttribute('uv', src.getAttribute('uv')?.clone() ?? new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  // Alle Teile brauchen einen Index, sonst lassen sie sich nicht zusammenfügen
  geo.setIndex(src.index ? src.index.clone() : Array.from({ length: count }, (_, i) => i));
  geo.applyMatrix4(toRoot);
  return geo;
};

/**
 * Fügt alles Unbewegliche unter `root` je Material zu einem einzigen Mesh zusammen. Jedes Mesh ist
 * ein Draw-Call, und zwar im Bild, im Normalen-Pass und in jeder Schattenkarte erneut: Das ist der
 * teuerste Posten der Szene. Transparentes bleibt einzeln, weil es sortiert werden muss.
 * `keep` nennt bewegliche Teilbäume, die unangetastet bleiben.
 */
export function mergeStatic(root: THREE.Object3D, keep: THREE.Object3D[] = []): void {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map<string, THREE.Mesh[]>();
  const walk = (o: THREE.Object3D) => {
    if (!o.visible || keep.includes(o)) return;
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.Material;
    if (mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !o.children.length && !Array.isArray(mat) && !mat.transparent) {
      const key = `${mat.uuid}|${o.castShadow}|${o.receiveShadow}`;
      const list = buckets.get(key);
      if (list) list.push(mesh);
      else buckets.set(key, [mesh]);
    }
    o.children.forEach(walk);
  };
  walk(root);

  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const merged = mergeGeometries(meshes.map((m) => prepared(m, new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld))));
    if (!merged) continue;
    const out = new THREE.Mesh(merged, meshes[0].material);
    out.castShadow = meshes[0].castShadow;
    out.receiveShadow = meshes[0].receiveShadow;
    meshes.forEach((m) => m.removeFromParent());
    root.add(out);
  }

  // Leere Gruppen kosten sonst weiter Matrix-Updates
  const prune = (o: THREE.Object3D) => {
    [...o.children].forEach((c) => {
      if (keep.includes(c)) return;
      prune(c);
      if (c.type === 'Group' && !c.children.length) c.removeFromParent();
    });
  };
  prune(root);
}
