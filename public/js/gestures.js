// Control por gestos: la cámara detecta tu mano con MediaPipe Hand Landmarker
// (corre 100 % en tu navegador) y la convierte en cursor, clics y atajos.

import { FilesetResolver, HandLandmarker } from "/vendor/tasks-vision/vision_bundle.mjs";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Índices de los puntos de la mano.
const WRIST = 0, THUMB_TIP = 4, INDEX_MCP = 5, INDEX_TIP = 8, MIDDLE_MCP = 9;
const FINGERS = [ [8, 6], [12, 10], [16, 14], [20, 18] ]; // [punta, articulación media]
const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class GestureController {
  /**
   * @param {object} opts
   * @param {HTMLVideoElement} opts.video
   * @param {HTMLCanvasElement} opts.canvas  vista previa con el esqueleto de la mano
   * @param {(e: {type: string, x?: number, y?: number, dir?: number, gesture?: string}) => void} opts.onEvent
   */
  constructor({ video, canvas, onEvent }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onEvent = onEvent;
    this.smoothing = 0.35; // 0 = sin suavizado, 0.9 = muy suave
    this.running = false;
    this.fps = 0;
    this.handVisible = false;

    this.cursor = { x: innerWidth / 2, y: innerHeight / 2 };
    this.pinching = false;
    this.pose = "none";
    this.poseSince = 0;
    this.poseFired = false;
    this.palmTrail = [];
    this.lastSwipe = 0;
    this.lastVideoTime = -1;
    this.pokeEnabled = true;
    this.pinchEnabled = true;
    this.trail = []; // historial corto para detectar el toque en el aire
    this.lastTap = 0;
  }

  async start() {
    const vision = await FilesetResolver.forVisionTasks("/vendor/tasks-vision/wasm");
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    this.running = true;
    this.#loop();
  }

  stop() {
    this.running = false;
    this.video.srcObject?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
  }

  #loop() {
    if (!this.running) return;
    let frames = 0, last = performance.now();
    const tick = () => {
      if (!this.running) return;
      const now = performance.now();
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        const result = this.landmarker.detectForVideo(this.video, now);
        this.#process(result.landmarks?.[0], now);
        frames++;
      }
      if (now - last >= 1000) {
        this.fps = frames;
        frames = 0;
        last = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  #process(lm, now) {
    this.#draw(lm);
    if (!lm) {
      if (this.handVisible) {
        this.handVisible = false;
        this.onEvent({ type: "hand", visible: false });
        if (this.pinching) this.#endPinch();
      }
      this.#setPose("none", now);
      this.palmTrail = [];
      this.trail = [];
      return;
    }
    if (!this.handVisible) {
      this.handVisible = true;
      this.onEvent({ type: "hand", visible: true });
    }

    const size = dist(lm[WRIST], lm[MIDDLE_MCP]) || 0.1;
    const extended = FINGERS.map(([tip, pip]) => dist(lm[tip], lm[WRIST]) > dist(lm[pip], lm[WRIST]) * 1.1);
    const thumbOut = dist(lm[THUMB_TIP], lm[INDEX_MCP]) > size * 0.6;
    const pinchRatio = dist(lm[THUMB_TIP], lm[INDEX_TIP]) / size;

    // Cursor: punta del índice, en espejo, con un margen para llegar a los bordes.
    const margin = 0.15;
    const nx = (1 - lm[INDEX_TIP].x - margin) / (1 - 2 * margin);
    const ny = (lm[INDEX_TIP].y - margin) / (1 - 2 * margin);
    const tx = Math.min(Math.max(nx, 0), 1) * innerWidth;
    const ty = Math.min(Math.max(ny, 0), 1) * innerHeight;
    const k = 1 - this.smoothing;
    this.cursor.x += (tx - this.cursor.x) * k;
    this.cursor.y += (ty - this.cursor.y) * k;
    this.onEvent({ type: "move", x: this.cursor.x, y: this.cursor.y });

    // Toque en el aire: al empujar el dedo hacia la cámara la mano "crece" de golpe
    // en la imagen. Se usa la posición de antes del empujón para no desviar el toque.
    this.trail.push({ t: now, size, x: this.cursor.x, y: this.cursor.y });
    this.trail = this.trail.filter((p) => now - p.t < 320);
    if (this.pokeEnabled && extended[0] && !this.pinching && now - this.lastTap > 650) {
      const base = this.trail.reduce((a, b) => (b.size < a.size ? b : a), this.trail[0]);
      const grow = size / base.size;
      const tipForward = (lm[INDEX_MCP].z - lm[INDEX_TIP].z) / size; // el índice apunta hacia la cámara
      if (grow > 1.13 || (grow > 1.07 && tipForward > 0.6)) {
        this.lastTap = now;
        this.trail = [];
        this.onEvent({ type: "tap", x: base.x, y: base.y });
      }
    }

    // Pellizco con histéresis para que no parpadee.
    if (!this.pinchEnabled) {
      if (this.pinching) this.#endPinch();
    } else if (!this.pinching && pinchRatio < 0.35) {
      this.pinching = true;
      this.onEvent({ type: "pinch", x: this.cursor.x, y: this.cursor.y });
    } else if (this.pinching && pinchRatio > 0.55) {
      this.#endPinch();
    }

    // Poses sostenidas.
    const count = extended.filter(Boolean).length;
    let pose = "other";
    if (count === 4 && thumbOut) pose = "palm";
    else if (count === 0 && !this.pinching) pose = "fist";
    else if (extended[0] && extended[1] && !extended[2] && !extended[3]) pose = "victory";
    else if (extended[0] && !extended[1] && !extended[2] && !extended[3]) pose = "point";
    this.#setPose(pose, now);

    const held = now - this.poseSince;
    if (!this.poseFired) {
      if (pose === "palm" && held > 1000) this.#fire("palm");
      else if (pose === "fist" && held > 600) this.#fire("fist");
      else if (pose === "victory" && held > 700) this.#fire("victory");
    }

    // Deslizar la palma abierta de lado a lado.
    if (pose === "palm") {
      this.palmTrail.push({ x: 1 - lm[WRIST].x, t: now });
      this.palmTrail = this.palmTrail.filter((p) => now - p.t < 300);
      const first = this.palmTrail[0];
      const dx = (1 - lm[WRIST].x) - first.x;
      if (Math.abs(dx) > 0.22 && now - this.lastSwipe > 700) {
        this.lastSwipe = now;
        this.palmTrail = [];
        this.poseSince = now; // un deslizamiento no cuenta como "palma sostenida"
        this.onEvent({ type: "swipe", dir: dx > 0 ? 1 : -1 });
      }
    } else {
      this.palmTrail = [];
    }
  }

  #endPinch() {
    this.pinching = false;
    this.onEvent({ type: "release", x: this.cursor.x, y: this.cursor.y });
  }

  #setPose(pose, now) {
    if (pose !== this.pose) {
      this.pose = pose;
      this.poseSince = now;
      this.poseFired = false;
      this.onEvent({ type: "pose", gesture: pose });
    }
  }

  #fire(gesture) {
    this.poseFired = true;
    this.onEvent({ type: "gesture", gesture });
  }

  #draw(lm) {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm) return;
    const P = (p) => [(1 - p.x) * canvas.width, p.y * canvas.height];
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0, 229, 255, 0.85)";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    for (const [a, b] of CONNECTIONS) {
      const [x1, y1] = P(lm[a]);
      const [x2, y2] = P(lm[b]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    for (let i = 0; i < lm.length; i++) {
      const [x, y] = P(lm[i]);
      ctx.fillStyle = i === INDEX_TIP || i === THUMB_TIP ? "#ffb300" : "#e0f7ff";
      ctx.beginPath();
      ctx.arc(x, y, i === INDEX_TIP ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}
