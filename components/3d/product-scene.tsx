'use client';

import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
  Center,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';

/**
 * The 3D scene. Loaded only by ViewerSection, and only via next/dynamic with
 * ssr:false — three.js must never enter the server bundle or the initial
 * JavaScript payload.
 */

interface SceneProps {
  modelPath: string;
  colorHex: string;
  reducedMotion: boolean;
}

function Model({ modelPath, colorHex, reducedMotion }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelPath);

  // Clone so several viewers on one page do not fight over one instance, and
  // tint the body material to the selected colour.
  const cloned = useMemo(() => {
    const copy = scene.clone(true);
    const target = new THREE.Color(colorHex);

    copy.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        child.material = materials.map((m) => {
          const cloneMaterial = m.clone() as THREE.MeshStandardMaterial;
          // Only re-tint the body; leave glass, screen and lens alone.
          if (/body|frame|case|back|rail/i.test(cloneMaterial.name ?? '')) {
            cloneMaterial.color = target;
            cloneMaterial.metalness = 0.85;
            cloneMaterial.roughness = 0.28;
          }
          return cloneMaterial;
        });
        child.castShadow = true;
      }
    });

    return copy;
  }, [scene, colorHex]);

  // A slow idle rotation, suspended entirely when the OS asks for less motion.
  useFrame((_, delta) => {
    if (reducedMotion || !group.current) return;
    group.current.rotation.y += delta * 0.12;
  });

  return (
    <group ref={group}>
      <Center>
        <primitive object={cloned} scale={1} />
      </Center>
    </group>
  );
}

export default function ProductScene({ modelPath, colorHex, reducedMotion }: SceneProps) {
  return (
    <Canvas
      // Capped so a high-DPR phone does not render four times the pixels it
      // needs and drain the battery.
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      // Only redraw when something actually changes: an idle viewer costs ~0 fps.
      frameloop={reducedMotion ? 'demand' : 'always'}
      shadows
    >
      <PerspectiveCamera makeDefault position={[0, 0, 5.4]} fov={32} />

      {/* Studio lighting: a soft key, a cool rim and a warm fill in the brand
          accent, which is what makes the product read as photographed rather
          than rendered. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 4]} intensity={1.6} castShadow />
      <directionalLight position={[-5, 2, -3]} intensity={0.7} color="#9FC4E0" />
      <pointLight position={[0, -2, 3]} intensity={0.5} color={colorHex} />

      <Suspense fallback={null}>
        <Model modelPath={modelPath} colorHex={colorHex} reducedMotion={reducedMotion} />
        <Environment preset="studio" />
      </Suspense>

      <ContactShadows
        position={[0, -2.1, 0]}
        opacity={0.5}
        scale={11}
        blur={2.6}
        far={4.2}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        // Zoom is bounded: unbounded dolly lets a user end up inside the mesh
        // with no idea how to get back out.
        minDistance={3.6}
        maxDistance={7.5}
        // Keep the camera above the horizon; the underside of a phone model is
        // rarely worth showing and often unfinished.
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 1.7}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.6}
        autoRotate={false}
        // Touch: one finger rotates, two fingers zoom — and the page still
        // scrolls, because a viewer that traps vertical swipes strands mobile
        // users mid-page.
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
    </Canvas>
  );
}
