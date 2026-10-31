# AirDraw: Real-Time Hand-Tracking Drawing & 3D Orb System

AirDraw is a browser-based computer vision system that unifies two distinct creative experiences in a single client-side application:

1. **Draw Mode**: High-precision 2D air canvas powered by Google MediaPipe Tasks Vision (`HandLandmarker`), enabling touchless vector drawing, multiple brush dynamics, geometric shape recognition, and spatial stroke manipulation.
2. **Orb Mode**: A two-hand 3D holographic energy environment built with Three.js, enabling spatial manipulation of floating energy spheres, dynamic tension fields, particle systems, and five distinct cosmological environments.

The entire system executes client-side using pure HTML5, CSS3, Three.js, and modern ECMAScript modules with zero build steps or bundler dependencies.

---

## 1. Architectural Overview

AirDraw shares a single webcam stream and MediaPipe `HandLandmarker` instance across both operational modes:

```
                                [Webcam Stream (640x480)]
                                            │
                                            ▼
                           [MediaPipe Tasks Vision Runtime]
                             (GPU / CPU Adaptive Fallback)
                                            │
                                            ▼
                           [Multi-Hand Landmarks & Handedness]
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
         [Draw Mode Pipeline]                             [Orb Mode 3D Pipeline]
  - 1€ (One Euro) Adaptive Smoothing              - Three.js WebGL Scene & Camera
  - Coordinate Transformation (Cover/Mirror)      - OrbGestureController (9 Two-Hand Gestures)
  - Stroke Vector Spline Generator                - OrbPhysics (Elastic Collisions, Throwing, Merge/Split)
  - Real Eraser Collision Engine                  - OrbEffects (Bloom Post-Processing, Particles, Shockwaves)
  - Geometric Shape Snapping Classifier           - OrbModes (Planet, Galaxy, Atom, Morph, Fidget)
  - Dual-Layer Offscreen Canvas Cache             - Holographic Hand Skeleton Overlay
  - Raster (PNG) & Vector (SVG) Exporters         - Composite 3D Screenshot & MediaRecorder
```

---

## 2. Creative Experiences

### 2.1 Draw Mode: 2D Hand Air Canvas
- **Index-Finger Sketching**: Low-latency vector stroke drawing with dynamic glow and velocity-sensitive taper.
- **Pinch-to-Move**: Grabs and translates committed vector paths across screen space with normalized hand-scale hysteresis.
- **Fist Eraser**: Geometric intersection engine that selectively removes only the strokes touched by the eraser sphere.
- **Pointer Dwell Selection**: Index + Middle fingers form a hover pointer; dwelling over any UI control for 1000ms triggers action with a circular progress countdown.
- **Thumbs-Up Undo**: Immediate rollback of the previous stroke or manipulation action.
- **Open-Palm 2-Second Clear**: Sustaining an open palm triggers a radial confirmation timer before resetting canvas strokes.
- **5 Brush Styles**: Neon Glow, Calligraphy (velocity-sensitive width), Rainbow (chromatic sweep), Spray (stochastic particle mist), and Dashed.
- **Geometric Shape Recognition**: Automatically evaluates finished strokes and snaps rough drawings into lines, circles, rectangles, and triangles.
- **5 Background Environments**: Mirrored Webcam, Dark Cyber, Whiteboard, Technical Grid, and Slate Chalkboard.

---

### 2.2 Orb Mode: Two-Hand 3D Holographic System
A fully 3D interactive environment rendered above the live webcam background via Three.js.

#### Core Energy Spheres
- **Cyan Sphere**: High-frequency plasma energy core with dynamic outer rim glow and trailing particle emissions.
- **Magenta Sphere**: Rotating internal geometric patterns with reactive surface displacement and harmonic light.
- **Golden Sphere**: Deep amber core with soft volumetric particle halo and high luminous intensity.
- **Dynamic Tension Lines**: Luminous energy lines connecting the three spheres that stretch, modulate color, and glow brighter under physical tension.

