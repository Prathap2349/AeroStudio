/**
 * ============================================================================
 * AIR DRAW - Real-Time Hand Tracking & Air Canvas
 * Pure Vanilla HTML5 / CSS3 / ES Module JavaScript (Zero Build Step)
 * ============================================================================
 * 
 * TABLE OF CONTENTS:
 *  1. CONFIGURATION & GLOBAL STATE
 *  2. DOM ELEMENT REFERENCES
 *  3. AUDIO SYSTEM (Web Audio API Synthesizer)
 *  4. PARTICLE SYSTEM & VISUAL EFFECTS
 *  5. CANVAS SETUP, RETINA DPR & OFFSCREEN CACHING
 *  6. ONE EURO FILTER & POINT RESAMPLING
 *  7. COORDINATE MAPPING (Object-Fit Cover & Mirroring)
 *  8. ROTATION-PROOF GESTURE RECOGNITION
 *  9. GEOMETRIC SHAPE RECOGNITION (Circle, Line, Rect, Triangle)
 * 10. HISTORY SYSTEM (Full Undo / Redo Stack)
 * 11. STROKE STYLES & BRUSH RENDERERS
 * 12. ERASER & TWO-HAND TRANSFORMATIONS
 * 13. MEDIAPIPE TASKS VISION INITIALIZATION (GPU with CPU Fallback)
 * 14. WEBCAM STREAM & ADAPTIVE DETECTION LOOP
 * 15. MOUSE & TOUCH FALLBACK DRAWING
 * 16. FINGER-POINTER HOVER & HANDS-FREE UI SELECTION
 * 17. EXPORT ENGINE (PNG, SVG, TIMELAPSE VIDEO RECORDING)
 * 18. AUTOSAVE & SAVED DRAWINGS GALLERY
 * 19. VOICE RECOGNITION (Web Speech API)
 * 20. KEYBOARD SHORTCUTS & PANEL CONTROLS
 * 21. MAIN ANIMATION & COMPOSITOR LOOP
 * ============================================================================
 */

import { OrbEngine } from './orb-engine.js';
import { OrbUIController } from './orb-ui.js';

// ============================================================================
// 1. CONFIGURATION & GLOBAL STATE
// ============================================================================
const CONFIG = {
    camera: {
        width: 640,
        height: 480,
        fps: 30
    },
    // MediaPipe Tasks Vision CDN Mirrors
    cdn: {
        primary: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
        fallback: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
        wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
        model: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
    },
    // Gesture thresholds (normalized by handScale = dist(wrist, middleMcp))
    pinch: {
        start: 0.32,      // Tight threshold to engage pinch
        release: 0.46,    // Looser threshold to release pinch (hysteresis)
        glowHint: 0.50    // Pre-pinch visual glow threshold
    },
    debounceFrames: 4,    // Frames required to confirm a gesture transition
    handLostGraceMs: 200, // Grace period to prevent line breaks on dropped frames
    eraserRadius: 28,     // Pixel radius of the eraser circle
    minPointDist: 4,      // Minimum pixel distance before recording a new stroke point
    hoverClickTimeMs: 1000 // Time needed to hover-click a button in POINTER mode
};

const COLORS = [
    '#FF007F', '#00FFFF', '#00FF88', '#FFFF00', '#FFA500',
    '#9D00FF', '#0088FF', '#FF3344', '#FFFFFF', '#FF88DD'
];

const state = {
    appMode: 'DRAW',         // 'DRAW' | 'ORB'
    // Canvas & strokes
    strokes: [],             // All committed strokes
    currentStroke: null,     // Stroke currently being drawn by dominant hand
    activeColor: COLORS[0],
    activeThickness: 6,
    activeGlow: 60,
    activeBrush: 'neon',     // 'neon' | 'calligraphy' | 'rainbow' | 'spray' | 'dashed'
    activeBackground: 'mirror', // 'mirror' | 'dark' | 'white' | 'grid' | 'chalk'
    activeTool: 'DRAW',      // 'DRAW' | 'ERASE' | 'MOVE' | 'POINTER'
    currentMode: 'IDLE',     // Current recognized hand pose
    shapeSnapEnabled: false,
    soundEnabled: true,
    voiceEnabled: false,

    // Tracking state
    handDetected: false,
    lastHandSeenTimestamp: 0,
    twoHandTransform: null,  // State for two-hand pinch-to-scale/rotate
    grabbedStroke: null,     // Stroke currently grabbed by single-hand pinch
    lastPinchPoint: null,

    // Gesture Debounce state
    candidateGesture: 'IDLE',
    candidateCount: 0,

    // Thumbs-up Undo cooldown
    lastUndoGestureTime: 0,

    // Open-palm Clear hold state
    openPalmHoldStartTime: null,
    openPalmCenter: null,

    // Finger Pointer hover state
    hoverTarget: null,
    hoverStartTime: 0,
    hoverCooldownUntil: 0,

    // Recording & Timelapse
    mediaRecorder: null,
    recordedChunks: [],
    recordingStartTime: 0,
    recordingTimerInterval: null,

    // Fallback mode
    isMouseDrawing: false,
    mousePoint: null,
    usingFallbackOnly: false
};

// ============================================================================
// 2. DOM ELEMENT REFERENCES
// ============================================================================
const DOM = {
    webcam: document.getElementById('webcam'),
    canvas: document.getElementById('canvas'),
    canvasCtx: document.getElementById('canvas').getContext('2d'),
    bgLayer: document.getElementById('bg-layer'),
    loadingOverlay: document.getElementById('loading'),
    loadingStatus: document.getElementById('loading-status'),
    btnSkipToMouse: document.getElementById('btn-skip-to-mouse'),
    gestureHint: document.getElementById('gesture-hint'),

    // Error & Notification Banner
    errorBanner: document.getElementById('error-banner'),
    bannerTitle: document.getElementById('banner-title'),
    bannerMessage: document.getElementById('banner-message'),
    bannerTips: document.getElementById('banner-tips'),
    bannerFallbackBtn: document.getElementById('banner-fallback-btn'),
    bannerDismissBtn: document.getElementById('banner-dismiss-btn'),
    toastContainer: document.getElementById('toast-container'),

    // Top Bar
    statusBadge: document.getElementById('status-badge'),
    statusDot: document.getElementById('status-dot'),
    statusMode: document.getElementById('status-mode'),
    recIndicator: document.getElementById('rec-indicator'),
    recTimer: document.getElementById('rec-timer'),
    speechBadge: document.getElementById('speech-badge'),
    speechTranscript: document.getElementById('speech-transcript'),
    btnToggleSound: document.getElementById('btn-toggle-sound'),
    soundIcon: document.getElementById('sound-icon'),
    btnOpenTutorial: document.getElementById('btn-open-tutorial'),
    btnTogglePanel: document.getElementById('btn-toggle-panel'),
    panelToggleIcon: document.getElementById('panel-toggle-icon'),

    // UI Panel
    uiPanel: document.getElementById('ui-panel'),
    btnClosePanel: document.getElementById('btn-close-panel'),
    colorPalette: document.getElementById('color-palette'),
    customColorInput: document.getElementById('custom-color'),
    thicknessInput: document.getElementById('thickness'),
    thicknessVal: document.getElementById('thickness-val'),
    thicknessPreview: document.getElementById('thickness-preview'),
    glowInput: document.getElementById('glow'),
    glowVal: document.getElementById('glow-val'),
    toggleShapeSnap: document.getElementById('toggle-shape-snap'),
    toggleVoice: document.getElementById('toggle-voice'),

    // Buttons
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnClear: document.getElementById('btn-clear'),
    btnDownload: document.getElementById('btn-download'),
    btnExportSvg: document.getElementById('btn-export-svg'),
    btnRecordTimelapse: document.getElementById('btn-record-timelapse'),
    recBtnLabel: document.getElementById('rec-btn-label'),
    btnOpenGallery: document.getElementById('btn-open-gallery'),
    btnBgToggle: document.getElementById('btn-bg-toggle'),

    // Modals
    tutorialModal: document.getElementById('tutorial-modal'),
    btnCloseTutorial: document.getElementById('btn-close-tutorial'),
    btnStartDrawing: document.getElementById('btn-start-drawing'),
    galleryModal: document.getElementById('gallery-modal'),
    btnCloseGallery: document.getElementById('btn-close-gallery'),
    galleryGrid: document.getElementById('gallery-grid'),
    btnSaveCurrentToGallery: document.getElementById('btn-save-current-to-gallery'),
    btnClearGallery: document.getElementById('btn-clear-gallery'),
    exportModal: document.getElementById('export-modal'),
    btnCloseExport: document.getElementById('btn-close-export'),
    btnExportPngBg: document.getElementById('btn-export-png-bg'),
    btnExportPngTransparent: document.getElementById('btn-export-png-transparent'),
    btnExportSvgConfirm: document.getElementById('btn-export-svg-confirm')
};

// ============================================================================
// 3. AUDIO SYSTEM (Web Audio API Synthesizer)
// ============================================================================
class SoundEffects {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type = 'sine', duration = 0.12, gainVal = 0.1) {
        if (!state.soundEnabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            // Audio context error non-fatal
        }
    }

    click() {
        this.playTone(750, 'sine', 0.08, 0.12);
    }

    undo() {
        this.playTone(480, 'sine', 0.15, 0.1);
        setTimeout(() => this.playTone(360, 'sine', 0.2, 0.08), 80);
    }

    redo() {
        this.playTone(360, 'sine', 0.15, 0.08);
        setTimeout(() => this.playTone(520, 'sine', 0.2, 0.1), 80);
    }

    clear() {
        this.playTone(280, 'triangle', 0.35, 0.15);
    }

    erase() {
        this.playTone(220, 'sine', 0.06, 0.06);
    }

    shapeSnap() {
        // Bright pleasant harmonic chime
        this.playTone(523.25, 'triangle', 0.25, 0.12); // C5
        setTimeout(() => this.playTone(659.25, 'triangle', 0.25, 0.12), 70); // E5
        setTimeout(() => this.playTone(783.99, 'triangle', 0.3, 0.14), 140); // G5
    }

    pinchGrab() {
        this.playTone(600, 'sine', 0.1, 0.08);
    }
}
const sfx = new SoundEffects();

