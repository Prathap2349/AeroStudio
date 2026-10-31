# AirDraw: Real-Time Hand-Tracking Drawing System

AirDraw is a browser-based computer vision application that enables touchless, real-time drawing and spatial manipulation through a standard webcam. Powered by MediaPipe Tasks Vision (`HandLandmarker`), the system executes entirely on the client side using pure HTML5, CSS3, and modern ECMAScript modules with zero build steps or external bundler dependencies.

---

## 1. Architectural Overview

AirDraw is architectured around a decoupled vision-processing and rendering pipeline:

```
[Webcam Stream (640x480)]
          │
          ▼
[MediaPipe Tasks Vision] ──(GPU / CPU Fallback)──> [21 Normalized 3D Landmarks]
                                                              │
          ┌───────────────────────────────────────────────────┴───────────────────────────────┐
          ▼                                                                                   ▼
[Coordinate Transformation Engine]                                            [Rotation-Invariant Gesture Classifier]
  - Aspect Ratio Compensation                                                   - Joint Distance Ratios
  - Object-Fit Cover Alignment                                                  - Normalized Pinch Hysteresis
  - Mirror Inversion Mapping                                                    - Temporal Debounce Filter (4 frames)
          │                                                                                   │
          ▼                                                                                   ▼
[One Euro (1€) Adaptive Filter]                                                [Application State Machine]
  - Low-Velocity Jitter Elimination                                              - Modes: DRAW, MOVE, ERASE, POINTER
  - High-Velocity Lag Minimization                                               - Multi-Hand Transform Coordinator
          │                                                                                   │
          └───────────────────────────────────┬───────────────────────────────────────────────┘
                                              ▼
                                 [Dual-Layer Canvas Compositor]
                   ┌──────────────────────────┴──────────────────────────┐
                   ▼                                                     ▼
     [Offscreen Static Cache]                              [Active Frame Compositor]
     - Committed Vector Strokes                            - Active Stroke Splines
     - Rendered on State Mutations Only (O(1))             - Custom Mode Cursors
                                                           - Particle Sparkle Effects
                                                           - Radial Progress Indicators
```

---

## 2. Core Capabilities

### 2.1 Computer Vision & Hand Pose Tracking
- **MediaPipe Tasks Vision HandLandmarker**: Replaces legacy MediaPipe wrappers with the latest task-based runtime (`@mediapipe/tasks-vision` 0.10.14) loading the `float16` hand landmark model.
- **Automated GPU-to-CPU Fallback**: Initializes the WebGL GPU delegate first. If hardware allocation or WebGL context creation fails, the engine catches the exception and falls back to CPU execution without interrupting user workflow.
- **Optimized Stream Resolution**: Streams at `640x480` at 30fps to balance spatial accuracy with low inference latency.
- **Adaptive Frame Throttling**: Monitors frame execution time; if system frame rate drops below 24fps, vision detection frequency is dynamically throttled to ensure UI responsiveness remains at 60fps.

### 2.2 Mathematical Pose Stability & Coordinate Alignment
- **Rotation-Invariant Extension Calculations**: Rather than checking Y-axis coordinates, finger extension is computed using 3D Euclidean distance ratios from fingertip to wrist versus PIP/MCP to wrist. This ensures reliable recognition regardless of hand tilt, pronation, or rotation.
- **Palm-Relative Thumb Checking**: Evaluates thumb abduction by measuring Euclidean distance between thumb tip and index MCP relative to hand scale.
- **Normalized Pinch with Hysteresis**: Pinch distance is normalized against hand scale ($\text{dist}(\text{wrist}, \text{middleMCP})$). Pinch activation engages at $\le 0.32$ and holds until $\ge 0.46$, eliminating boundary jitter.
- **One Euro (1€) Dual-Axis Filter**: Employs an adaptive low-pass filter with velocity-dependent cutoff frequency. Eliminates microscopic hand tremors during slow, deliberate drawing while preventing latency during rapid strokes.
- **Exact Crop & Scale Mapping**: Translates raw camera coordinates to screen pixels by matching CSS `object-fit: cover` and horizontal scale mirroring (`scaleX(-1)`), ensuring pixel-level cursor convergence on the user's physical fingertip.
- **Drop-Frame Grace Buffer**: Maintains an active stroke buffer for 200ms following hand detection loss, preventing broken lines caused by isolated dropped frames.