#### Two-Hand Gesture Command Set

| Gesture | Hand Pose | 3D Engine Action |
| :--- | :--- | :--- |
| **Two-Hand Zoom** | Both palms facing camera | Adjusts camera Z-depth with inertia; hands apart zooms in, hands together zooms out |
| **Scene Rotation** | Both hands steering horizontally | Rotates the 3D scene azimuthally and elevationally with momentum |
| **Grab and Move** | Single-hand pinch (Thumb + Index) | Raycasts into 3D space to select nearest sphere and translate it in 3D |
| **Throw Sphere** | Pinch release while in motion | Imparts hand velocity to sphere with damping and boundary bouncing |
| **Spawn Sphere** | Both open palms held together | Spawns a new energy sphere between hands; moving hands apart expands its scale |
| **Dismiss Spheres**| Two-hand forward push toward camera | Disperses active orbs into shockwave particles with energy dissipation |
| **Expand / Shrink** | Spread / curl fingers on grabbing hand | Dynamically modulates sphere scale between 0.5x and 2.0x |
| **Merge & Split** | Bring two spheres together / pull apart | Fuses spheres into high-energy composite orb; pulling apart splits back to two |
| **Reset Scene** | Both fists held together for 0.4s | Smoothly animates camera, rotation, and spheres back to default coordinates |

#### 5 Submode 3D Environments
1. **Classic Orbs**: Three interconnected floating energy spheres with tension lines and collision dynamics.
2. **Planet Mode**: Miniature solar system with a central luminous Sun, elliptical orbital paths, and orbiting celestial bodies (Mercury, Earth, Mars, Jupiter, Saturn with ring system).
3. **Galaxy Mode**: Spiral galaxy simulation consisting of 8,000 star particles (`THREE.Points`) following logarithmic spiral branches with dense galactic core and dust clouds.
4. **Atom Mode**: Scientific atomic model featuring a central nucleus cluster surrounded by three tilted elliptical electron tracks with fast-orbiting electron particles.
5. **Shape Morph Mode**: Parametric geometry that smoothly interpolates particle vertex positions between Sphere, Cube, Torus, and Pyramid without mesh replacement.
6. **Fidget Mode**: Calming, zen-inspired space with soft pastel floating spheres, gentle physics, and minimal distraction.

---

## 3. Visual Effects & Post-Processing

- **UnrealBloomPass**: Multi-stage HDR bloom for neon energy glow, with configurable threshold, strength, and radius.
- **Three Configurable Quality Tiers**:
  - **High**: UnrealBloomPass enabled (strength: 1.35), full device pixel ratio (up to 2.0x), 700 ambient particles.
  - **Balanced**: Standard bloom (strength: 0.85), DPR capped at 1.5x, 450 ambient particles.
  - **Performance**: Bloom disabled, DPR 1.0x, 200 ambient particles (optimized for integrated GPUs and mobile).
- **Holographic Hand Skeleton**: Faint 2D overlay displaying tracked hand bones, joints, fingertip targeting reticles, and active pinch halos.
- **Shockwave Generator**: Animated expanding torus rings generated during spawn, collision, merge, split, and dismiss actions.
- **Particle Dynamics**: Floating ambient particles with organic Brownian motion and subtle drift toward active fingertips.

---

## 4. Audio Synthesis Subsystem

Powered by the browser-native Web Audio API without external audio files:
- **Ambient Drone**: Continuous warm low-frequency drone (55Hz A1) modulated by an LFO.
- **Procedural Sound FX**:
  - Spawn: Ascending major triad arpeggio (440Hz – 880Hz).
  - Collision: Resonant crystal ping with decay.
  - Merge: Sub-bass swell and harmonic fusion sweep.
  - Split: Spatial frequency separation sweep.
  - Zoom Pitch: Real-time frequency sweep tracking palm separation distance.
  - Dismiss: Exponential downward energy whoosh.
  - Shape Morph: Polyphonic chord sweep.