// ============================================================================
// 4. PARTICLE SYSTEM & VISUAL EFFECTS
// ============================================================================
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, color, count = 2, speed = 1.5) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = (Math.random() * 0.8 + 0.2) * speed;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                alpha: 1.0,
                color,
                size: Math.random() * 3 + 1.5,
                decay: Math.random() * 0.03 + 0.02
            });
        }
        if (this.particles.length > 120) {
            this.particles.splice(0, this.particles.length - 120);
        }
    }

    burst(x, y, color, count = 16) {
        this.emit(x, y, color, count, 4.0);
    }

    updateAndDraw(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}
const particles = new ParticleSystem();

// ============================================================================
// 5. CANVAS SETUP, RETINA DPR & OFFSCREEN CACHING (Requirement 5)
// ============================================================================
// High-performance offscreen layer for static committed strokes
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');
let dpr = window.devicePixelRatio || 1;

function resizeCanvases() {
    dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Physical pixel resolution
    DOM.canvas.width = Math.round(width * dpr);
    DOM.canvas.height = Math.round(height * dpr);
    offscreenCanvas.width = Math.round(width * dpr);
    offscreenCanvas.height = Math.round(height * dpr);

    // CSS display size
    DOM.canvas.style.width = width + 'px';
    DOM.canvas.style.height = height + 'px';

    // Scale context for Retina displays
    DOM.canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Re-render cached strokes onto offscreen canvas
    redrawOffscreenCanvas();
}
window.addEventListener('resize', resizeCanvases);

/**
 * Redraws all committed strokes onto the offscreen canvas.
 * This is ONLY called when strokes change (add, move, erase, undo, redo, clear).
 * Per-frame rendering simply blits this canvas in O(1) time.
 */
function redrawOffscreenCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    offscreenCtx.clearRect(0, 0, width, height);

    for (let i = 0; i < state.strokes.length; i++) {
        renderStroke(offscreenCtx, state.strokes[i]);
    }
}

// ============================================================================
// 6. ONE EURO FILTER & POINT RESAMPLING (Requirement 2)
// ============================================================================
/**
 * 1€ Filter (Casiez et al., 2012)
 * High smoothing at low velocity (eliminates trembling);
 * Near-zero lag at high velocity (responsive fast lines).
 */
class OneEuroFilter {
    constructor({ minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 } = {}) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }

    alpha(dt, cutoff) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    filter(x, t) {
        if (this.tPrev === null) {
            this.xPrev = x;
            this.dxPrev = 0;
            this.tPrev = t;
            return x;
        }

        const dt = Math.max((t - this.tPrev) / 1000, 1e-4);
        this.tPrev = t;

        const dx = (x - this.xPrev) / dt;
        const edx = this.alpha(dt, this.dCutoff) * dx + (1 - this.alpha(dt, this.dCutoff)) * this.dxPrev;
        this.dxPrev = edx;

        const cutoff = this.minCutoff + this.beta * Math.abs(edx);
        const a = this.alpha(dt, cutoff);
        const xFiltered = a * x + (1 - a) * this.xPrev;
        this.xPrev = xFiltered;
        return xFiltered;
    }

    reset() {
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }
}

class PointSmoother2D {
    constructor() {
        this.filterX = new OneEuroFilter();
        this.filterY = new OneEuroFilter();
    }

    filter(point, timestamp) {
        return {
            x: this.filterX.filter(point.x, timestamp),
            y: this.filterY.filter(point.y, timestamp),
            time: timestamp
        };
    }

    reset() {
        this.filterX.reset();
        this.filterY.reset();
    }
}

const handSmoothers = [new PointSmoother2D(), new PointSmoother2D()];

// ============================================================================
// 7. COORDINATE MAPPING (Object-Fit Cover & Mirroring) (Requirement 2)
// ============================================================================
/**
 * Maps normalized [0,1] MediaPipe landmark coordinates to screen pixels,
 * precisely accounting for CSS object-fit: cover and video mirroring (transform: scaleX(-1)).
 */
function mapLandmarkToScreen(landmark, canvasWidth, canvasHeight, videoWidth, videoHeight) {
    const vWidth = videoWidth || CONFIG.camera.width;
    const vHeight = videoHeight || CONFIG.camera.height;

    const videoAspect = vWidth / vHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let renderWidth, renderHeight, offsetX, offsetY;

    if (canvasAspect > videoAspect) {
        // Window is wider than video: cropped top/bottom
        renderWidth = canvasWidth;
        renderHeight = canvasWidth / videoAspect;
        offsetX = 0;
        offsetY = (canvasHeight - renderHeight) / 2;
    } else {
        // Window is taller than video: cropped left/right
        renderHeight = canvasHeight;
        renderWidth = canvasHeight * videoAspect;
        offsetX = (canvasWidth - renderWidth) / 2;
        offsetY = 0;
    }

    // Mirrored X = (1 - x) because the video is mirrored with scaleX(-1)
    const screenX = offsetX + (1 - landmark.x) * renderWidth;
    const screenY = offsetY + landmark.y * renderHeight;

    return { x: screenX, y: screenY };
}

// ============================================================================
// 8. ROTATION-PROOF GESTURE RECOGNITION (Requirement 2 & 3)
// ============================================================================
/**
 * Analyzes hand landmark geometry invariant of hand rotation or tilt.
 * Uses Euclidean distances from fingertip to wrist vs PIP/MCP to wrist.
 * Uses distance from thumb tip to index/pinky MCP (palm) for thumb.
 */
function analyzeHandPose(landmarks, width, height, vWidth, vHeight) {
    // Convert 21 landmarks to mirrored screen coordinates
    const pts = landmarks.map(lm => mapLandmarkToScreen(lm, width, height, vWidth, vHeight));

    const wrist = pts[0];
    const thumbTip = pts[4];
    const thumbMcp = pts[2];
    const indexTip = pts[8];
    const indexPip = pts[6];
    const indexMcp = pts[5];
    const middleTip = pts[12];
    const middlePip = pts[10];
    const middleMcp = pts[9];
    const ringTip = pts[16];
    const ringPip = pts[14];
    const ringMcp = pts[13];
    const pinkyTip = pts[20];
    const pinkyPip = pts[18];
    const pinkyMcp = pts[17];

    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    // Hand scale: Euclidean distance from wrist to middle finger MCP
    const handScale = Math.max(dist(wrist, middleMcp), 20);

    // Rotation-proof extension checks: fingertip distance to wrist vs PIP distance to wrist
    const isIndexExtended = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.15;
    const isMiddleExtended = dist(middleTip, wrist) > dist(middlePip, wrist) * 1.15;
    const isRingExtended = dist(ringTip, wrist) > dist(ringPip, wrist) * 1.15;
    const isPinkyExtended = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.15;

    // Curled checks
    const isIndexCurled = dist(indexTip, wrist) < dist(indexPip, wrist) * 1.05 || dist(indexTip, indexMcp) < dist(indexPip, indexMcp);
    const isMiddleCurled = dist(middleTip, wrist) < dist(middlePip, wrist) * 1.05 || dist(middleTip, middleMcp) < dist(middlePip, middleMcp);
    const isRingCurled = dist(ringTip, wrist) < dist(ringPip, wrist) * 1.05 || dist(ringTip, ringMcp) < dist(ringPip, ringMcp);
    const isPinkyCurled = dist(pinkyTip, wrist) < dist(pinkyPip, wrist) * 1.05 || dist(pinkyTip, pinkyMcp) < dist(pinkyPip, pinkyMcp);

    // Rotation-proof thumb checks: distance from thumb tip to index MCP and palm
    const thumbToIndexMcpDist = dist(thumbTip, indexMcp) / handScale;
    const isThumbExtended = thumbToIndexMcpDist > 0.42;

    // Normalized pinch distance
    const rawPinchDist = dist(thumbTip, indexTip);
    const normalizedPinch = rawPinchDist / handScale;

    // Pinch point (midpoint between thumb tip and index tip)
    const pinchPoint = {
        x: (thumbTip.x + indexTip.x) / 2,
        y: (thumbTip.y + indexTip.y) / 2
    };

    // Palm center (for open hand hold & visual cues)
    const palmCenter = {
        x: (wrist.x + indexMcp.x + pinkyMcp.x) / 3,
        y: (wrist.y + indexMcp.y + pinkyMcp.y) / 3
    };

    return {
        pts,
        wrist,
        indexTip,
        middleTip,
        thumbTip,
        pinchPoint,
        palmCenter,
        handScale,
        normalizedPinch,
        isIndexExtended,
        isMiddleExtended,
        isRingExtended,
        isPinkyExtended,
        isIndexCurled,
        isMiddleCurled,
        isRingCurled,
        isPinkyCurled,
        isThumbExtended
    };
}

/**
 * Classifies raw hand pose using normalized features with hysteresis.
 */
