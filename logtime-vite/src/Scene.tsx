import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const OBJECTIVE_HOURS = 120;
const ROOM_ROTATION_DEGREES = 90;

const LIGHTING = {
  exposure: 3.2,
  ambient: 0,
  groundColor: '#ffffff',

  keyIntensity: 0,
  keyColor: '#ffffff',
  keyPosition: [-1, -2, -3] as [number, number, number],

  fillIntensity: 20,
  fillPosition: [2, 0, -5] as [number, number, number],

  screenIntensity: 2.5,
  fogDensity: 0.05,
};

const SCREEN = {
  width: 1024,
  height: 768,
  fontFamily: '"ShureTechMono Nerd Font Mono", monospace',
  glowStrength: 22,
};

type Props = {
  readout: string;
  hours: number | null;
};

type ScreenColors = {
  main: string;
  background: string;
  text: string;
};


function getProgressColors(hours: number | null): ScreenColors {
  const safeHours =
    typeof hours === 'number' && Number.isFinite(hours)
      ? Math.max(0, hours)
      : 0;

  // Change these hour values to adjust when each color is reached.
  const stops = [
    { hours: 0, color: '#c52222' },
    { hours: OBJECTIVE_HOURS, color: '#22c558' },
    { hours: 180, color: '#22c5c5' },
    { hours: 220, color: '#224bc5' },
    { hours: 260, color: '#8f22c5' },
    { hours: 300, color: '#c5228f' },
  ];

  const cappedHours = Math.min(
    safeHours,
    stops[stops.length - 1].hours
  );

  let index = 0;

  while (
    index < stops.length - 2 &&
    cappedHours > stops[index + 1].hours
  ) {
    index++;
  }

  const start = stops[index];
  const end = stops[index + 1];

  const progress = THREE.MathUtils.clamp(
    (cappedHours - start.hours) / (end.hours - start.hours),
    0,
    1
  );

  function toRGB(hex: string): number[] {
    const value = parseInt(hex.slice(1), 16);

    return [
      (value >> 16) & 255,
      (value >> 8) & 255,
      value & 255,
    ];
  }

  const startRGB = toRGB(start.color);
  const endRGB = toRGB(end.color);

  const channels = startRGB.map((value, channel) =>
    Math.round(value + (endRGB[channel] - value) * progress)
  );

  const main =
    '#' +
    channels
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('');

  const background = channels.map((channel) =>
    Math.round(channel * 0.3)
  );

  const text = channels.map((channel) =>
    Math.round(channel + (255 - channel) * 0.45)
  );

  return {
    main,
    background: `rgb(${background.join(', ')})`,
    text: `rgb(${text.join(', ')})`,
  };
}

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    geometries.add(object.geometry);

    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of meshMaterials) {
      materials.add(material);

      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) {
          textures.add(value);
        }
      }
    }
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export default function Scene({ readout, hours }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);

  const latest = useRef({ readout, hours });
  const updateScene = useRef<() => void>(() => {});

  const [status, setStatus] = useState(
    'Loading concrete, cables and CRT…'
  );

  useEffect(() => {
    latest.current = { readout, hours };
    updateScene.current();
  }, [readout, hours]);

  useEffect(() => {
    const mount = host.current;
    const canvasNode = canvasElement.current;

    if (!mount || !canvasNode) {
      return;
    }

    let dead = false;
    let renderer: THREE.WebGLRenderer;

    setStatus('Loading concrete, cables and CRT…');

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasNode,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setStatus(
        'WebGL is unavailable. Enable hardware acceleration and reload.'
      );

      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = LIGHTING.exposure;

    // Scene and camera

    const scene = new THREE.Scene();

    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.FogExp2(
      '#000000',
      LIGHTING.fogDensity
    );

    const camera = new THREE.PerspectiveCamera(52, 1, 0.04, 100);

    camera.position.set(2.85, 1.66, 0.85);
    camera.lookAt(1.65, 1.66, -2);

const monitorTarget = new THREE.Vector3(1.65, 1.66, -1.71);
const cameraHome = new THREE.Vector3(1.65, 1.66, 1.85);

camera.position.copy(cameraHome);
camera.lookAt(monitorTarget);

// Maximum sideways and vertical movement, in scene units.
const horizontalMovement = 1.5;
const verticalMovement = 1.5;

const targetOffset = new THREE.Vector2();
const currentOffset = new THREE.Vector2();

let animationFrame = 0;
let previousTime = 0;

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch' || !mount) {
    return;
  }

  const bounds = mount.getBoundingClientRect();

  if (bounds.width <= 0 || bounds.height <= 0) {
    return;
  }

  const x = THREE.MathUtils.clamp(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -1,
    1
  );

  const y = THREE.MathUtils.clamp(
    ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
    -1,
    1
  );

  targetOffset.set(
    x * horizontalMovement,
    -y * verticalMovement
  );
}