### 2.3 Interaction Mechanics & Gesture Command Set

| Mode / Action | Hand Configuration | Description |
| :--- | :--- | :--- |
| **Draw** | Index finger extended; middle, ring, pinky curled | Renders continuous vector splines in selected brush style |
| **Move** | Thumb and index tips pinched together | Translates selected stroke coordinates across canvas |
| **Eraser** | Closed fist (all fingers curled into palm) | Real-time collision detection; erases intersecting strokes |
| **Pointer Hover** | Index and middle fingers extended; others curled | Directs cursor; hovering over UI controls for 1s triggers click |
| **Undo** | Thumbs up (thumb pointing upward, fingers curled) | Rolls back the most recent canvas action (with cooldown) |
| **Clear Canvas** | Open palm sustained for 2.0 seconds | Clears entire canvas following radial confirmation progress |
| **Two-Hand Transform**| Dual-hand pinch on single stroke | Affine scaling and rotation centered on bounding midpoint |

### 2.4 Hands-Free UI Navigation (Pointer Mode)
- **Temporal Dwell Selection**: In `POINTER` mode, positioning the cursor over buttons, color chips, or toggles initiates a 1000ms accumulator.
- **Visual Progress Ring**: A radial SVG-style progress indicator draws dynamically at the cursor position. When complete, the target control triggers programmatically with synthesized audio confirmation.
- **Proportional Range Slider Control**: Hovering over slider tracks adjusts the value proportionally along the horizontal travel axis.

### 2.5 Multi-Brush Rendering Engine
- **Neon Brush**: High-intensity outer glow with variable Gaussian blur coupled with an inner high-value core line.
- **Calligraphy Brush**: Velocity-sensitive line width modulation ($v = \Delta d / \Delta t$). Fast gestures produce delicate tapered terminals; slow movements produce bold strokes.
- **Rainbow Brush**: Dynamic chromatic cycling along the path trajectory using parameterized HSL color rotation.
- **Spray Brush**: Density-controlled stochastic particle emission within an radial bounding envelope.
- **Dashed Cyber Brush**: Geometric dash-array path rendering with synchronized glow envelopes.

### 2.6 Geometric Shape Fitting & Snapping
When Shape Snapping is enabled, finalized strokes undergo automated polygonal analysis:
- **Linear Collinearity**: Compares Euclidean endpoint distance to total integrated arc length. If $D_{\text{endpoints}} / L_{\text{path}} > 0.90$, the stroke snaps to a clean line segment.
- **Centroid Radial Variance (Circles)**: For closed paths ($D_{\text{endpoints}} / L_{\text{path}} < 0.28$), calculates radial standard deviation relative to mean radius. If coefficient of variation is $< 0.18$, the stroke snaps to a parametric circle.
- **Polygonal Bounding (Rectangles & Triangles)**: Fits bounding perimeter and vertex distribution to snap clean rectangles and triangles.

### 2.7 Canvas Environments
- **Webcam Mirror**: Real-time mirrored camera stream with translucent drawing overlay.
- **Dark Mode**: Cyber black canvas (`#070810`) with webcam reassigned to a low-latency Picture-in-Picture display.
- **Whiteboard Mode**: High-contrast light canvas (`#f5f6fa`).
- **Grid Environment**: Technical blueprint background with coordinate division markings.
- **Chalkboard Environment**: Textured slate green canvas (`#15241b`).

### 2.8 Export & Recording Subsystems
- **Raster Image Export (PNG)**: Produces full-resolution raster outputs with either background inclusion or alpha transparency.
- **Vector Export (SVG)**: Traverses stored vector path arrays and compiles an independent `.svg` XML file with exact stroke styling and dash parameters.
- **Timelapse Video Capture (WebM)**: Taps the canvas stream via `canvas.captureStream(30)` and encodes real-time drawing sessions through `MediaRecorder` using VP9/WebM compression.