function classifyRawGesture(pose, isCurrentlyPinching) {
    // 1. Pinch Check with Hysteresis
    const pinchThreshold = isCurrentlyPinching ? CONFIG.pinch.release : CONFIG.pinch.start;
    if (pose.normalizedPinch < pinchThreshold) {
        return 'MOVE';
    }

    // 2. Thumbs Up Check (Undo): Thumb extended upward, other 4 fingers curled
    const fingersCurled = pose.isIndexCurled && pose.isMiddleCurled && pose.isRingCurled && pose.isPinkyCurled;
    const thumbUpward = pose.thumbTip.y < pose.wrist.y - pose.handScale * 0.35 && pose.thumbTip.y < pose.pts[5].y;
    if (fingersCurled && pose.isThumbExtended && thumbUpward) {
        return 'THUMBS_UP';
    }

    // 3. Fist Check (Eraser): All fingers curled, thumb folded
    if (fingersCurled && !thumbUpward) {
        return 'ERASE';
    }

    // 4. Pointer Hover Check: Index AND Middle extended, Ring and Pinky curled
    if (pose.isIndexExtended && pose.isMiddleExtended && pose.isRingCurled && pose.isPinkyCurled && pose.normalizedPinch > 0.38) {
        return 'POINTER';
    }

    // 5. Draw Check: Index extended, Middle, Ring, Pinky curled
    if (pose.isIndexExtended && pose.isMiddleCurled && pose.isRingCurled && pose.isPinkyCurled && pose.normalizedPinch > 0.35) {
        return 'DRAW';
    }

    // 6. Open Hand Check (Idle or Clear hold): All 4 fingers extended
    const allFingersOpen = pose.isIndexExtended && pose.isMiddleExtended && pose.isRingExtended && pose.isPinkyExtended;
    if (allFingersOpen) {
        return 'OPEN_HAND';
    }

    // Unrecognized / Transition pose -> PAUSE (stop drawing/moving, do NOT keep previous mode)
    return 'PAUSE';
}

// ============================================================================
// 9. GEOMETRIC SHAPE RECOGNITION (Requirement 4)
// ============================================================================
/**
 * Detects whether a completed stroke matches a geometric shape
 * (Circle, Straight Line, Rectangle, Triangle) and returns snapped points.
 */
function attemptShapeSnap(stroke) {
    const pts = stroke.points;
    if (!pts || pts.length < 10) return null;

    // Total path length
    let pathLength = 0;
    for (let i = 1; i < pts.length; i++) {
        pathLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    if (pathLength < 30) return null;

    const startPt = pts[0];
    const endPt = pts[pts.length - 1];
    const endpointDist = Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y);

    // 1. Straight Line Check: direct endpoint distance close to total path length
    if (endpointDist / pathLength > 0.90) {
        const count = Math.max(12, Math.round(pathLength / 8));
        const snapped = [];
        for (let i = 0; i <= count; i++) {
            const t = i / count;
            snapped.push({
                x: startPt.x + (endPt.x - startPt.x) * t,
                y: startPt.y + (endPt.y - startPt.y) * t,
                time: startPt.time + t * 100
            });
        }
        return { type: 'LINE', points: snapped };
    }

    // 2. Closed Loop Shapes (Circle, Rectangle, Triangle)
    const isClosed = (endpointDist / pathLength < 0.28);
    if (!isClosed) return null;

    // Centroid
    let sumX = 0, sumY = 0;
    pts.forEach(p => { sumX += p.x; sumY += p.y; });
    const cx = sumX / pts.length;
    const cy = sumY / pts.length;

    // Distances from centroid
    const radii = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
    const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
    const variance = radii.reduce((acc, r) => acc + Math.pow(r - meanRadius, 2), 0) / radii.length;
    const stdDev = Math.sqrt(variance);
    const coeffVariation = stdDev / meanRadius;

    // 2a. Circle Snap
    if (coeffVariation < 0.18 && meanRadius > 15) {
        const segments = 48;
        const snapped = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            snapped.push({
                x: cx + Math.cos(angle) * meanRadius,
                y: cy + Math.sin(angle) * meanRadius,
                time: pts[0].time
            });
        }
        return { type: 'CIRCLE', points: snapped };
    }

    // 2b. Rectangle / Box Snap
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const boxWidth = maxX - minX;
    const boxHeight = maxY - minY;
    const boxPerimeter = 2 * (boxWidth + boxHeight);

    if (Math.abs(pathLength - boxPerimeter) / boxPerimeter < 0.24 && boxWidth > 20 && boxHeight > 20) {
        const corners = [
            { x: minX, y: minY },
            { x: maxX, y: minY },
            { x: maxX, y: maxY },
            { x: minX, y: maxY },
            { x: minX, y: minY }
        ];
        const snapped = [];
        for (let i = 0; i < 4; i++) {
            const p1 = corners[i];
            const p2 = corners[i + 1];
            for (let step = 0; step < 8; step++) {
                const t = step / 8;
                snapped.push({
                    x: p1.x + (p2.x - p1.x) * t,
                    y: p1.y + (p2.y - p1.y) * t,
                    time: pts[0].time
                });
            }
        }
        snapped.push({ ...corners[4], time: pts[0].time });
        return { type: 'RECTANGLE', points: snapped };
    }

    return null;
}

// ============================================================================
// 10. HISTORY SYSTEM (Full Undo / Redo Stack) (Requirement 4)
// ============================================================================
const history = {
    stack: [],
    index: -1,

    push(action) {
        // Discard forward history
        this.stack.splice(this.index + 1);
        this.stack.push(action);
        this.index++;
        updateUndoRedoUI();
        debouncedAutosave();
    },

    undo() {
        if (this.index < 0) return;
        const action = this.stack[this.index];
        this.index--;

        switch (action.type) {
            case 'ADD_STROKE': {
                const idx = state.strokes.indexOf(action.stroke);
                if (idx !== -1) state.strokes.splice(idx, 1);
                break;
            }
            case 'REMOVE_STROKES': {
                action.removed.forEach(item => {
                    state.strokes.splice(item.index, 0, item.stroke);
                });
                break;
            }
            case 'MOVE_STROKE':
            case 'TRANSFORM_STROKE':
            case 'SNAP_SHAPE': {
                action.stroke.points = action.oldPoints.map(p => ({ ...p }));
                break;
            }
            case 'CLEAR_CANVAS': {
                state.strokes = action.strokes.map(s => ({
                    ...s,
                    points: s.points.map(p => ({ ...p }))
                }));
                break;
            }
        }

        sfx.undo();
        showToast('↩️ Undone');
        redrawOffscreenCanvas();
        updateUndoRedoUI();
        debouncedAutosave();
    },

    redo() {
        if (this.index >= this.stack.length - 1) return;
        this.index++;
        const action = this.stack[this.index];

        switch (action.type) {
            case 'ADD_STROKE': {
                state.strokes.push(action.stroke);
                break;
            }
            case 'REMOVE_STROKES': {
                action.removed.forEach(item => {
                    const idx = state.strokes.indexOf(item.stroke);
                    if (idx !== -1) state.strokes.splice(idx, 1);
                });
                break;
            }
            case 'MOVE_STROKE':
            case 'TRANSFORM_STROKE':
            case 'SNAP_SHAPE': {
                action.stroke.points = action.newPoints.map(p => ({ ...p }));
                break;
            }
            case 'CLEAR_CANVAS': {
                state.strokes = [];
                break;
            }
        }

        sfx.redo();
        showToast('↪️ Redone');
        redrawOffscreenCanvas();
        updateUndoRedoUI();
        debouncedAutosave();
    }
};

function updateUndoRedoUI() {
    DOM.btnUndo.disabled = (history.index < 0);
    DOM.btnUndo.style.opacity = (history.index < 0) ? '0.4' : '1';
    DOM.btnRedo.disabled = (history.index >= history.stack.length - 1);
    DOM.btnRedo.style.opacity = (history.index >= history.stack.length - 1) ? '0.4' : '1';
}

// ============================================================================
// 11. STROKE STYLES & BRUSH RENDERERS (Requirement 4)
// ============================================================================
/**
 * Renders an individual stroke based on its style and points.
 */
function renderStroke(ctx, stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (stroke.brush) {
        case 'calligraphy':
            renderCalligraphyBrush(ctx, stroke);
            break;
        case 'rainbow':
            renderRainbowBrush(ctx, stroke);
            break;
        case 'spray':
            renderSprayBrush(ctx, stroke);
            break;
        case 'dashed':
            renderDashedBrush(ctx, stroke);
            break;
        case 'neon':
        default:
            renderNeonBrush(ctx, stroke);
            break;
    }

    ctx.restore();
}

// 1. Neon Brush (Glow outer halo + bright inner core)
function renderNeonBrush(ctx, stroke) {
    const pts = stroke.points;
    const glow = stroke.glow || 0;

    // Outer glow
    if (glow > 0) {
        ctx.shadowBlur = (glow / 100) * 28;
        ctx.shadowColor = stroke.color;
    } else {
        ctx.shadowBlur = 0;
    }

    ctx.lineWidth = stroke.thickness;
    ctx.strokeStyle = stroke.color;
    drawSplinePath(ctx, pts);
    ctx.stroke();

    // Inner bright core
    if (stroke.thickness > 5) {
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(2, stroke.thickness * 0.35);
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.7;
        drawSplinePath(ctx, pts);
        ctx.stroke();
    }
}

