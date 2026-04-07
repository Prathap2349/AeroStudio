// --- DOM Elements ---
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');

const loadingOverlay = document.getElementById('loading');
const gestureHintOverlay = document.getElementById('gesture-hint');

// UI Controls
const colorPalette = document.getElementById('color-palette');
const thicknessInput = document.getElementById('thickness');
const thicknessVal = document.getElementById('thickness-val');
const glowInput = document.getElementById('glow');
const glowVal = document.getElementById('glow-val');

const btnUndo = document.getElementById('btn-undo');
const btnClear = document.getElementById('btn-clear');
const btnDownload = document.getElementById('btn-download');
const btnBgToggle = document.getElementById('btn-bg-toggle');

// --- Global State ---
let strokes = [];
let currentStroke = null;
let currentMode = 'IDLE';

// Settings
const COLORS = [
    '#FF1493', '#00FFFF', '#8A2BE2', '#00FF00', '#FFFF00', '#FF0000', '#FFFFFF', '#FFA500', '#0000FF', '#FF00FF'
];
let activeColor = COLORS[0];
let activeThickness = 6;
let activeGlow = 60;
let isDarkMode = false;

// Move/Grab State
let grabbedStroke = null;
let lastPinchPoint = null;

let indexTip = null;
let handDetected = false;

// --- Initialization ---
function initCanvasSize() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
}
window.addEventListener('resize', initCanvasSize);
initCanvasSize();

// Build Color Palette
COLORS.forEach((color, i) => {
    const btn = document.createElement('div');
    btn.className = 'color-btn' + (i === 0 ? ' active' : '');
    btn.style.backgroundColor = color;
    btn.style.color = color;
    btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeColor = color;
    });
    colorPalette.appendChild(btn);
});

// Setting Listeners
thicknessInput.addEventListener('input', (e) => {
    activeThickness = parseInt(e.target.value);
    thicknessVal.textContent = activeThickness + 'px';
});

glowInput.addEventListener('input', (e) => {
    activeGlow = parseInt(e.target.value);
    glowVal.textContent = activeGlow + '%';
});

// Button Listeners
btnUndo.addEventListener('click', () => {
    if (strokes.length > 0) strokes.pop();
});

btnClear.addEventListener('click', () => {
    strokes = [];
});

btnDownload.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasElement.width;
    tempCanvas.height = canvasElement.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!isDarkMode) {
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(videoElement, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.restore();
    } else {
        tempCtx.fillStyle = '#000000';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    }

    tempCtx.drawImage(canvasElement, 0, 0);

    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
});

btnBgToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    btnBgToggle.querySelector('.btn-label').textContent = isDarkMode ? 'Mirror BG' : 'Dark BG';
});

// --- MediaPipe Hands Logic ---
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({ image: videoElement });
    },
    width: 1280,
    height: 720
});

// Start the Camera
camera.start().then(() => {
    loadingOverlay.classList.add('hidden');

    gestureHintOverlay.style.display = 'flex';
    setTimeout(() => {
        gestureHintOverlay.classList.remove('hidden');
    }, 100);

    setTimeout(() => {
        gestureHintOverlay.classList.add('hidden');
        setTimeout(() => {
            gestureHintOverlay.style.display = 'none';
        }, 500);
    }, 4000);
}).catch(err => {
    console.error("Camera access failed:", err);
    alert("Error: Camera access was denied or is unavailable. Please ensure you are viewing this via http://localhost:8080/ and allow camera permissions in your browser.");
    loadingOverlay.innerHTML = "<p>Camera permission denied.</p>";
});

// --- Gesture Detection Logic ---
function getMirroredPoint(landmark, width, height) {
    return {
        x: (1 - landmark.x) * width,
        y: landmark.y * height
    };
}

