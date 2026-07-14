import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { computeSpherePositions } from "./sphereLayout";

export default function SphereGraph3D({ nos, arestas, metadata, onSelect }) {
  const mountRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const el = mountRef.current;
    if (!el || !nos.length) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#08080f");
    const camera = new THREE.PerspectiveCamera(60, el.clientWidth / el.clientHeight, 0.1, 5000);
    camera.position.set(0, 120, 560);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const group = new THREE.Group();
    scene.add(group);
    const positions = computeSpherePositions(nos, metadata);

    for (const n of nos) {
      const p = positions.get(n.node_id);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.5 + p.peso * 0.9, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(p.cor) })
      );
      mesh.position.set(p.x, p.y, p.z);
      mesh.userData.node = n;
      group.add(mesh);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry((2.5 + p.peso * 0.9) * 1.6, 12, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(p.cor), transparent: true, opacity: 0.12 })
      );
      halo.position.set(p.x, p.y, p.z);
      group.add(halo);
    }
    for (const a of arestas) {
      const s = positions.get(a.origem), t = positions.get(a.destino);
      if (!s || !t) continue;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(s.x, s.y, s.z),
        new THREE.Vector3(t.x, t.y, t.z),
      ]);
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x3f3f46, transparent: true, opacity: 0.35 })));
    }

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(group.children.filter((o) => o.userData.node))[0];
      if (hit) onSelectRef.current?.(hit.object.userData.node);
    };
    renderer.domElement.addEventListener("click", onClick);

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      group.rotation.y += 0.0012;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [nos, arestas, metadata]);

  return <div ref={mountRef} className="w-full h-full" />;
}