// 2. Calligraphy Brush (Velocity-sensitive stroke width)
function renderCalligraphyBrush(ctx, stroke) {
    const pts = stroke.points;
    if (pts.length < 2) return;

    if (stroke.glow > 0) {
        ctx.shadowBlur = (stroke.glow / 100) * 15;
        ctx.shadowColor = stroke.color;
    }
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;

    for (let i = 1; i < pts.length; i++) {
        const p1 = pts[i - 1];
        const p2 = pts[i];
        const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const dt = Math.max((p2.time - p1.time) || 16, 5);
        const speed = d / dt;

        // Fast movement = thin elegant taper; slow movement = bold stroke
        const speedRatio = Math.min(1.0, speed / 3.0);
        const width = Math.max(2, stroke.thickness * (1.6 - speedRatio * 0.9));

        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
}

// 3. Rainbow Brush (Smooth chromatic shift along the stroke)
function renderRainbowBrush(ctx, stroke) {
    const pts = stroke.points;
    if (pts.length < 2) return;

    ctx.lineWidth = stroke.thickness;
    if (stroke.glow > 0) {
        ctx.shadowBlur = (stroke.glow / 100) * 18;
    }

    for (let i = 1; i < pts.length; i++) {
        const hue = (i * 7) % 360;
        const color = `hsl(${hue}, 100%, 55%)`;
        ctx.strokeStyle = color;
        if (stroke.glow > 0) ctx.shadowColor = color;

        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
    }
}

// 4. Spray Paint Brush (Graffiti particle mist)
function renderSprayBrush(ctx, stroke) {
    const pts = stroke.points;
    ctx.fillStyle = stroke.color;
    ctx.globalAlpha = 0.55;
    const radius = stroke.thickness * 2.2;

    for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        const density = Math.min(16, Math.max(5, Math.round(stroke.thickness)));
        for (let j = 0; j < density; j++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius;
            const px = pt.x + Math.cos(angle) * r;
            const py = pt.y + Math.sin(angle) * r;
            ctx.beginPath();
            ctx.arc(px, py, Math.random() * 1.5 + 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 5. Dashed Cyber Brush
function renderDashedBrush(ctx, stroke) {
    const pts = stroke.points;
    if (stroke.glow > 0) {
        ctx.shadowBlur = (stroke.glow / 100) * 20;
        ctx.shadowColor = stroke.color;
    }
    ctx.lineWidth = stroke.thickness;
    ctx.strokeStyle = stroke.color;
    ctx.setLineDash([stroke.thickness * 2.5, stroke.thickness * 1.5]);
    drawSplinePath(ctx, pts);
    ctx.stroke();
}

/**
 * Connects points using smooth quadratic bezier midpoints.
 */
function drawSplinePath(ctx, pts) {
    if (pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 1) {
        ctx.lineTo(pts[0].x, pts[0].y);
    } else if (pts.length === 2) {
        ctx.lineTo(pts[1].x, pts[1].y);
    } else {
        for (let i = 1; i < pts.length - 1; i++) {
            const xc = (pts[i].x + pts[i + 1].x) / 2;
            const yc = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
}

// ============================================================================
// 12. ERASER & TWO-HAND TRANSFORMATIONS (Requirement 4)
// ============================================================================
/**
 * Real eraser: removes only the strokes touched by the eraser circle.
 */
function eraseAtPoint(x, y, radius = CONFIG.eraserRadius) {
    const touchedStrokes = [];

    for (let i = state.strokes.length - 1; i >= 0; i--) {
        const stroke = state.strokes[i];
        let hit = false;

        for (let j = 0; j < stroke.points.length; j++) {
            const pt = stroke.points[j];
            if (Math.hypot(pt.x - x, pt.y - y) <= radius + stroke.thickness / 2) {
                hit = true;
                break;
            }
        }

        if (hit) {
            touchedStrokes.push({ stroke, index: i });
            state.strokes.splice(i, 1);
            particles.burst(x, y, stroke.color, 12);
        }
    }

    if (touchedStrokes.length > 0) {
        history.push({
            type: 'REMOVE_STROKES',
            removed: touchedStrokes
        });
        sfx.erase();
        redrawOffscreenCanvas();
    }
}

/**
 * Finds the closest stroke to a target point within a threshold distance.
 */
function findClosestStroke(point, threshold = 65) {
    let closest = null;
    let minDistance = Infinity;

    state.strokes.forEach(stroke => {
        stroke.points.forEach(pt => {
            const d = Math.hypot(pt.x - point.x, pt.y - point.y);
            if (d < minDistance && d < threshold) {
                minDistance = d;
                closest = stroke;
            }
        });
    });

    return closest;
}

/**
 * Two-hand pinch manipulation: scale and rotate a grabbed stroke.
 */
function handleTwoHandTransform(hand1Pinch, hand2Pinch) {
    const currentDist = Math.hypot(hand1Pinch.x - hand2Pinch.x, hand1Pinch.y - hand2Pinch.y);
    const currentAngle = Math.atan2(hand2Pinch.y - hand1Pinch.y, hand2Pinch.x - hand1Pinch.x);
    const currentCenter = {
        x: (hand1Pinch.x + hand2Pinch.x) / 2,
        y: (hand1Pinch.y + hand2Pinch.y) / 2
    };

    if (!state.twoHandTransform) {
        // Find stroke near either pinch or center
        const targetStroke = state.grabbedStroke || findClosestStroke(currentCenter, 100);
        if (!targetStroke) return;

        state.grabbedStroke = targetStroke;
        state.twoHandTransform = {
            stroke: targetStroke,
            startDist: Math.max(currentDist, 20),
            startAngle: currentAngle,
            startCenter: currentCenter,
            originalPoints: targetStroke.points.map(p => ({ ...p }))
        };
        sfx.pinchGrab();
        return;
    }

    const t = state.twoHandTransform;
    const scale = currentDist / t.startDist;
    const deltaAngle = currentAngle - t.startAngle;
    const deltaX = currentCenter.x - t.startCenter.x;
    const deltaY = currentCenter.y - t.startCenter.y;

    // Apply transformation relative to original center
    const origPoints = t.originalPoints;
    let sumX = 0, sumY = 0;
    origPoints.forEach(p => { sumX += p.x; sumY += p.y; });
    const cx0 = sumX / origPoints.length;
    const cy0 = sumY / origPoints.length;

    t.stroke.points = origPoints.map(p => {
        // 1. Center
        let rx = (p.x - cx0) * scale;
        let ry = (p.y - cy0) * scale;

        // 2. Rotate
        const rotX = rx * Math.cos(deltaAngle) - ry * Math.sin(deltaAngle);
        const rotY = rx * Math.sin(deltaAngle) + ry * Math.cos(deltaAngle);

        // 3. Translate
        return {
            x: rotX + cx0 + deltaX,
            y: rotY + cy0 + deltaY,
            time: p.time
        };
    });

    redrawOffscreenCanvas();
}

function finalizeTwoHandTransform() {
    if (state.twoHandTransform) {
        history.push({
            type: 'TRANSFORM_STROKE',
            stroke: state.twoHandTransform.stroke,
            oldPoints: state.twoHandTransform.originalPoints,
            newPoints: state.twoHandTransform.stroke.points.map(p => ({ ...p }))
        });
        state.twoHandTransform = null;
        state.grabbedStroke = null;
    }
}

// ============================================================================
// 13. MEDIAPIPE TASKS VISION INITIALIZATION (Requirement 1)
// ============================================================================
let handLandmarker = null;
let lastVideoTime = -1;

async function loadVisionLibrary() {
    try {
        const mod = await import(CONFIG.cdn.primary);
        return { HandLandmarker: mod.HandLandmarker, FilesetResolver: mod.FilesetResolver };
    } catch (e1) {
        console.warn('Primary Tasks Vision CDN failed, retrying fallback CDN...', e1);
        try {
            const mod = await import(CONFIG.cdn.fallback);
            return { HandLandmarker: mod.HandLandmarker, FilesetResolver: mod.FilesetResolver };
        } catch (e2) {
            console.error('All Tasks Vision CDNs failed:', e2);
            throw new Error('Could not load HandLandmarker library from CDN.');
        }
    }
}

async function initHandLandmarker() {
    updateLoading('Loading MediaPipe HandLandmarker modules...');

    let visionLibs;
    try {
        visionLibs = await loadVisionLibrary();
    } catch (err) {
        handleInitError('LIBRARY_LOAD_ERROR', err);
        return;
    }

    const { HandLandmarker, FilesetResolver } = visionLibs;

    updateLoading('Downloading vision wasm files & hand model...');
    let vision;
    try {
        vision = await FilesetResolver.forVisionTasks(CONFIG.cdn.wasm);
    } catch (err) {
        handleInitError('WASM_LOAD_ERROR', err);
        return;
    }

    // Try GPU delegate first; if throws, automatically retry with CPU delegate
    updateLoading('Initializing HandLandmarker (attempting GPU acceleration)...');
    try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: CONFIG.cdn.model,
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.6,
            minTrackingConfidence: 0.6
        });
        console.log('✅ HandLandmarker initialized successfully with GPU delegate.');
    } catch (gpuErr) {
        console.warn('GPU delegate failed, retrying with CPU delegate...', gpuErr);
        showBanner({
            type: 'warning',
            title: 'GPU Unavailable (CPU Mode Active)',
            message: 'WebGL GPU acceleration could not be initialized. The app is running with CPU mode.',
            tips: 'For smoother 60fps tracking, open <strong>chrome://settings/system</strong>, enable <strong>"Use graphics acceleration when available"</strong>, and close other heavy tabs.'
        });

        updateLoading('Retrying HandLandmarker with CPU delegate...');
        try {
            handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: CONFIG.cdn.model,
                    delegate: 'CPU'
                },
                runningMode: 'VIDEO',
                numHands: 2,
                minHandDetectionConfidence: 0.6,
                minHandPresenceConfidence: 0.6,
                minTrackingConfidence: 0.6
            });
            console.log('✅ HandLandmarker initialized successfully with CPU delegate.');
        } catch (cpuErr) {
            handleInitError('LANDMARKER_CREATE_ERROR', cpuErr);
            return;
        }
    }

    // Initialize Webcam
    await startCamera();
}

function updateLoading(msg) {
    if (DOM.loadingStatus) DOM.loadingStatus.textContent = msg;
}

// ============================================================================
// 14. WEBCAM STREAM & ADAPTIVE DETECTION LOOP (Requirement 1 & 5)
// ============================================================================
async function startCamera() {
    updateLoading('Requesting 640x480 webcam stream...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        handleInitError('CAMERA_UNSUPPORTED', new Error('MediaDevices API not supported in this browser.'));
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: CONFIG.camera.width },
                height: { ideal: CONFIG.camera.height },
                facingMode: 'user'
            },
            audio: false
        });

        DOM.webcam.srcObject = stream;
        await DOM.webcam.play();

        DOM.loadingOverlay.classList.add('hidden');
        showGestureHintToast();
        checkTutorialFirstRun();

        // Start detection loop
        requestAnimationFrame(predictWebcamLoop);
    } catch (camErr) {
        handleInitError('CAMERA_PERMISSION_ERROR', camErr);
    }
}