### 2.9 State Management, History & Persistence
- **Full History Stack**: Encapsulates all mutations (`ADD_STROKE`, `REMOVE_STROKES`, `MOVE_STROKE`, `TRANSFORM_STROKE`, `SNAP_SHAPE`, `CLEAR_CANVAS`) with forward and reverse delta states for deterministic undo and redo.
- **Storage Persistence**: Debounced synchronization to `localStorage` maintains work session recovery across page refreshes.
- **Drawing Gallery**: Internal catalog system enabling artwork storage, thumbnail generation, session retrieval, and deletion.

### 2.10 Assistive Subsystems
- **Web Speech API**: Integrated voice command engine supporting hands-free activation of actions (`undo`, `redo`, `clear`, `erase`, `draw`, color changes, thickness adjustments).
- **Web Audio API Parametric Synthesizer**: Programmatic audio cues for button clicks, stroke deletions, undos, and geometric snaps without external sound assets.
- **Mouse and Touch Fallback**: Automatic failover enabling complete application interaction via traditional pointer events if camera hardware is unavailable.

---

## 3. Keyboard Shortcuts

| Shortcut | Function |
| :--- | :--- |
| <kbd>Z</kbd> | Undo last action |
| <kbd>Y</kbd> or <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo action |
| <kbd>C</kbd> | Clear canvas |
| <kbd>S</kbd> | Open Export / Save Dialog |
| <kbd>E</kbd> | Toggle between Eraser and Draw tools |
| <kbd>H</kbd> | Toggle control panel collapse |
| <kbd>M</kbd> | Toggle audio synthesis |
| <kbd>?</kbd> | Open gesture reference modal |

---

## 4. Technical Specifications

- **Vision Runtime**: Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision` 0.10.14)
- **Model**: `hand_landmarker.task` (`float16` quantization)
- **Rendering**: Dual-layer HTML5 Canvas (`2D` context, Retina `devicePixelRatio` scaling)
- **Styling**: Vanilla CSS3 (Custom properties, CSS Grid, Flexbox, backdrop filter blur)
- **Fonts**: Space Mono, Orbitron (Google Fonts)
- **Audio Engine**: Web Audio API (`AudioContext`, OscillatorNode, GainNode)
- **Speech Engine**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Video Capture**: MediaStream Recording API (`MediaRecorder`)
- **Build Requirements**: None (Pure ES modules, browser-native execution)

---

## 5. Local Setup & Execution

Because camera permissions require a secure context, the application must be served over `http://localhost` or `https://`.

### Using Python 3:
```bash
python3 -m http.server 8080
```
Navigate to `http://localhost:8080` in Google Chrome or any modern browser.

### Using Node.js:
```bash
npx serve .
```

---

## 6. Deployment to GitHub Pages

The project is structured for immediate deployment on GitHub Pages:
1. Push repository changes to the `main` branch.
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Branch**, select `main` and root directory `/`, then click **Save**.
4. The application will be accessible at `https://<username>.github.io/<repository>/`.

---

## 7. Troubleshooting & Diagnostics

### WebGL / Hardware Acceleration
If the browser indicates hardware acceleration is disabled or drops frame rate:
1. Open Chrome settings: `chrome://settings/system`.
2. Enable **Use graphics acceleration when available**.
3. Relaunch the browser and close extraneous GPU-intensive tabs.
4. *AirDraw automatically transitions to CPU execution if WebGL context creation fails.*

### Camera Permissions
If camera initialization fails:
1. Verify the site is loaded over `https://` or `http://localhost` (browsers disallow camera access on `file://`).
2. Click the camera settings icon in the browser address bar and verify permission is set to **Allow**.
3. If camera access remains unavailable, select **Use Mouse / Touch** to continue using all tools via pointer input.

---

## 8. Author & License

- **Author**: Prathap ([GitHub](https://github.com/Prathap2349))
- **License**: MIT License