function resetCamera() {
  targetOffset.set(0, 0);
}

function animateCamera(time: number) {
  if (dead) {
    return;
  }

  const delta = previousTime
    ? Math.min((time - previousTime) / 1000, 0.1)
    : 0;

  previousTime = time;

  const smoothing = 1 - Math.exp(-8 * delta);

  currentOffset.lerp(targetOffset, smoothing);

  camera.position.set(
    cameraHome.x + currentOffset.x,
    cameraHome.y + currentOffset.y,
    cameraHome.z
  );

  // Keep the monitor centered while the camera moves.
  camera.lookAt(monitorTarget);

  render();

  animationFrame = requestAnimationFrame(animateCamera);
}

    // Lighting

    let colors = getProgressColors(latest.current.hours);

    const hemisphere = new THREE.HemisphereLight(
      colors.main,
      LIGHTING.groundColor,
      LIGHTING.ambient
    );

    scene.add(hemisphere);

    const key = new THREE.DirectionalLight(
      LIGHTING.keyColor,
      LIGHTING.keyIntensity
    );

    key.position.set(...LIGHTING.keyPosition);
    key.castShadow = true;

    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.normalBias = 0.025;

    key.target.position.set(1.65, 0, -2);

    scene.add(key, key.target);

    const fill = new THREE.PointLight(
      colors.main,
      LIGHTING.fillIntensity,
      12,
      2
    );

    fill.position.set(...LIGHTING.fillPosition);
    scene.add(fill);

    const screenLight = new THREE.PointLight(
      colors.main,
      LIGHTING.screenIntensity,
      2.5,
      2
    );

    screenLight.position.set(1.65, 1.65, -1.1);
    scene.add(screenLight);

    // CRT canvas texture

    const screenCanvas = document.createElement('canvas');

    screenCanvas.width = SCREEN.width;
    screenCanvas.height = SCREEN.height;

    const ctx = screenCanvas.getContext('2d');

    if (!ctx) {
      renderer.dispose();
      setStatus('Could not create the CRT screen texture.');

      return;
    }

    const screenTexture = new THREE.CanvasTexture(screenCanvas);

    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.anisotropy =
      renderer.capabilities.getMaxAnisotropy();

    function paint(text: string) {
      if (!ctx) {
        return;
      }

      const centerX = SCREEN.width / 2;
      const centerY = SCREEN.height / 2;

      ctx.clearRect(0, 0, SCREEN.width, SCREEN.height);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);

      const gradient = ctx.createRadialGradient(
        centerX,
        380,
        30,
        centerX,
        380,
        600
      );

      gradient.addColorStop(0, colors.background);
      gradient.addColorStop(1, '#000000');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, SCREEN.width, SCREEN.height);

      const fontSize = 350;

      ctx.font = `bold ${fontSize}px ${SCREEN.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = colors.main;
      ctx.shadowBlur = SCREEN.glowStrength;
      ctx.fillStyle = colors.text;

      ctx.fillText(text, centerX, centerY);

      ctx.shadowBlur = 4;
      ctx.fillText(text, centerX, centerY);

      // Scanlines

      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';

      for (let y = 0; y < SCREEN.height; y += 5) {
        ctx.fillRect(0, y, SCREEN.width, 2);
      }

      screenTexture.needsUpdate = true;
    }

    function render() {
      if (!dead) {
        renderer.render(scene, camera);
      }
    }

    updateScene.current = () => {
      if (dead) {
        return;
      }

      colors = getProgressColors(latest.current.hours);

      hemisphere.color.set(colors.main);
      fill.color.set(colors.main);
      screenLight.color.set(colors.main);

      paint(latest.current.readout);
      render();
    };

    paint(latest.current.readout);

    // Model and cable helpers

    const loader = new GLTFLoader();

    function setup(object: THREE.Object3D) {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(object);
    }

    function addCable(
      points: [number, number, number][],
      radius = 0.014
    ) {
      const curve = new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point))
      );

      const geometry = new THREE.TubeGeometry(
        curve,
        100,
        radius,
        8,
        false
      );

      const material = new THREE.MeshStandardMaterial({
        color: '#151a17',
        roughness: 0.78,
      });

      const cable = new THREE.Mesh(geometry, material);

      cable.castShadow = true;
      cable.receiveShadow = true;

      scene.add(cable);
    }

    function addScreen(tv: THREE.Object3D) {
      const width = 0.274;
      const height = 0.205;
      const radius = 0.019;

      const left = -width / 2;
      const right = width / 2;
      const bottom = -height / 2;
      const top = height / 2;

      const shape = new THREE.Shape();

      shape.moveTo(left + radius, bottom);
      shape.lineTo(right - radius, bottom);

      shape.quadraticCurveTo(
        right,
        bottom,
        right,
        bottom + radius
      );

      shape.lineTo(right, top - radius);
      shape.quadraticCurveTo(right, top, right - radius, top);

      shape.lineTo(left + radius, top);
      shape.quadraticCurveTo(left, top, left, top - radius);

      shape.lineTo(left, bottom + radius);

      shape.quadraticCurveTo(
        left,
        bottom,
        left + radius,
        bottom
      );

      const geometry = new THREE.ShapeGeometry(shape, 20);
      const positions = geometry.attributes.position;
      const uv = geometry.attributes.uv;

      for (let i = 0; i < positions.count; i++) {
        uv.setXY(
          i,
          (positions.getX(i) + width / 2) / width,
          (positions.getY(i) + height / 2) / height
        );
      }

      const material = new THREE.MeshBasicMaterial({
        map: screenTexture,
        toneMapped: false,
      });

      const screen = new THREE.Mesh(geometry, material);

      screen.position.set(0, 0.189, 0.016);
      tv.add(screen);
    }

    // Load and position the models

    async function loadModels() {
      const results = await Promise.allSettled(
        ['room', 'tv', 'table', 'cables'].map((name) =>
          loader.loadAsync(`/models/${name}/scene.gltf`)
        )
      );

      const failed = results.some(
        (result) => result.status === 'rejected'
      );

      if (dead || failed) {
        for (const result of results) {
          if (result.status === 'fulfilled') {
            disposeObject(result.value.scene);
          } else if (!dead) {
            console.error(result.reason);
          }
        }

        if (!dead) {
          setStatus(
            'Could not load the 3D models. Reload this page with the Vite server running.'
          );
        }

        return;
      }

      const models = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      );

      const [room, tv, table, cables] = models;

      try {
        setup(room.scene);

        room.scene.rotation.y = THREE.MathUtils.degToRad(
          ROOM_ROTATION_DEGREES
        );

        room.scene.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) {
            return;
          }

          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];

          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.metalness = 0.08;
              material.roughness = 0.9;
              material.emissiveIntensity = 0.15;
            }
          }
        });

        setup(table.scene);
        table.scene.scale.setScalar(1.25);
        table.scene.position.set(1.65, -0.0015, -2.3);

        setup(tv.scene);
        tv.scene.scale.setScalar(2.5);
        tv.scene.position.set(1.65, 1.184, -1.75);

        addScreen(tv.scene);

        setup(cables.scene);
        cables.scene.scale.setScalar(0.84);
        cables.scene.position.set(4.7, 0.065, -2.7);

        // Wall connection

        addCable([
          [20.1, 0.45, -2.7],
          [20.1, 0.08, -2.7],
          [17, 0.06, -2.65],
        ]);

        // Cable running up the table to the TV

        addCable([
          [2.4, 0.07, -2.7],
          [2.65, 0.08, -2.4],
          [2.7, 0.08, -1.6],
          [2.63, 0.1, -1.4],
          [2.55, 0.5, -1.65],
          [2.48, 1.15, -2.1],
          [2.25, 1.22, -2.7],
          [1.8, 1.3, -2.83],
        ]);

        // Additional floor cable

        addCable(
          [
            [3.1, 0.065, -2.75],
            [2.95, 0.06, -1.55],
            [2.6, 0.065, -1.2],
            [2.32, 0.07, -1.4],
            [2.4, 0.08, -2],
          ],
          0.009
        );

        setStatus('');
        updateScene.current();
      } catch (error) {
        console.error(error);

        // Models already attached to the scene are disposed on cleanup.
        for (const model of models) {
          if (!model.scene.parent) {
            disposeObject(model.scene);
          }
        }

        setStatus('Could not set up the 3D scene.');
      }
    }

    // Resize and render only when needed

    function resize() {
      if (!mount || dead) {
        return;
      }

      const { width, height } = mount.getBoundingClientRect();

      if (width <= 0 || height <= 0) {
        return;
      }

      renderer.setSize(width, height);

      camera.aspect = width / height;
      camera.fov = width < 700 ? 66 : 52;
      camera.updateProjectionMatrix();

      render();
    }

    const observer = new ResizeObserver(resize);

    observer.observe(mount);

    resize();
    void loadModels();


window.addEventListener('pointermove', handlePointerMove);
window.addEventListener('blur', resetCamera);

document.documentElement.addEventListener(
  'pointerleave',
  resetCamera
);

animationFrame = requestAnimationFrame(animateCamera);

    return () => {
      dead = true;

cancelAnimationFrame(animationFrame);

window.removeEventListener('pointermove', handlePointerMove);
window.removeEventListener('blur', resetCamera);

document.documentElement.removeEventListener(
  'pointerleave',
  resetCamera
);

      observer.disconnect();
      updateScene.current = () => {};

      disposeObject(scene);
      screenTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className="scene"
      ref={host}
      aria-label={`3D CRT displaying ${readout}`}
    >
      <canvas ref={canvasElement} aria-hidden="true" />

      {status && (
        <div className="scene-status" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