// ============================================================================
// MODE SWITCHER (DRAW MODE <-> ORB 3D MODE)
// ============================================================================
window.setAppMode = function(mode) {
    if (state.appMode === mode) return;
    state.appMode = mode;

    if (mode === 'ORB') {
        if (state.currentStroke) finalizeActiveStroke();
        DOM.uiPanel.classList.add('hidden');
        DOM.canvas.style.pointerEvents = 'none';

        if (window.OrbUI) window.OrbUI.setMode('ORB');
        if (window.OrbEngine) window.OrbEngine.start();
        showToast('🔮 Orb Mode Active: Two-Hand 3D Holographic Interaction');
    } else {
        if (window.OrbEngine) window.OrbEngine.stop();
        if (window.OrbUI) window.OrbUI.setMode('DRAW');

        DOM.uiPanel.classList.remove('hidden');
        DOM.canvas.style.pointerEvents = 'auto';
        showToast('✏️ Draw Mode Active');
        redrawOffscreenCanvas();
    }
};

// Adaptive detection throttling if FPS drops
let lastFrameTime = performance.now();
let fpsCounter = 60;
let frameSkipToggle = false;

function predictWebcamLoop() {
    const now = performance.now();
    const dt = now - lastFrameTime;
    lastFrameTime = now;
    if (dt > 0) {
        fpsCounter = 0.9 * fpsCounter + 0.1 * (1000 / dt);
    }

    // If frame rate drops below 24fps, skip detection on alternate frames
    if (fpsCounter < 24) {
        frameSkipToggle = !frameSkipToggle;
    } else {
        frameSkipToggle = false;
    }

    if (!frameSkipToggle && handLandmarker && DOM.webcam.readyState >= 2) {
        if (DOM.webcam.currentTime !== lastVideoTime) {
            lastVideoTime = DOM.webcam.currentTime;
            try {
                const results = handLandmarker.detectForVideo(DOM.webcam, now);
                if (state.appMode === 'ORB') {
                    if (window.OrbEngine && window.OrbEngine.isActive) {
                        window.OrbEngine.handleLandmarks(results, now);
                    }
                } else {
                    processLandmarkResults(results, now);
                }
            } catch (err) {
                console.error('Detection frame error:', err);
            }
        }
    }

    requestAnimationFrame(predictWebcamLoop);
}

/**
 * Processes landmark results for 1 or 2 hands.
 */
function processLandmarkResults(results, timestamp) {
    const handsCount = results.landmarks ? results.landmarks.length : 0;

    if (handsCount === 0) {
        // Hand Lost Grace Period (200ms)
        if (state.handDetected && (timestamp - state.lastHandSeenTimestamp < CONFIG.handLostGraceMs)) {
            // Keep active stroke open during short drop
            return;
        }

        if (state.currentStroke) finalizeActiveStroke();
        if (state.twoHandTransform) finalizeTwoHandTransform();

        state.handDetected = false;
        state.currentMode = 'NO_HAND';
        state.grabbedStroke = null;
        updateStatusBadge('NO HAND DETECTED', 'mode-nohand');
        return;
    }

    state.handDetected = true;
    state.lastHandSeenTimestamp = timestamp;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const vWidth = DOM.webcam.videoWidth || CONFIG.camera.width;
    const vHeight = DOM.webcam.videoHeight || CONFIG.camera.height;

    // Hand 1 Pose
    const pose1 = analyzeHandPose(results.landmarks[0], width, height, vWidth, vHeight);
    const smoothedTip1 = handSmoothers[0].filter(pose1.indexTip, timestamp);

    // Hand 2 Pose (if present)
    let pose2 = null;
    let smoothedTip2 = null;
    if (handsCount > 1) {
        pose2 = analyzeHandPose(results.landmarks[1], width, height, vWidth, vHeight);
        smoothedTip2 = handSmoothers[1].filter(pose2.indexTip, timestamp);
    }

    // --- TWO-HAND PINCH MODE (Requirement 4) ---
    if (pose2) {
        const p1Pinching = pose1.normalizedPinch < CONFIG.pinch.release;
        const p2Pinching = pose2.normalizedPinch < CONFIG.pinch.release;

        if (p1Pinching && p2Pinching) {
            handleTwoHandTransform(pose1.pinchPoint, pose2.pinchPoint);
            updateStatusBadge('TWO-HAND SCALE / ROTATE', 'mode-move');
            return;
        } else {
            finalizeTwoHandTransform();
        }
    }

    // --- SINGLE HAND GESTURE RESOLVER ---
    const isPinching = (state.currentMode === 'MOVE');
    const rawGesture = classifyRawGesture(pose1, isPinching);

    // Debounce gesture transitions
    if (rawGesture === state.candidateGesture) {
        state.candidateCount++;
    } else {
        state.candidateGesture = rawGesture;
        state.candidateCount = 1;
    }

    let activeGesture = state.currentMode;
    if (rawGesture === 'PAUSE') {
        activeGesture = 'PAUSE'; // Immediate stop on unrecognized/transition pose
    } else if (state.candidateCount >= CONFIG.debounceFrames) {
        activeGesture = rawGesture;
    }

    // --- EXECUTE GESTURE ACTION ---
    switch (activeGesture) {
        case 'DRAW': {
            state.currentMode = 'DRAW';
            updateStatusBadge('DRAWING', 'mode-draw');
            handleDrawMode(smoothedTip1);
            resetPointerHover();
            break;
        }

        case 'MOVE': {
            state.currentMode = 'MOVE';
            updateStatusBadge('MOVE STROKE', 'mode-move');
            handleMoveMode(pose1.pinchPoint);
            resetPointerHover();
            break;
        }

        case 'ERASE': {
            state.currentMode = 'ERASE';
            updateStatusBadge('ERASER', 'mode-erase');
            handleEraseMode(smoothedTip1);
            resetPointerHover();
            break;
        }

        case 'POINTER': {
            state.currentMode = 'POINTER';
            updateStatusBadge('POINTER HOVER', 'mode-pointer');
            if (state.currentStroke) finalizeActiveStroke();
            handlePointerHoverMode(smoothedTip1, timestamp);
            break;
        }

        case 'THUMBS_UP': {
            state.currentMode = 'IDLE';
            updateStatusBadge('THUMBS UP (UNDO)', 'mode-idle');
            if (state.currentStroke) finalizeActiveStroke();
            resetPointerHover();

            // Thumbs up triggers undo once per gesture with 1.2s cooldown
            if (timestamp - state.lastUndoGestureTime > 1200) {
                state.lastUndoGestureTime = timestamp;
                history.undo();
            }
            break;
        }

        case 'OPEN_HAND': {
            state.currentMode = 'IDLE';
            if (state.currentStroke) finalizeActiveStroke();
            resetPointerHover();

            // Open palm held for 2s = Clear Canvas
            if (!state.openPalmHoldStartTime) {
                state.openPalmHoldStartTime = timestamp;
                state.openPalmCenter = pose1.palmCenter;
            } else {
                const holdDuration = timestamp - state.openPalmHoldStartTime;
                const progress = Math.min(1.0, holdDuration / 2000);
                updateStatusBadge(`CLEARING CANVAS (${Math.round(progress * 100)}%)`, 'mode-erase');

                if (progress >= 1.0) {
                    clearCanvasAction();
                    state.openPalmHoldStartTime = null;
                }
            }
            break;
        }

        case 'PAUSE':
        default: {
            state.currentMode = 'PAUSE';
            updateStatusBadge('PAUSED', 'mode-idle');
            if (state.currentStroke) finalizeActiveStroke();
            state.openPalmHoldStartTime = null;
            resetPointerHover();
            break;
        }
    }

    // Save smoothed cursor position for rendering
    state.activeCursorPoint = smoothedTip1;
    state.activePose = pose1;
}

// Gesture Handlers
function handleDrawMode(point) {
    state.openPalmHoldStartTime = null;
    state.grabbedStroke = null;

    if (!state.currentStroke) {
        state.currentStroke = {
            id: Date.now() + Math.random(),
            color: state.activeColor,
            thickness: state.activeThickness,
            glow: state.activeGlow,
            brush: state.activeBrush,
            points: []
        };
    }

    const pts = state.currentStroke.points;
    const lastPt = pts[pts.length - 1];

    if (!lastPt || Math.hypot(lastPt.x - point.x, lastPt.y - point.y) >= CONFIG.minPointDist) {
        pts.push({ x: point.x, y: point.y, time: point.time });
        particles.emit(point.x, point.y, state.activeColor, 1);
    }
}

function handleMoveMode(pinchPoint) {
    state.openPalmHoldStartTime = null;
    if (state.currentStroke) finalizeActiveStroke();

    if (!state.grabbedStroke) {
        state.grabbedStroke = findClosestStroke(pinchPoint);
        state.lastPinchPoint = pinchPoint;
        if (state.grabbedStroke) sfx.pinchGrab();
    } else {
        const dx = pinchPoint.x - state.lastPinchPoint.x;
        const dy = pinchPoint.y - state.lastPinchPoint.y;

        state.grabbedStroke.points.forEach(pt => {
            pt.x += dx;
            pt.y += dy;
        });

        state.lastPinchPoint = pinchPoint;
        redrawOffscreenCanvas();
    }
}

function handleEraseMode(point) {
    state.openPalmHoldStartTime = null;
    if (state.currentStroke) finalizeActiveStroke();
    eraseAtPoint(point.x, point.y, CONFIG.eraserRadius);
}

function finalizeActiveStroke() {
    if (!state.currentStroke) return;

    if (state.currentStroke.points.length > 2) {
        let finalStroke = state.currentStroke;

        // Shape Snapping
        if (state.shapeSnapEnabled) {
            const snapped = attemptShapeSnap(finalStroke);
            if (snapped) {
                const origPoints = finalStroke.points.map(p => ({ ...p }));
                finalStroke.points = snapped.points;
                sfx.shapeSnap();
                showToast(`✨ Snapped to ${snapped.type}`, 'toast-snap');

                history.push({
                    type: 'SNAP_SHAPE',
                    stroke: finalStroke,
                    oldPoints: origPoints,
                    newPoints: snapped.points.map(p => ({ ...p })),
                    shapeType: snapped.type
                });
            } else {
                history.push({ type: 'ADD_STROKE', stroke: finalStroke });
            }
        } else {
            history.push({ type: 'ADD_STROKE', stroke: finalStroke });
        }

        state.strokes.push(finalStroke);
        redrawOffscreenCanvas();
    }

    state.currentStroke = null;
}

