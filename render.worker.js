import * as THREE from "https://unpkg.com/three@0.155.0/build/three.module.js";

let renderer;
let scene;
let camera;
let cursor;
let cursorCore;

const cards = [];
const helperRay = new THREE.Raycaster();
const pointerNdcCurrent = new THREE.Vector2(0, 0);
const pointerNdcTarget = new THREE.Vector2(0, 0);
const pointerWorld = new THREE.Vector3();
const pointerDirection = new THREE.Vector3();
const pointerPlanePosition = new THREE.Vector3();

let pointerActive = false;

function addInteractiveCard(mesh, label, hoverScale) {
  mesh.userData.label = label;
  mesh.userData.hoverScale = hoverScale;
  mesh.userData.clickPulse = 0;
  cards.push(mesh);
  scene.add(mesh);
}

function getHoveredCard() {
  helperRay.setFromCamera(pointerNdcCurrent, camera);
  const hits = helperRay.intersectObjects(cards, false);
  return hits[0]?.object || null;
}

function updateRendererSize(width = 960, height = 540) {
  if (!renderer || !camera) {
    return;
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function createStage() {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x071726, 6, 20);

  camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.1, 100);
  camera.position.set(0, 0.3, 4.6);

  const hemi = new THREE.HemisphereLight(0xa8d9ff, 0x10253a, 1.05);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 0.7);
  key.position.set(2, 3, 4);
  scene.add(key);

  const floorGeo = new THREE.PlaneGeometry(12, 8, 1, 1);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0d1f34,
    roughness: 0.92,
    metalness: 0.1
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.y = -1.45;
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const titleGeo = new THREE.BoxGeometry(2.9, 0.9, 0.2);
  const titleMat = new THREE.MeshStandardMaterial({
    color: 0x2d86d2,
    roughness: 0.35,
    metalness: 0.2,
    emissive: 0x11324a
  });
  const titleCard = new THREE.Mesh(titleGeo, titleMat);
  titleCard.position.set(0, 1.3, -0.8);
  addInteractiveCard(titleCard, "Titulo", 1.14);

  for (let i = 0; i < 3; i += 1) {
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.85, 0.16),
      new THREE.MeshStandardMaterial({
        color: i === 1 ? 0x39b3ff : 0x1f547e,
        roughness: 0.4,
        metalness: 0.24,
        emissive: 0x0f2d47
      })
    );

    card.position.set(-1.55 + i * 1.55, 0, -0.9);
    addInteractiveCard(card, `Tarjeta ${i + 1}`, 1.09);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.018, 18, 44),
    new THREE.MeshBasicMaterial({ color: 0x9ceeff, transparent: true, opacity: 0.95 })
  );

  cursorCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );

  cursor = new THREE.Group();
  cursor.add(ring);
  cursor.add(cursorCore);
  cursor.visible = false;
  scene.add(cursor);
}

function ndcToPlanePoint(ndcX, ndcY) {
  pointerWorld.set(ndcX, ndcY, 0.5).unproject(camera);
  pointerDirection.copy(pointerWorld).sub(camera.position).normalize();

  const t = -camera.position.z / pointerDirection.z;
  pointerPlanePosition.copy(camera.position).addScaledVector(pointerDirection, t);
  return pointerPlanePosition;
}

function updateCardsHover() {
  const hoveredCard = pointerActive ? getHoveredCard() : null;

  for (const card of cards) {
    const hover = pointerActive && hoveredCard === card;
    const targetScale = hover ? card.userData.hoverScale : 1;
    const clickBoost = card.userData.clickPulse || 0;
    const mixedTargetScale = targetScale + clickBoost * 0.16;

    card.scale.x += (mixedTargetScale - card.scale.x) * 0.12;
    card.scale.y += (mixedTargetScale - card.scale.y) * 0.12;
    card.scale.z += (mixedTargetScale - card.scale.z) * 0.12;

    card.userData.clickPulse = Math.max(0, clickBoost - 0.06);

    let emissiveColor = 0x0f2d47;
    if (hover) {
      emissiveColor = 0x2c6e9a;
    }
    if (clickBoost > 0) {
      emissiveColor = 0x62b6eb;
    }

    card.material.emissive.setHex(emissiveColor);
  }
}

function triggerPointerClick() {
  if (!pointerActive) {
    globalThis.postMessage({ type: "clickMiss" });
    return;
  }

  const hoveredCard = getHoveredCard();
  if (!hoveredCard) {
    globalThis.postMessage({ type: "clickMiss" });
    return;
  }

  hoveredCard.userData.clickPulse = 1;

  globalThis.postMessage({
    type: "itemClicked",
    itemName: hoveredCard.userData.label || "Elemento"
  });
}

function tick() {
  pointerNdcCurrent.x += (pointerNdcTarget.x - pointerNdcCurrent.x) * 0.22;
  pointerNdcCurrent.y += (pointerNdcTarget.y - pointerNdcCurrent.y) * 0.22;

  const point = ndcToPlanePoint(pointerNdcCurrent.x, pointerNdcCurrent.y);

  cursor.visible = pointerActive;
  if (cursor.visible) {
    cursor.position.copy(point);

    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.08;
    cursor.scale.setScalar(pulse);
    cursorCore.material.color.setHex(0xffffff);
  }

  updateCardsHover();

  renderer.render(scene, camera);
}

function initScene(canvas, width, height, devicePixelRatio) {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(devicePixelRatio || 1);
  renderer.setClearColor(0x071726, 1);

  createStage();
  updateRendererSize(width, height);

  renderer.setAnimationLoop(tick);
  globalThis.postMessage({ type: "ready" });
}

globalThis.onmessage = (event) => {
  const { type } = event.data;

  if (type === "init") {
    initScene(
      event.data.canvas,
      event.data.width,
      event.data.height,
      event.data.devicePixelRatio
    );
    return;
  }

  if (type === "resize") {
    updateRendererSize(event.data.width, event.data.height);
    return;
  }

  if (type === "pointerUpdate") {
    pointerActive = !!event.data.active;

    if (typeof event.data.x === "number" && typeof event.data.y === "number") {
      pointerNdcTarget.set(event.data.x * 2 - 1, -(event.data.y * 2 - 1));
    }
    return;
  }

  if (type === "pointerReset") {
    pointerActive = false;
    return;
  }

  if (type === "triggerClick") {
    triggerPointerClick();
  }
};
