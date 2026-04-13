const video = document.getElementById("webcam");
const threeCanvas = document.getElementById("three_canvas");
const startButton = document.getElementById("start_button");
const asrButton = document.getElementById("asr_button");
const statusText = document.getElementById("status_text");
const asrText = document.getElementById("asr_text");
const asrCommandText = document.getElementById("asr_command_text");
const clickText = document.getElementById("click_text");

let webcamRunning = false;
let mediapipeReady = false;
let renderReady = false;
let renderInitialized = false;
let frameInFlight = false;
let asrEnabled = false;
let asrListening = false;
let speechRecognizer;
let lastClickTime = 0;
const CLICK_DEBOUNCE_MS = 1000;
let lastProcessedCommand = "";

const SpeechRecognitionCtor = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

const mediapipeWorker = new Worker(new URL("./mediapipe.worker.cpu.js?v=cpu-4", import.meta.url));
const renderWorker = new Worker(new URL("./render.worker.js?v=ui-3", import.meta.url), {
  type: "module"
});

mediapipeWorker.onmessage = (event) => {
  const { type } = event.data;

  if (type === "ready") {
    mediapipeReady = true;
    statusText.innerText = "Detector de mano listo. Iniciando cámara...";
    startButton.disabled = false;
    initializeSystemAutomatically();
    return;
  }

  if (type === "error") {
    statusText.innerText = `Error MediaPipe: ${event.data.message}`;
    webcamRunning = false;
    startButton.disabled = false;
    startButton.innerText = "Reanudar cámara";
    updateAsrUi();
    return;
  }

  if (type === "warning") {
    statusText.innerText = `MediaPipe: ${event.data.message}`;
    return;
  }

  if (type === "result") {
    frameInFlight = false;
    const landmarks = event.data.landmarks || [];

    if (!renderReady) {
      return;
    }

    if (!landmarks.length || !landmarks[0]?.[8]) {
      renderWorker.postMessage({ type: "pointerUpdate", active: false });
      return;
    }

    const indexTip = landmarks[0][8];
    renderWorker.postMessage({
      type: "pointerUpdate",
      active: true,
      x: indexTip.x,
      y: indexTip.y
    });
  }
};

renderWorker.onmessage = (event) => {
  const { type } = event.data;

  if (type === "ready") {
    renderReady = true;
    statusText.innerText = mediapipeReady
      ? "Interfaz 3D lista. Activando cámara y ASR..."
      : "Interfaz 3D lista. Esperando detector de mano...";
    if (mediapipeReady) {
      initializeSystemAutomatically();
    }
    return;
  }

  if (type === "itemClicked") {
    const itemName = event.data.itemName || "Elemento";
    clickText.innerText = `Elemento clicado: ${itemName}.`;
    speakText(`Has clicado ${itemName}`);
    return;
  }

  if (type === "clickMiss") {
    clickText.innerText = "Elemento clicado: ninguno (cursor fuera de elementos).";
  }
};

function updateAsrUi() {
  if (!SpeechRecognitionCtor) {
    asrButton.disabled = true;
    asrText.innerText = "ASR no disponible en este navegador.";
    asrCommandText.innerText = "Comando reconocido: no disponible";
    return;
  }

  asrButton.disabled = !webcamRunning;
  asrButton.innerText = asrEnabled ? "Detener ASR" : "Activar ASR";
  asrText.innerText = asrEnabled
    ? "ASR activo: di 'click' o 'clic' para pulsar el elemento bajo el cursor."
    : "ASR inactivo.";

  if (!asrEnabled) {
    asrCommandText.innerText = "Comando reconocido: -";
  }
}

function initializeSystemAutomatically() {
  if (mediapipeReady && renderReady && !webcamRunning) {
    enableCameraForGesturesAuto();
  }
}

function enableCameraForGesturesAuto() {
  if (webcamRunning) {
    return;
  }

  enableCameraForGestures(true);
}

function speakText(text) {
  const synth = globalThis.speechSynthesis;
  if (!synth) {
    return;
  }

  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  utterance.rate = 1;
  utterance.pitch = 1;
  synth.speak(utterance);
}

function triggerVoiceClick() {
  if (!renderReady) {
    return;
  }

  const now = Date.now();
  if (now - lastClickTime < CLICK_DEBOUNCE_MS) {
    return;
  }

  lastClickTime = now;
  renderWorker.postMessage({ type: "triggerClick" });
}

