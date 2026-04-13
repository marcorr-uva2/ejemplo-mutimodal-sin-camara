# Interfaz 3D Multimodal sin Vista de Cámara

Ejemplo de interfaz 3D interactiva controlada mediante **gestos de mano** y **comandos de voz**, sin mostrar la imagen de la cámara al usuario. Desarrollado para la asignatura TAIM.

## Descripción

La aplicación muestra una escena 3D con tarjetas interactivas renderizadas con **Three.js**. El usuario puede interactuar con ella de dos formas:

- **Gestos:** La cámara web captura la posición del dedo índice en tiempo real usando **MediaPipe Hands**. Un cursor 3D sigue el movimiento del dedo sobre la pantalla.
- **Voz (ASR):** Mediante la Web Speech API, el usuario puede decir *"click"* o *"clic"* para pulsar el elemento que esté bajo el cursor. Al hacer clic, la app responde con síntesis de voz (TTS).

La imagen de la cámara nunca se muestra en pantalla; solo se usa internamente para el reconocimiento de gestos.

## Tecnologías

| Tecnología | Uso |
|---|---|
| [Three.js](https://threejs.org/) v0.155 | Renderizado 3D |
| [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) | Detección de gestos de mano |
| Web Speech API | Reconocimiento de voz (ASR) y síntesis (TTS) |
| Web Workers | Procesamiento de MediaPipe y renderizado en hilos separados |

## Arquitectura

El proyecto se basa en tres módulos principales comunicados mediante Web Workers:

```
script.js  (hilo principal)
├── mediapipe.worker.cpu.js  → detecta landmarks de la mano
└── render.worker.js         → escena Three.js + lógica de hover/click
```

El hilo principal coordina la cámara, el ASR y la comunicación entre workers mediante `postMessage`.

## Estructura de archivos

```
├── index.html                  # Página principal
├── script.js                   # Lógica principal (cámara, ASR, coordinación)
├── render.worker.js            # Worker de renderizado Three.js
├── mediapipe.worker.js         # Worker de MediaPipe (GPU)
├── mediapipe.worker.cpu.js     # Worker de MediaPipe (CPU)
└── styles.css                  # Estilos de la interfaz
```

## Uso

1. Abre `index.html` en un servidor local (necesario para acceder a la cámara):
   ```bash
   npx serve .
   # o
   python -m http.server 8080
   ```
2. Permite el acceso a la cámara cuando el navegador lo solicite.
3. Mueve el dedo índice frente a la cámara para mover el cursor 3D.
4. Di *"click"* o *"clic"* para interactuar con los elementos de la escena.
5. Usa los botones del HUD para pausar la cámara o el ASR independientemente.

## Requisitos

- Navegador moderno con soporte para **WebGL**, **Web Workers** y **Web Speech API** (Chrome recomendado).
- Cámara web.
- Conexión a internet (Three.js y MediaPipe se cargan desde CDN).

## Autor

Desarrollado en el contexto de la asignatura **TAIM** — Universidad de Valladolid.