// ============================================================================
// 15. MOUSE & TOUCH FALLBACK DRAWING (Requirement 1)
// ============================================================================
function initMouseTouchFallback() {
    const getPos = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    const onPointerDown = (e) => {
        // If clicking on UI panel or modals, don't draw
        if (e.target.closest('#ui-panel, .modal-backdrop, .error-banner, .top-bar')) return;

        state.isMouseDrawing = true;
        const pos = getPos(e);
        state.mousePoint = pos;

        if (state.activeTool === 'ERASE') {
            eraseAtPoint(pos.x, pos.y, CONFIG.eraserRadius);
        } else if (state.activeTool === 'MOVE') {
            state.grabbedStroke = findClosestStroke(pos);
            state.lastPinchPoint = pos;
        } else {
            state.currentStroke = {
                id: Date.now() + Math.random(),
                color: state.activeColor,
                thickness: state.activeThickness,
                glow: state.activeGlow,
                brush: state.activeBrush,
                points: [{ x: pos.x, y: pos.y, time: performance.now() }]
            };
        }
    };

    const onPointerMove = (e) => {
        const pos = getPos(e);
        state.mousePoint = pos;

        if (!state.isMouseDrawing) return;

        if (state.activeTool === 'ERASE') {
            eraseAtPoint(pos.x, pos.y, CONFIG.eraserRadius);
        } else if (state.activeTool === 'MOVE') {
            if (state.grabbedStroke && state.lastPinchPoint) {
                const dx = pos.x - state.lastPinchPoint.x;
                const dy = pos.y - state.lastPinchPoint.y;
                state.grabbedStroke.points.forEach(pt => { pt.x += dx; pt.y += dy; });
                state.lastPinchPoint = pos;
                redrawOffscreenCanvas();
            }
        } else if (state.currentStroke) {
            const pts = state.currentStroke.points;
            const last = pts[pts.length - 1];
            if (Math.hypot(last.x - pos.x, last.y - pos.y) >= CONFIG.minPointDist) {
                pts.push({ x: pos.x, y: pos.y, time: performance.now() });
                particles.emit(pos.x, pos.y, state.activeColor, 1);
            }
        }
    };

    const onPointerUp = () => {
        if (!state.isMouseDrawing) return;
        state.isMouseDrawing = false;
        if (state.currentStroke) finalizeActiveStroke();
        state.grabbedStroke = null;
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
}

// ============================================================================
// 16. FINGER-POINTER HOVER & HANDS-FREE UI SELECTION (Requirement 3)
// ============================================================================
/**
 * Enables complete hands-free navigation.
 * Hovering index+middle finger over any UI button, color, or slider for 1s activates it.
 */
function handlePointerHoverMode(point, timestamp) {
    if (timestamp < state.hoverCooldownUntil) return;

    // Identify topmost element under pointer
    const elem = document.elementFromPoint(point.x, point.y);
    if (!elem) {
        resetPointerHover();
        return;
    }

    const interactiveTarget = elem.closest(
        'button, .color-btn, .brush-chip, .bg-btn, input[type="range"], .switch, .tool-btn'
    );

    if (!interactiveTarget) {
        resetPointerHover();
        return;
    }

    if (interactiveTarget === state.hoverTarget) {
        const hoverTime = timestamp - state.hoverStartTime;
        const progress = Math.min(1.0, hoverTime / CONFIG.hoverClickTimeMs);
        state.hoverProgress = progress;

        // Visual hover highlight
        interactiveTarget.style.outline = '2px solid var(--cyan)';

        if (progress >= 1.0) {
            // Trigger activation
            sfx.click();
            interactiveTarget.style.outline = '';

            if (interactiveTarget.tagName === 'INPUT' && interactiveTarget.type === 'range') {
                // Adjust slider relative to pointer X position
                const rect = interactiveTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (point.x - rect.left) / rect.width));
                const min = parseFloat(interactiveTarget.min);
                const max = parseFloat(interactiveTarget.max);
                interactiveTarget.value = Math.round(min + ratio * (max - min));
                interactiveTarget.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                interactiveTarget.click();
            }

            state.hoverCooldownUntil = timestamp + 700;
            resetPointerHover();
        }
    } else {
        if (state.hoverTarget) state.hoverTarget.style.outline = '';
        state.hoverTarget = interactiveTarget;
        state.hoverStartTime = timestamp;
        state.hoverProgress = 0;
    }
}

function resetPointerHover() {
    if (state.hoverTarget) {
        state.hoverTarget.style.outline = '';
    }
    state.hoverTarget = null;
    state.hoverStartTime = 0;
    state.hoverProgress = 0;
}