function classifyGesture(landmarks, width, height) {
    const thumbTip = landmarks[4];
    const indexTipRaw = landmarks[8];

    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const thumbMcp = landmarks[2];
    const indexMcp = landmarks[5]; const indexPip = landmarks[6];
    const middleMcp = landmarks[9]; const middlePip = landmarks[10];
    const ringMcp = landmarks[13]; const ringPip = landmarks[14];
    const pinkyMcp = landmarks[17]; const pinkyPip = landmarks[18];

    const thumbPx = getMirroredPoint(thumbTip, width, height);
    const indexPx = getMirroredPoint(indexTipRaw, width, height);

    const pinchDistance = Math.hypot(thumbPx.x - indexPx.x, thumbPx.y - indexPx.y);

    const isThumbOpen = thumbTip.y < thumbMcp.y;
    const isIndexOpen = indexTip.y < indexMcp.y;
    const isMiddleOpen = middleTip.y < middleMcp.y;
    const isRingOpen = ringTip.y < ringMcp.y;
    const isPinkyOpen = pinkyTip.y < pinkyMcp.y;

    const isOpenHand = isThumbOpen && isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen;

    const isIndexRaised = indexTip.y < indexPip.y;
    const isOthersCurled = middleTip.y > middlePip.y && ringTip.y > ringPip.y && pinkyTip.y > pinkyPip.y;

    if (pinchDistance < 40) return 'MOVE';
    if (isIndexRaised && isOthersCurled) return 'DRAW';
    if (isOpenHand) return 'IDLE';

    return 'UNKNOWN';
}

function processGestures(results) {
    handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

    if (!handDetected) {
        if (currentStroke) finalizeStroke();
        currentMode = 'IDLE';
        grabbedStroke = null;
        return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const width = canvasElement.width;
    const height = canvasElement.height;

    indexTip = getMirroredPoint(landmarks[8], width, height);
    const rawMode = classifyGesture(landmarks, width, height);

    if (rawMode !== 'UNKNOWN') {
        currentMode = rawMode;
    }

    // --- Handle DRAW ---
    if (currentMode === 'DRAW') {
        if (!currentStroke) {
            currentStroke = {
                color: activeColor,
                thickness: activeThickness,
                glow: activeGlow,
                points: []
            };
        }
        const pts = currentStroke.points;
        if (pts.length === 0 || Math.hypot(pts[pts.length - 1].x - indexTip.x, pts[pts.length - 1].y - indexTip.y) > 3) {
            pts.push({ x: indexTip.x, y: indexTip.y });
        }
    } else {
        if (currentStroke) finalizeStroke();
    }

    // --- Handle MOVE ---
    if (currentMode === 'MOVE') {
        const thumbPx = getMirroredPoint(landmarks[4], width, height);
        const pinchPt = {
            x: (thumbPx.x + indexTip.x) / 2,
            y: (thumbPx.y + indexTip.y) / 2
        };

        if (!grabbedStroke) {
            grabbedStroke = findClosestStroke(pinchPt);
            lastPinchPoint = pinchPt;
        } else {
            const dx = pinchPt.x - lastPinchPoint.x;
            const dy = pinchPt.y - lastPinchPoint.y;
            grabbedStroke.points.forEach(pt => {
                pt.x += dx;
                pt.y += dy;
            });
            lastPinchPoint = pinchPt;
        }
    } else {
        grabbedStroke = null;
    }
}

function finalizeStroke() {
    if (currentStroke && currentStroke.points.length > 1) {
        strokes.push(currentStroke);
    }
    currentStroke = null;
}

function findClosestStroke(point, threshold = 50) {
    let closest = null;
    let minDistance = Infinity;

    strokes.forEach(stroke => {
        stroke.points.forEach(pt => {
            const dist = Math.hypot(pt.x - point.x, pt.y - point.y);
            if (dist < minDistance && dist < threshold) {
                minDistance = dist;
                closest = stroke;
            }
        });
    });

    return closest;
}

function onResults(results) {
    processGestures(results);
}


// --- Rendering Loop ---
function drawSpline(ctx, points, thickness, color, glow) {
    if (points.length === 0) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;

    if (glow > 0) {
        ctx.shadowBlur = (glow / 100) * 30;
        ctx.shadowColor = color;
    } else {
        ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
        ctx.lineTo(points[0].x, points[0].y);
    } else if (points.length === 2) {
        ctx.lineTo(points[1].x, points[1].y);
    } else {
        for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawCursor(ctx) {
    if (!handDetected || !indexTip) return;

    ctx.beginPath();
    ctx.arc(indexTip.x, indexTip.y, parseInt(activeThickness) + 4, 0, Math.PI * 2);

    if (currentMode === 'DRAW') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = activeColor;
    } else if (currentMode === 'MOVE') {
        ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFA500';
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
    }

    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function render() {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    strokes.forEach(stroke => {
        drawSpline(canvasCtx, stroke.points, stroke.thickness, stroke.color, stroke.glow);
    });

    if (currentStroke) {
        drawSpline(canvasCtx, currentStroke.points, currentStroke.thickness, currentStroke.color, currentStroke.glow);
    }

    drawCursor(canvasCtx);
    requestAnimationFrame(render);
}

requestAnimationFrame(render);