- **Dedicated Controls**: Sound mute toggle (<kbd>M</kbd>) and master volume control.

---

## 5. Export & Persistence Systems

- **Draw Mode Export**:
  - Raster PNG (with background or alpha transparency).
  - Scalable Vector Graphics (SVG) export.
  - 2D Canvas WebM timelapse recording via `canvas.captureStream(30)`.
- **Orb Mode 3D Export**:
  - 3D Screenshot: Composites webcam frame and transparent 3D WebGL canvas into a high-resolution PNG.
  - 3D Timelapse Recording: Records 30fps WebM video of the 3D scene using `MediaRecorder`.
- **Session Persistence**: Debounced `localStorage` autosave preserves canvas state across page reloads.
- **Drawing Gallery**: Local catalog storing artwork snapshots, dates, and stroke data.

---

## 6. Mouse and Touch Fallback

When webcam hardware is unavailable, the application automatically transitions to pointer input:
- **Draw Mode**: Click and drag to draw, erase, or manipulate strokes.
- **Orb Mode**:
  - Left-Click and Drag: Select and manipulate 3D spheres.
  - Background Drag: Orbit and rotate 3D scene.
  - Mouse Wheel: Camera zoom in / out.
  - UI Buttons: Trigger spawn, dismiss, reset, and submode changes.

---

## 7. Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Z</kbd> | Undo last action |
| <kbd>Y</kbd> or <kbd>Shift</kbd> + <kbd>Z</kbd> | Redo action |
| <kbd>C</kbd> | Clear canvas (Draw Mode) |
| <kbd>S</kbd> | Open Export / Save Dialog |
| <kbd>E</kbd> | Toggle between Eraser and Draw tools |
| <kbd>H</kbd> | Toggle control panel collapse |
| <kbd>M</kbd> | Toggle audio synthesis |
| <kbd>?</kbd> | Open gesture reference modal |

---

## 8. Technical Specifications

- **Vision Runtime**: Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision` 0.10.14)
- **Model**: `hand_landmarker.task` (`float16` quantization)
- **3D Graphics Engine**: Three.js r160 (`three.module.js`) via ES Module import map
- **Post-Processing**: Three.js `EffectComposer`, `RenderPass`, `UnrealBloomPass`
- **Audio Engine**: Web Audio API (`AudioContext`, OscillatorNode, BiquadFilterNode, GainNode)
- **Speech Engine**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Video Capture**: MediaStream Recording API (`MediaRecorder` with VP9/WebM compression)
- **Build Requirements**: None (Pure browser-native ES Modules)

---

## 9. Local Deployment

Because camera permissions require a secure context, serve the application over `http://localhost` or `https://`:

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

## 10. Deployment to GitHub Pages

1. Push repository changes to the `main` branch.
2. In the GitHub repository, open **Settings** > **Pages**.
3. Under **Branch**, select `main` and root directory `/`, then click **Save**.
4. The live application will be available at `https://<username>.github.io/<repository>/`.

---

## 11. Troubleshooting & Diagnostics

### WebGL Hardware Acceleration
1. Navigate to `chrome://settings/system`.
2. Ensure **Use graphics acceleration when available** is enabled.
3. Relaunch Chrome and close GPU-intensive browser tabs.
4. *AirDraw automatically falls back to CPU execution if WebGL context allocation fails.*

### Camera Permissions
1. Verify the site is hosted on `https://` or `http://localhost` (browsers restrict camera access on `file://`).
2. Click the camera settings icon in the browser address bar and verify permission is set to **Allow**.
3. If camera hardware is unavailable, select **Use Mouse / Touch** to continue using all tools via pointer input.

---

## 12. Author & License

- **Author**: Prathap ([GitHub](https://github.com/Prathap2349))
- **License**: MIT License