// ============================================================================
// 17. EXPORT ENGINE (PNG, SVG, TIMELAPSE VIDEO RECORDING) (Requirement 4)
// ============================================================================
function exportPNG(includeBackground = true, transparent = false) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = DOM.canvas.width;
    tempCanvas.height = DOM.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = window.innerWidth;
    const h = window.innerHeight;

    if (!transparent) {
        if (state.activeBackground === 'mirror' && includeBackground) {
            // Draw mirrored webcam snapshot
            tempCtx.save();
            tempCtx.scale(-1, 1);
            tempCtx.drawImage(DOM.webcam, -w, 0, w, h);
            tempCtx.restore();
        } else if (state.activeBackground === 'dark') {
            tempCtx.fillStyle = '#070810';
            tempCtx.fillRect(0, 0, w, h);
        } else if (state.activeBackground === 'white') {
            tempCtx.fillStyle = '#f5f6fa';
            tempCtx.fillRect(0, 0, w, h);
        } else if (state.activeBackground === 'grid') {
            tempCtx.fillStyle = '#070b14';
            tempCtx.fillRect(0, 0, w, h);
            tempCtx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
            tempCtx.lineWidth = 1;
            for (let x = 0; x < w; x += 32) {
                tempCtx.beginPath(); tempCtx.moveTo(x, 0); tempCtx.lineTo(x, h); tempCtx.stroke();
            }
            for (let y = 0; y < h; y += 32) {
                tempCtx.beginPath(); tempCtx.moveTo(0, y); tempCtx.lineTo(w, y); tempCtx.stroke();
            }
        } else if (state.activeBackground === 'chalk') {
            tempCtx.fillStyle = '#15241b';
            tempCtx.fillRect(0, 0, w, h);
        }
    }

    // Draw all strokes
    state.strokes.forEach(s => renderStroke(tempCtx, s));

    const link = document.createElement('a');
    link.download = `airdraw_${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    showToast('💾 Artwork exported as PNG!');
}

function exportSVG() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
    svg += `  <rect width="100%" height="100%" fill="#070810" />\n`;

    state.strokes.forEach(s => {
        const pts = s.points;
        if (!pts || pts.length < 2) return;

        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
            d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
        }

        const dash = (s.brush === 'dashed') ? `stroke-dasharray="${s.thickness * 2.5},${s.thickness * 1.5}"` : '';
        svg += `  <path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.thickness}" stroke-linecap="round" stroke-linejoin="round" ${dash} />\n`;
    });

    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `airdraw_${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    showToast('📐 Artwork exported as SVG vector!');
}

function toggleTimelapseRecording() {
    if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
        // Stop recording
        state.mediaRecorder.stop();
        clearInterval(state.recordingTimerInterval);
        DOM.recIndicator.classList.add('hidden');
        DOM.btnRecordTimelapse.classList.remove('recording');
        DOM.recBtnLabel.textContent = 'Record Timelapse';
        showToast('⏹️ Recording stopped, saving video...');
    } else {
        // Start recording
        try {
            const stream = DOM.canvas.captureStream(30);
            state.recordedChunks = [];

            const options = { mimeType: 'video/webm;codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm';
            }

            state.mediaRecorder = new MediaRecorder(stream, options);

            state.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) state.recordedChunks.push(e.data);
            };

            state.mediaRecorder.onstop = () => {
                const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.download = `airdraw_timelapse_${Date.now()}.webm`;
                a.href = url;
                a.click();
                URL.revokeObjectURL(url);
            };

            state.mediaRecorder.start();
            state.recordingStartTime = Date.now();
            DOM.recIndicator.classList.remove('hidden');
            DOM.btnRecordTimelapse.classList.add('recording');
            DOM.recBtnLabel.textContent = 'Stop Recording';

            state.recordingTimerInterval = setInterval(() => {
                const elapsedSec = Math.floor((Date.now() - state.recordingStartTime) / 1000);
                const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
                const s = String(elapsedSec % 60).padStart(2, '0');
                DOM.recTimer.textContent = `REC ${m}:${s}`;
            }, 1000);

            showToast('🎥 Recording drawing timelapse...');
        } catch (err) {
            console.error('MediaRecorder error:', err);
            showToast('⚠️ Could not start screen recording on this browser.');
        }
    }
}

// ============================================================================
// 18. AUTOSAVE & SAVED DRAWINGS GALLERY (Requirement 4)
// ============================================================================
let autosaveTimeout = null;
function debouncedAutosave() {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => {
        try {
            localStorage.setItem('airdraw_autosave', JSON.stringify(state.strokes));
        } catch (e) {
            // Storage quota full or disabled
        }
    }, 800);
}

function restoreAutosave() {
    try {
        const saved = localStorage.getItem('airdraw_autosave');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                state.strokes = parsed;
                redrawOffscreenCanvas();
                showToast('🎨 Restored your previous drawing.');
            }
        }
    } catch (e) {
        // Parse error ignored
    }
}

function saveCurrentToGallery() {
    if (state.strokes.length === 0) {
        showToast('Canvas is empty. Draw something first!');
        return;
    }

    try {
        const gallery = JSON.parse(localStorage.getItem('airdraw_gallery') || '[]');
        const thumb = DOM.canvas.toDataURL('image/jpeg', 0.5);

        gallery.unshift({
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            strokes: state.strokes,
            thumb
        });

        localStorage.setItem('airdraw_gallery', JSON.stringify(gallery));
        showToast('🖼️ Drawing saved to your gallery!');
        renderGalleryGrid();
    } catch (e) {
        showToast('⚠️ Storage limit reached. Try clearing old drawings.');
    }
}

function renderGalleryGrid() {
    DOM.galleryGrid.innerHTML = '';
    const gallery = JSON.parse(localStorage.getItem('airdraw_gallery') || '[]');

    if (gallery.length === 0) {
        DOM.galleryGrid.innerHTML = '<p style="color:var(--text-muted);font-size:12px;grid-column:1/-1;text-align:center;padding:20px;">No saved drawings yet.</p>';
        return;
    }

    gallery.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'gallery-card';

        card.innerHTML = `
            <img class="gallery-thumb" src="${item.thumb}" alt="Drawing">
            <div class="gallery-card-footer">
                <span>${item.date}</span>
                <div class="gallery-card-actions">
                    <button data-action="load" title="Load Artwork">📂</button>
                    <button data-action="delete" title="Delete Artwork">🗑️</button>
                </div>
            </div>
        `;

        card.querySelector('[data-action="load"]').addEventListener('click', () => {
            state.strokes = item.strokes.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) }));
            history.push({ type: 'CLEAR_CANVAS', strokes: [] }); // Reset history checkpoint
            redrawOffscreenCanvas();
            DOM.galleryModal.classList.add('hidden');
            showToast('📂 Drawing loaded!');
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', () => {
            gallery.splice(index, 1);
            localStorage.setItem('airdraw_gallery', JSON.stringify(gallery));
            renderGalleryGrid();
            showToast('🗑️ Drawing removed.');
        });

        DOM.galleryGrid.appendChild(card);
    });
}

// ============================================================================
// 19. VOICE RECOGNITION (Web Speech API) (Requirement 4)
// ============================================================================
let speechRecognizer = null;

function initVoiceCommands() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('⚠️ Voice commands not supported in this browser.');
        DOM.toggleVoice.checked = false;
        return;
    }

    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = false;
    speechRecognizer.lang = 'en-US';

    speechRecognizer.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        handleVoiceCommand(transcript);
    };

    speechRecognizer.onerror = (e) => {
        console.warn('Speech recognition notice:', e.error);
    };

    speechRecognizer.onend = () => {
        if (state.voiceEnabled) {
            try { speechRecognizer.start(); } catch (e) { }
        }
    };
}

function handleVoiceCommand(text) {
    DOM.speechBadge.classList.remove('hidden');
    DOM.speechTranscript.textContent = `"${text}"`;
    setTimeout(() => DOM.speechBadge.classList.add('hidden'), 2500);

    if (text.includes('undo')) {
        history.undo();
    } else if (text.includes('redo')) {
        history.redo();
    } else if (text.includes('clear')) {
        clearCanvasAction();
    } else if (text.includes('erase') || text.includes('eraser')) {
        selectTool('ERASE');
    } else if (text.includes('draw')) {
        selectTool('DRAW');
    } else if (text.includes('bigger') || text.includes('thicker')) {
        state.activeThickness = Math.min(40, state.activeThickness + 6);
        DOM.thicknessInput.value = state.activeThickness;
        DOM.thicknessVal.textContent = state.activeThickness + 'px';
        updateThicknessPreview();
    } else if (text.includes('smaller') || text.includes('thinner')) {
        state.activeThickness = Math.max(2, state.activeThickness - 6);
        DOM.thicknessInput.value = state.activeThickness;
        DOM.thicknessVal.textContent = state.activeThickness + 'px';
        updateThicknessPreview();
    } else if (text.includes('red')) {
        selectColor('#FF3344');
    } else if (text.includes('blue')) {
        selectColor('#0088FF');
    } else if (text.includes('cyan')) {
        selectColor('#00FFFF');
    } else if (text.includes('green')) {
        selectColor('#00FF88');
    } else if (text.includes('yellow')) {
        selectColor('#FFFF00');
    } else if (text.includes('orange')) {
        selectColor('#FFA500');
    } else if (text.includes('purple')) {
        selectColor('#9D00FF');
    } else if (text.includes('pink')) {
        selectColor('#FF007F');
    } else if (text.includes('white')) {
        selectColor('#FFFFFF');
    } else if (text.includes('save') || text.includes('download')) {
        exportPNG();
    }
}

// ============================================================================
// 20. KEYBOARD SHORTCUTS & PANEL CONTROLS (Requirement 3)
// ============================================================================
function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Ignore typing in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toUpperCase();

        if (e.ctrlKey || e.metaKey) {
            if (key === 'Z') {
                e.preventDefault();
                if (e.shiftKey) history.redo();
                else history.undo();
            } else if (key === 'Y') {
                e.preventDefault();
                history.redo();
            }
            return;
        }

        switch (key) {
            case 'Z':
                if (e.shiftKey) history.redo();
                else history.undo();
                break;
            case 'Y':
                history.redo();
                break;
            case 'C':
                clearCanvasAction();
                break;
            case 'S':
                DOM.exportModal.classList.remove('hidden');
                break;
            case 'E':
                selectTool(state.activeTool === 'ERASE' ? 'DRAW' : 'ERASE');
                break;
            case 'H':
                togglePanel();
                break;
            case 'M':
                toggleSound();
                break;
            case '?':
                DOM.tutorialModal.classList.remove('hidden');
                break;
        }
    });
}

function clearCanvasAction() {
    if (state.strokes.length === 0) return;
    history.push({
        type: 'CLEAR_CANVAS',
        strokes: state.strokes.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) }))
    });
    state.strokes = [];
    sfx.clear();
    redrawOffscreenCanvas();
    showToast('🗑️ Canvas cleared');
}

function selectTool(toolName) {
    state.activeTool = toolName;
    document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === toolName);
    });
    sfx.click();
}

function selectColor(colorHex) {
    state.activeColor = colorHex;
    document.querySelectorAll('.color-btn').forEach(b => {
        b.classList.toggle('active', b.style.backgroundColor.toLowerCase() === colorHex.toLowerCase());
    });
    updateThicknessPreview();
}

function togglePanel() {
    DOM.uiPanel.classList.toggle('collapsed');
}

function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    showToast(state.soundEnabled ? '🔊 Sound unmuted' : '🔇 Sound muted');
}

function updateThicknessPreview() {
    DOM.thicknessPreview.style.width = Math.min(28, state.activeThickness * 1.2) + 'px';
    DOM.thicknessPreview.style.height = Math.min(28, state.activeThickness * 1.2) + 'px';
    DOM.thicknessPreview.style.backgroundColor = state.activeColor;
    DOM.thicknessPreview.style.boxShadow = `0 0 10px ${state.activeColor}`;
}

// Status badge helper
function updateStatusBadge(modeText, modeClass) {
    DOM.statusMode.textContent = modeText;
    DOM.statusBadge.className = 'status-badge ' + modeClass;
}

// Toast helper
function showToast(message, extraClass = '') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + extraClass;
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2800);
}

// Gesture hint toast on start
function showGestureHintToast() {
    DOM.gestureHint.style.display = 'flex';
    setTimeout(() => DOM.gestureHint.classList.remove('hidden'), 50);
    setTimeout(() => {
        DOM.gestureHint.classList.add('hidden');
        setTimeout(() => DOM.gestureHint.style.display = 'none', 500);
    }, 4500);
}

// First-run tutorial check
function checkTutorialFirstRun() {
    if (!localStorage.getItem('airdraw_tutorial_seen')) {
        DOM.tutorialModal.classList.remove('hidden');
    }
}

// Friendly Error Banner (Replaces alert() calls)
function showBanner({ type = 'error', title, message, tips = '' }) {
    DOM.errorBanner.className = `error-banner ${type}`;
    DOM.bannerTitle.textContent = title;
    DOM.bannerMessage.textContent = message;
    DOM.bannerTips.innerHTML = tips;
    DOM.errorBanner.classList.remove('hidden');
    DOM.loadingOverlay.classList.add('hidden');
}

function handleInitError(code, err) {
    console.error('Initialization Error:', code, err);

    let title = 'Setup Notice';
    let message = 'Hand tracking could not start.';
    let tips = '';

    if (code === 'CAMERA_PERMISSION_ERROR') {
        title = 'Camera Access Denied or Unavailable';
        message = 'Air Draw requires camera access for hand tracking in the air.';
        tips = 'Click the <strong>camera icon in your Chrome address bar</strong> and select <strong>"Always allow"</strong>, then refresh. You can also draw right now using Mouse or Touch below!';
    } else if (code === 'LANDMARKER_CREATE_ERROR' || code === 'WASM_LOAD_ERROR') {
        title = 'WebGL / Hardware Acceleration Issue';
        message = 'Chrome failed to create WebGL context when initializing vision models.';
        tips = 'Go to <strong>chrome://settings/system</strong>, enable <strong>"Use graphics acceleration when available"</strong>, close other GPU-heavy tabs, and restart Chrome.';
    } else {
        title = 'Network or CDN Connection Notice';
        message = 'Could not load MediaPipe vision files from CDN.';
        tips = 'Check your internet connection. In the meantime, full mouse and touch drawing are enabled!';
    }

    showBanner({ type: 'warning', title, message, tips });
    state.usingFallbackOnly = true;
    updateStatusBadge('MOUSE / TOUCH MODE', 'mode-draw');
}

// ============================================================================
// 21. MAIN ANIMATION & COMPOSITOR LOOP
// ============================================================================
/**
 * Main 60fps render loop:
 *  1. Clears display canvas
 *  2. Blits the cached offscreen canvas containing finished strokes (O(1))
 *  3. Draws currently active stroke (if drawing)
 *  4. Draws particles and visual effects
 *  5. Draws custom interactive cursors and hover indicators
 */
function render() {
    const ctx = DOM.canvasCtx;
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 1. Clear screen
    ctx.clearRect(0, 0, w, h);

    // 2. Fast blit of all completed strokes from offscreen cache (Retina scaled)
    ctx.drawImage(offscreenCanvas, 0, 0, w, h);

    // 3. Draw active stroke in progress
    if (state.currentStroke) {
        renderStroke(ctx, state.currentStroke);
    }

    // 4. Update & draw trailing particles
    particles.updateAndDraw(ctx);

    // 5. Draw Cursors & Interaction affordances
    drawInteractiveCursor(ctx);

    requestAnimationFrame(render);
}

function drawInteractiveCursor(ctx) {
    let cursorPos = null;

    if (state.handDetected && state.activeCursorPoint) {
        cursorPos = state.activeCursorPoint;
    } else if (state.isMouseDrawing && state.mousePoint) {
        cursorPos = state.mousePoint;
    }

    if (!cursorPos) return;

    ctx.save();
    const x = cursorPos.x;
    const y = cursorPos.y;
    const baseRadius = parseInt(state.activeThickness) + 4;

    // Pre-pinch visual halo hint
    if (state.activePose && state.activePose.normalizedPinch < CONFIG.pinch.glowHint && state.currentMode !== 'MOVE') {
        ctx.beginPath();
        ctx.arc(x, y, baseRadius + 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 170, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffaa00';
        ctx.stroke();
    }

    // Mode-specific cursor look
    if (state.currentMode === 'DRAW' || state.activeTool === 'DRAW') {
        // Glowing dot + ring in active color
        ctx.beginPath();
        ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.strokeStyle = state.activeColor;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = state.activeColor;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = state.activeColor;
        ctx.fill();
    } else if (state.currentMode === 'MOVE' || state.activeTool === 'MOVE') {
        // Amber grab ring with crosshair
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 170, 0, 0.25)';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#ffaa00';
        ctx.fill();
        ctx.stroke();

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
        ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (state.currentMode === 'ERASE' || state.activeTool === 'ERASE') {
        // Red dashed eraser ring
        ctx.beginPath();
        ctx.arc(x, y, CONFIG.eraserRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 50, 70, 0.15)';
        ctx.strokeStyle = '#ff3344';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3344';
        ctx.fill();
        ctx.stroke();
    } else if (state.currentMode === 'POINTER') {
        // Cyan hover ring
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fill();
        ctx.stroke();

        // Circular hover-click progress ring
        if (state.hoverProgress > 0) {
            ctx.beginPath();
            ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + state.hoverProgress * Math.PI * 2);
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00ff88';
            ctx.stroke();
        }
    } else {
        // Translucent subtle idle cursor
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
    }

    // Open Palm hold countdown ring (Clear canvas confirm)
    if (state.openPalmHoldStartTime && state.openPalmCenter) {
        const holdDuration = performance.now() - state.openPalmHoldStartTime;
        const progress = Math.min(1.0, holdDuration / 2000);
        ctx.beginPath();
        ctx.arc(state.openPalmCenter.x, state.openPalmCenter.y, 42, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
        ctx.strokeStyle = '#ff3344';
        ctx.lineWidth = 5;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff3344';
        ctx.stroke();
    }

    ctx.restore();
}

// ============================================================================
// INITIALIZATION BOOTSTRAP
// ============================================================================
function initUIEventListeners() {
    // Color Palette
    COLORS.forEach((color, i) => {
        const btn = document.createElement('div');
        btn.className = 'color-btn' + (i === 0 ? ' active' : '');
        btn.style.backgroundColor = color;
        btn.style.color = color;
        btn.addEventListener('click', () => {
            selectColor(color);
            sfx.click();
        });
        DOM.colorPalette.appendChild(btn);
    });

    DOM.customColorInput.addEventListener('input', (e) => {
        selectColor(e.target.value);
    });

    // Thickness Slider
    DOM.thicknessInput.addEventListener('input', (e) => {
        state.activeThickness = parseInt(e.target.value);
        DOM.thicknessVal.textContent = state.activeThickness + 'px';
        updateThicknessPreview();
    });

    // Glow Slider
    DOM.glowInput.addEventListener('input', (e) => {
        state.activeGlow = parseInt(e.target.value);
        DOM.glowVal.textContent = state.activeGlow + '%';
    });

    // Tool Buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectTool(btn.dataset.tool);
        });
    });

    // Brush Chips
    document.querySelectorAll('.brush-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.brush-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeBrush = btn.dataset.brush;
            sfx.click();
            showToast(`Brush: ${btn.textContent}`);
        });
    });

    // Background Selector
    document.querySelectorAll('.bg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const bg = btn.dataset.bg;
            state.activeBackground = bg;
            document.body.className = `bg-${bg}`;
            sfx.click();
            showToast(`Background: ${btn.textContent}`);
        });
    });

    // Backward compatible bg toggle button
    DOM.btnBgToggle.addEventListener('click', () => {
        const isMirror = state.activeBackground === 'mirror';
        const newBg = isMirror ? 'dark' : 'mirror';
        state.activeBackground = newBg;
        document.body.className = `bg-${newBg}`;
        DOM.btnBgToggle.querySelector('.btn-label').textContent = isMirror ? 'Mirror BG' : 'Dark BG';
    });

    // Shape Snapping Switch
    DOM.toggleShapeSnap.addEventListener('change', (e) => {
        state.shapeSnapEnabled = e.target.checked;
        sfx.click();
        showToast(state.shapeSnapEnabled ? '✨ Shape Snap Enabled' : 'Shape Snap Disabled');
    });

    // Voice Commands Switch
    DOM.toggleVoice.addEventListener('change', (e) => {
        state.voiceEnabled = e.target.checked;
        if (state.voiceEnabled) {
            initVoiceCommands();
            try {
                speechRecognizer.start();
                showToast('🎙️ Voice Commands Activated ("Undo", "Clear", "Red", etc.)');
            } catch (err) { }
        } else {
            if (speechRecognizer) speechRecognizer.stop();
            showToast('🎙️ Voice Commands Deactivated');
        }
    });

    // History Buttons
    DOM.btnUndo.addEventListener('click', () => history.undo());
    DOM.btnRedo.addEventListener('click', () => history.redo());
    DOM.btnClear.addEventListener('click', () => clearCanvasAction());

    // Export Buttons
    DOM.btnDownload.addEventListener('click', () => DOM.exportModal.classList.remove('hidden'));
    DOM.btnExportSvg.addEventListener('click', () => exportSVG());
    DOM.btnRecordTimelapse.addEventListener('click', () => toggleTimelapseRecording());

    DOM.btnExportPngBg.addEventListener('click', () => {
        exportPNG(true, false);
        DOM.exportModal.classList.add('hidden');
    });
    DOM.btnExportPngTransparent.addEventListener('click', () => {
        exportPNG(false, true);
        DOM.exportModal.classList.add('hidden');
    });
    DOM.btnExportSvgConfirm.addEventListener('click', () => {
        exportSVG();
        DOM.exportModal.classList.add('hidden');
    });

    // Gallery Buttons
    DOM.btnOpenGallery.addEventListener('click', () => {
        renderGalleryGrid();
        DOM.galleryModal.classList.remove('hidden');
    });
    DOM.btnSaveCurrentToGallery.addEventListener('click', () => saveCurrentToGallery());
    DOM.btnClearGallery.addEventListener('click', () => {
        localStorage.removeItem('airdraw_gallery');
        renderGalleryGrid();
        showToast('🗑️ Gallery cleared');
    });

    // Top Bar & Modal Toggles
    DOM.btnTogglePanel.addEventListener('click', togglePanel);
    DOM.btnClosePanel.addEventListener('click', togglePanel);
    DOM.btnToggleSound.addEventListener('click', toggleSound);

    DOM.btnOpenTutorial.addEventListener('click', () => DOM.tutorialModal.classList.remove('hidden'));
    DOM.btnCloseTutorial.addEventListener('click', () => DOM.tutorialModal.classList.add('hidden'));
    DOM.btnStartDrawing.addEventListener('click', () => {
        localStorage.setItem('airdraw_tutorial_seen', 'true');
        DOM.tutorialModal.classList.add('hidden');
    });

    DOM.btnCloseGallery.addEventListener('click', () => DOM.galleryModal.classList.add('hidden'));
    DOM.btnCloseExport.addEventListener('click', () => DOM.exportModal.classList.add('hidden'));

    DOM.bannerDismissBtn.addEventListener('click', () => DOM.errorBanner.classList.add('hidden'));
    DOM.bannerFallbackBtn.addEventListener('click', () => {
        DOM.errorBanner.classList.add('hidden');
        showToast('🖱️ Mouse / Touch drawing ready!');
    });

    DOM.btnSkipToMouse.addEventListener('click', () => {
        DOM.loadingOverlay.classList.add('hidden');
        showToast('🖱️ Mouse / Touch drawing ready!');
        updateStatusBadge('MOUSE / TOUCH MODE', 'mode-draw');
    });

    updateThicknessPreview();
    updateUndoRedoUI();
}

// Master Boot Sequence
async function startApp() {
    resizeCanvases();
    initUIEventListeners();
    initKeyboardShortcuts();
    initMouseTouchFallback();
    restoreAutosave();

    // Start 60fps render loop immediately so mouse/touch works without waiting for camera
    requestAnimationFrame(render);

    // Boot vision & camera
    await initHandLandmarker();

    // Initialize Orb Mode 3D Experience (Additive Subsystem)
    try {
        window.OrbEngine = new OrbEngine();
        window.OrbUI = new OrbUIController(window.OrbEngine);
        console.log('✅ Orb 3D Experience initialized successfully.');
    } catch (orbErr) {
        console.warn('Orb Mode initialization deferred:', orbErr);
    }
}

// Launch
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
