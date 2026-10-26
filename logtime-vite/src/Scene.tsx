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
  fontFamily: '"Digital Clock", monospace',
  glowStrength: 22,
};

type Props = {
  readout: string;
  hours: number | null;
  month: string;
  login: string;
  loginError: boolean;
  busy: boolean;
  onMonthChange: (offset: number) => void;
  onLoginFocus: () => void;
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

export default function Scene({ readout, hours, month, login, loginError, busy, onMonthChange, onLoginFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);

  const latest = useRef({ readout, hours, month, login, loginError, busy, onMonthChange, onLoginFocus });
  const updateScene = useRef<() => void>(() => {});

  const [status, setStatus] = useState(
    'Loading room and CRT TVs…'
  );

  useEffect(() => {
    latest.current = { readout, hours, month, login, loginError, busy, onMonthChange, onLoginFocus };
    updateScene.current();
  }, [readout, hours, month, login, loginError, busy, onMonthChange, onLoginFocus]);

  useEffect(() => {
    const mount = host.current;
    const canvasNode = canvasElement.current;

    if (!mount || !canvasNode) {
      return;
    }

    let dead = false;
    let renderer: THREE.WebGLRenderer;

    setStatus('Loading room and CRT TVs…');

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

const monitorTarget = new THREE.Vector3(1.65, 0.65, -1.71);
const cameraHome = new THREE.Vector3(1.65, 0.95, 1.85);

camera.position.copy(cameraHome);
camera.lookAt(monitorTarget);

// Maximum sideways and vertical movement, in scene units.
const horizontalMovement = 0.5;
const verticalMovement = 0.5;

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

    screenLight.position.set(1.65, 0.48, -1.1);
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

      ctx.font = `${fontSize}px ${SCREEN.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Center the visible glyphs, accounting for the font's bearings and baseline.
      const metrics = ctx.measureText(text);
      const textX = centerX + (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2;
      const textY = centerY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;

      ctx.shadowColor = colors.main;
      ctx.shadowBlur = SCREEN.glowStrength;
      ctx.fillStyle = colors.text;

      ctx.fillText(text, textX, textY);

      ctx.shadowBlur = 4;
      ctx.fillText(text, textX, textY);

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

    const sideDisplays: {kind: 'month' | 'login'; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; mesh: THREE.Mesh}[] = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function paintSideDisplays() {
      for (const display of sideDisplays) {
        const context = display.canvas.getContext('2d')!;
        const state = latest.current;
        context.shadowBlur = 0;
        context.fillStyle = '#000000';
        context.fillRect(0, 0, 1024, 768);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = state.loginError && display.kind === 'login' ? '#ff7777' : '#b8edc2';
        context.shadowColor = context.fillStyle;
        context.shadowBlur = 14;
        context.font = `36px ${SCREEN.fontFamily}`;
        context.fillText(display.kind === 'month' ? 'MONTH' : 'LOGIN', 512, 125);
        if (display.kind === 'month') {
          context.font = `270px ${SCREEN.fontFamily}`;
          context.fillText(String(Number(state.month.slice(5))), 512, 380);
          // Draw arrows as paths so they do not depend on font glyph support.
          context.strokeStyle = context.fillStyle;
          context.lineWidth = 15;
          context.lineCap = 'round';
          for (const [x, direction] of [[160, -1], [864, 1]]) {
            context.beginPath();
            context.moveTo(x - direction * 28, 335);
            context.lineTo(x + direction * 28, 380);
            context.lineTo(x - direction * 28, 425);
            context.stroke();
          }
          context.font = `40px ${SCREEN.fontFamily}`;
          context.fillText(state.month.slice(0, 4), 512, 595);
        } else {
          const text = state.loginError ? 'ERR' : state.busy ? '…' : state.login || '_';
          let size = 180;
          context.font = `${size}px ${SCREEN.fontFamily}`;
          while (context.measureText(text).width > 880 && size > 24) {
            size -= 2;
            context.font = `${size}px ${SCREEN.fontFamily}`;
          }
          context.fillText(text, 512, 380);
          context.font = `32px ${SCREEN.fontFamily}`;
          context.fillText(state.loginError ? 'TYPE TO RETRY' : state.busy ? 'LOADING' : 'TYPE LOGIN / ENTER', 512, 610);
        }
        context.shadowBlur = 0;
        context.fillStyle = 'rgba(0, 0, 0, 0.18)';
        for (let y = 0; y < 768; y += 5) context.fillRect(0, y, 1024, 2);
        display.texture.needsUpdate = true;
      }
    }

    function hitDisplay(event: PointerEvent) {
      const bounds = canvasNode!.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
        -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(sideDisplays.map(display => display.mesh), false)[0];
    }

    function handleScreenPointer(event: PointerEvent) {
      const hit = hitDisplay(event);
      if (!hit?.uv) return;
      event.preventDefault();
      const display = sideDisplays.find(item => item.mesh === hit.object)!;
      if (display.kind === 'month') {
        if (hit.uv.x < 0.3) latest.current.onMonthChange(-1);
        else if (hit.uv.x > 0.7) latest.current.onMonthChange(1);
      }
      latest.current.onLoginFocus();
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
      paintSideDisplays();
      render();
    };

    paint(latest.current.readout);

    // Canvas text must be repainted after the web font becomes available.
    void document.fonts.load(`48px ${SCREEN.fontFamily}`).then(() => {
      if (dead) return;
      paint(latest.current.readout);
      paintSideDisplays();
      render();
    }).catch(error => console.error('Could not load the display font:', error));

    // Model helpers

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

    function blackOutScreens(object: THREE.Object3D, materialNames: string[]) {
      const replaced = new Set<THREE.Material>();
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;

        const replace = (material: THREE.Material) => {
          if (!materialNames.includes(material.name)) return material;
          replaced.add(material);
          return new THREE.MeshBasicMaterial({
            name: material.name,
            color: '#000000',
            side: material.side,
            toneMapped: false,
          });
        };

        child.material = Array.isArray(child.material)
          ? child.material.map(replace)
          : replace(child.material);
      });

      // These screen and glass materials use textures separate from the cabinets.
      const textures = new Set<THREE.Texture>();
      replaced.forEach((material) => {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
    }

    function addSideDisplay(object: THREE.Object3D, glassName: string, kind: 'month' | 'login') {
      // The glass is already facing +Z after placement. Put the display just ahead of it.
      let glass: THREE.Mesh | undefined;
      object.traverse(child => {
        if (child instanceof THREE.Mesh && !Array.isArray(child.material) && child.material.name === glassName) glass = child;
      });
      if (!glass) throw new Error(`Missing ${kind} screen glass`);
      const bounds = new THREE.Box3().setFromObject(glass, true);
      const size = bounds.getSize(new THREE.Vector3());
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 768;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size.x * 0.94, size.y * 0.94),
        new THREE.MeshBasicMaterial({map: texture, toneMapped: false})
      );
      mesh.position.copy(bounds.getCenter(new THREE.Vector3()));
      mesh.position.z = bounds.max.z + 0.003;
      scene.add(mesh);
      sideDisplays.push({kind, canvas, texture, mesh});
    }

    function placeTV(
      object: THREE.Object3D,
      width: number,
      rotationY: number,
      centerX: number,
      bottomY: number,
      frontZ: number
    ) {
      object.rotation.y = rotationY;
      const bounds = new THREE.Box3().setFromObject(object, true);
      object.scale.multiplyScalar(width / bounds.getSize(new THREE.Vector3()).x);
      bounds.setFromObject(object, true);
      object.position.add(new THREE.Vector3(
        centerX - bounds.getCenter(new THREE.Vector3()).x,
        bottomY - bounds.min.y,
        frontZ - bounds.max.z
      ));
      setup(object);
      return new THREE.Box3().setFromObject(object, true);
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
        ['room', 'tv', 'retro_crt_tv', 'retro_crt_tv_2', 'retro_crt_tv_3'].map((name) =>
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

      const [room, tv, leftTV, rightTV, topTV] = models;

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

        // Keep the original CRT at its existing scale, resting on the floor.
        tv.scene.scale.setScalar(2.5);
        const mainWidth = new THREE.Box3().setFromObject(tv.scene, true)
          .getSize(new THREE.Vector3()).x;
        const mainBounds = placeTV(tv.scene, mainWidth, 0, 1.65, 0, -1.72);
        addScreen(tv.scene);

        blackOutScreens(leftTV.scene, ['.013', '.016']);
        blackOutScreens(rightTV.scene, ['.008', '.010']);

        // These two exports face +X; turn their screens toward the camera (+Z).
        const sideWidth = 0.95;
        const gap = 0.12;
        const sideOffset = mainWidth / 2 + gap + sideWidth / 2;
        placeTV(leftTV.scene, sideWidth, -Math.PI / 2,
          1.65 - sideOffset, 0, mainBounds.max.z);
        placeTV(rightTV.scene, sideWidth, -Math.PI / 2,
          1.65 + sideOffset, 0, mainBounds.max.z);

        addSideDisplay(leftTV.scene, '.016', 'month');
        addSideDisplay(rightTV.scene, '.010', 'login');

        // Center the smaller TV over the original cabinet, including its depth.
        const topBounds = placeTV(topTV.scene, 0.72, 0,
          1.65, mainBounds.max.y, mainBounds.max.z);
        topTV.scene.position.z += mainBounds.getCenter(new THREE.Vector3()).z
          - topBounds.getCenter(new THREE.Vector3()).z;

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


canvasNode.addEventListener('pointerdown', handleScreenPointer);
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

canvasNode.removeEventListener('pointerdown', handleScreenPointer);
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
