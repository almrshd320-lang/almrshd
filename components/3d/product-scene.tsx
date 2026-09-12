'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface SceneProps {
  modelPath?: string;
  colorHex?: string;
  reducedMotion?: boolean;
}

export default function ProductScene({
  modelPath = '/models/phone.glb',
  colorHex = '#8E2434',
  reducedMotion = false,
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const modelRef = useRef<THREE.Group | null>(null);

  // تحديث اللون عند تغيير العميل للون
  useEffect(() => {
    if (!modelRef.current || !colorHex) return;
    const targetColor = new THREE.Color(colorHex);

    modelRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          const name = ((mesh.name || '') + ' ' + (mat.name || '')).toLowerCase();
          const isExcluded = /screen|display|lens|glass|sensor|camera|logo|apple|flash/i.test(name);
          if (!isExcluded && /body|frame|case|back|rail|housing|color|matte|metal|phone|cover/i.test(name)) {
            mat.color.copy(targetColor);
            mat.needsUpdate = true;
          }
        }
      }
    });
  }, [colorHex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. المشهد والكاميرا
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 4.8);

    // 2. محرك الرسوميات (WebGL Renderer)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. أدوات التحكم بالماوس واللمس
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 7;
    controls.minPolarAngle = Math.PI / 4;
    controls.maxPolarAngle = Math.PI / 1.7;

    // 4. الإضاءة الاستوديو
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.2);
    dirLight1.position.set(5, 8, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x9fc4e0, 1.0);
    dirLight2.position.set(-5, 2, -3);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(colorHex, 1.2, 10);
    pointLight.position.set(0, -2, 3);
    scene.add(pointLight);

    // 5. تحميل المجسم وضبط مقاسه وسنترته تلقائياً
    const loader = new GLTFLoader();
    const actualPath = modelPath || '/models/phone.glb';
    let currentModel: THREE.Group | null = null;

    loader.load(
      actualPath,
      (gltf) => {
        const model = gltf.scene;
        currentModel = model;
        modelRef.current = model;

        // سنترة ومطابقة حجم المجسم على الشاشة بدقة
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.3 / (maxDim || 1);

        model.scale.setScalar(scale);
        model.position.x = -center.x * scale;
        model.position.y = -center.y * scale;
        model.position.z = -center.z * scale;

        // تطبيق اللون الأولي
        const targetColor = new THREE.Color(colorHex);
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat) {
              const name = ((mesh.name || '') + ' ' + (mat.name || '')).toLowerCase();
              const isExcluded = /screen|display|lens|glass|sensor|camera|logo|apple|flash/i.test(name);
              if (!isExcluded && /body|frame|case|back|rail|housing|color|matte|metal|phone|cover/i.test(name)) {
                mat.color.copy(targetColor);
                mat.needsUpdate = true;
              }
            }
          }
        });

        scene.add(model);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Error loading 3D model:', err);
        setLoading(false);
      }
    );

    // 6. حلقة التدوير والرسم المستمر
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (currentModel && !reducedMotion) {
        currentModel.rotation.y += 0.006; // دوران هادئ تلقائي
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 7. التجاوب مع أحجام الشاشات المختلفة
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // تنظيف الذاكرة
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelPath, reducedMotion]);

  return (
    <div className="relative h-full w-full min-h-[460px] cursor-grab active:cursor-grabbing">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">
          جاري تحميل المجسم ثلاثي الأبعاد...
        </div>
      )}
      <div ref={containerRef} className="h-full w-full min-h-[460px]" />
    </div>
  );
}