function ensureSpeechRecognizer() {
  if (!SpeechRecognitionCtor || speechRecognizer) {
    return;
  }

  speechRecognizer = new SpeechRecognitionCtor();
  speechRecognizer.lang = "es-ES";
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = false;

  speechRecognizer.onresult = (event) => {
    let transcript = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      if (event.results[i].isFinal) {
        transcript += ` ${event.results[i][0].transcript}`;
      }
    }

    const normalized = transcript.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    if (normalized === lastProcessedCommand) {
      return;
    }

    lastProcessedCommand = normalized;
    asrCommandText.innerText = `Comando reconocido: ${normalized}`;

    if (normalized.includes("click") || normalized.includes("clic")) {
      asrCommandText.innerText = `Comando reconocido: ${normalized} -> click detectado`;
      triggerVoiceClick();
    } else {
      asrCommandText.innerText = `Comando reconocido: ${normalized} -> sin accion`;
    }
  };

  speechRecognizer.onend = () => {
    asrListening = false;
    lastProcessedCommand = "";

    if (asrEnabled) {
      startAsr();
    }
  };

  speechRecognizer.onerror = (event) => {
    asrText.innerText = `Error ASR: ${event.error}`;
  };
}

function startAsr() {
  if (!speechRecognizer || asrListening) {
    return;
  }

  try {
    speechRecognizer.start();
    asrListening = true;
  } catch {
    asrListening = false;
  }
}

function stopAsr() {
  if (!speechRecognizer || !asrListening) {
    return;
  }

  speechRecognizer.stop();
  asrListening = false;
}

function toggleAsr() {
  if (!SpeechRecognitionCtor) {
    updateAsrUi();
    return;
  }

  ensureSpeechRecognizer();
  asrEnabled = !asrEnabled;

  if (asrEnabled) {
    startAsr();
  } else {
    stopAsr();
  }

  updateAsrUi();
}

function syncRendererSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  threeCanvas.width = width;
  threeCanvas.height = height;

  if (renderInitialized) {
    renderWorker.postMessage({ type: "resize", width, height });
  }
}

function initRenderWorker() {
  if (renderInitialized) {
    return;
  }

  if (!threeCanvas.transferControlToOffscreen) {
    statusText.innerText = "OffscreenCanvas no disponible en este navegador.";
    return;
  }

  syncRendererSize();

  const offscreen = threeCanvas.transferControlToOffscreen();

  renderWorker.postMessage(
    {
      type: "init",
      canvas: offscreen,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    [offscreen]
  );

  renderInitialized = true;
}

async function enableCameraForGestures(autoStartAsr = false) {
  if (!mediapipeReady) {
    statusText.innerText = "Espera a que cargue MediaPipe...";
    return;
  }

  if (webcamRunning) {
    webcamRunning = false;
    frameInFlight = false;

    const stream = video.srcObject;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }

    video.srcObject = null;
    renderWorker.postMessage({ type: "pointerReset" });
    startButton.innerText = "Reanudar cámara";
    statusText.innerText = "Cámara detenida. El cursor queda inactivo.";
    if (asrEnabled) {
      asrEnabled = false;
      stopAsr();
      updateAsrUi();
    }
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    webcamRunning = true;
    startButton.innerText = "Parar cómara";
    statusText.innerText = "Cámara activa (oculta). Mueve tu mano para controlar el cursor.";
    updateAsrUi();

    if (autoStartAsr) {
      asrEnabled = true;
      ensureSpeechRecognizer();
      startAsr();
      updateAsrUi();
    }

    requestAnimationFrame(loopFrame);
  } catch {
    webcamRunning = false;
    statusText.innerText = "No se pudo acceder a la cámara. Revisa permisos del navegador.";
    updateAsrUi();
  }
}

function loopFrame() {
  if (!webcamRunning) {
    return;
  }

  if (!frameInFlight && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    frameInFlight = true;

    createImageBitmap(video)
      .then((bitmap) => {
        mediapipeWorker.postMessage(
          {
            type: "processFrame",
            bitmap,
            timestamp: Date.now()
          },
          [bitmap]
        );
      })
      .catch(() => {
        frameInFlight = false;
      });
  }

  requestAnimationFrame(loopFrame);
}

window.addEventListener("resize", syncRendererSize);
startButton.addEventListener("click", () => enableCameraForGestures());
asrButton.addEventListener("click", toggleAsr);
startButton.disabled = true;
asrButton.disabled = true;

initRenderWorker();
mediapipeWorker.postMessage({ type: "init" });
updateAsrUi();
