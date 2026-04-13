let visionLibPromise;

async function loadVisionLib() {
  if (visionLibPromise) {
    return visionLibPromise;
  }

  const urls = [
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs",
    "https://unpkg.com/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs"
  ];

  visionLibPromise = (async () => {
    let lastError;

    for (const url of urls) {
      try {
        const mod = await import(url);
        const loaded = mod?.default || mod;
        if (loaded?.FilesetResolver && loaded?.HandLandmarker) {
          return loaded;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      `No se pudo cargar tasks-vision en worker. ${lastError instanceof Error ? lastError.message : ""}`.trim()
    );
  })();

  return visionLibPromise;
}

let handLandmarker;
let runningMode = "IMAGE";

async function createHandLandmarker(vision, HandLandmarkerRef) {
  return HandLandmarkerRef.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    },
    numHands: 1,
    runningMode
  });
}

async function initRecognizer() {
  const visionLib = await loadVisionLib();
  const vision = await visionLib.FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  handLandmarker = await createHandLandmarker(vision, visionLib.HandLandmarker);
  globalThis.postMessage({ type: "warning", message: "Modo CPU activo para compatibilidad." });

  globalThis.postMessage({ type: "ready" });
}

globalThis.onmessage = async (event) => {
  const { type } = event.data;

  if (type === "init") {
    try {
      await initRecognizer();
    } catch (error) {
      globalThis.postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Error inicializando MediaPipe worker"
      });
    }
    return;
  }

  if (type === "processFrame") {
    const bitmap = event.data.bitmap;

    if (!handLandmarker) {
      bitmap?.close?.();
      globalThis.postMessage({ type: "result", landmarks: [] });
      return;
    }

    if (runningMode === "IMAGE") {
      runningMode = "VIDEO";
      await handLandmarker.setOptions({ runningMode: "VIDEO" });
    }

    const results = handLandmarker.detectForVideo(bitmap, event.data.timestamp);
    bitmap.close();

    globalThis.postMessage({
      type: "result",
      landmarks: results?.landmarks || []
    });
  }
};
