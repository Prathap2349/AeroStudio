# AirDraw: Real-Time Hand-Tracking Drawing & 3D Procedural Universe

AirDraw is an enterprise-grade client-side computer vision application that unifies two distinct creative platforms in a single zero-build codebase:

1. **Draw Mode**: A touchless 2D air canvas powered by Google MediaPipe Tasks Vision (`HandLandmarker`), featuring adaptive One Euro filtering, geometric shape snapping, selective collision-based erasing, five specialized brush dynamics, and vector/raster export pipelines.
2. **Orb Mode & Galaxy Universe**: A volumetric 3D environment powered by Three.js, featuring a deterministic procedural universe engine, relativistic camera navigation, baseline-anchored stable zoom, a 10-state gesture machine, an interactive Hand Control Academy, and six selectable astrophysical environments.

The entire system executes client-side using native HTML5, CSS3, Three.js (r160), and modern ECMAScript modules with no build tools, compilers, or bundlers required.

---

## 1. Architectural Overview

AirDraw shares a single webcam stream and MediaPipe `HandLandmarker` instance across both operational modes:

```
                                [Webcam Stream (640x480 @ 30fps)]
                                                │
                                                ▼
                                [MediaPipe Tasks Vision Runtime]
                                  (GPU / CPU Adaptive Fallback)
                                                │
                                                ▼
                               [Multi-Hand 3D Landmarks & Geometry]
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
             [Draw Mode Pipeline]                             [Orb Mode 3D Pipeline]
      - 1€ (One Euro) Adaptive Smoothing              - Three.js WebGL Scene & Perspective Camera
      - Coordinate Transformation (Cover/Mirror)      - 10-State Finite State Machine (FSM)
      - Stroke Vector Spline Generator                - Baseline-Anchored Drift-Free Zoom Engine
      - Real Eraser Geometric Collision Engine        - Procedural Universe Engine (Mulberry32 PRNG)
      - Geometric Shape Snapping Classifier           - Galaxy Navigation HUD & Telemetry
      - Dual-Layer Offscreen Canvas Cache             - Hand Control Academy (8-Step Live Curriculum)
      - Raster (PNG) & Vector (SVG) Exporters         - Holographic Hand Skeleton Visualizer
      - Speech Recognition & Audio Synthesis          - Composite 3D Screenshot & MediaRecorder
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
A fully interactive 3D spatial environment rendered above the live webcam background via Three.js.

#### Procedural Galaxy Universe Engine
The procedural universe subsystem (`orb-universe.js`) generates multi-layered cosmic scenes from a deterministic 32-bit pseudo-random number generator (Mulberry32 PRNG):
- **Multi-Galaxy System**: Simultaneous generation of multi-arm spiral galaxies, dwarf elliptical satellite galaxies, and starburst irregular galaxies with independent rotational axes and velocities.
- **Three-Tier Starfields**: Foreground bright stars with cross-diffraction spikes, midground field stars, and deep background cosmic dust clouds.
- **Volumetric Nebulas**: Procedural gaseous emission clouds rendered using multi-octave additive point clusters.
- **Relativistic Cosmic Bodies**:
  - Supermassive Black Hole (Sagittarius A*) with high-velocity swirling accretion disk and photon sphere.
  - Spacetime Wormhole Gateway with concentric counter-rotating ring arrays.
  - Active shooting stars and meteor showers with trailing particle decay.
  - Constellation networks with luminous geometric vector bindings.

#### 6 Selectable Cosmic Environments
1. **Spiral Galaxy**: Double-arm logarithmic spiral galaxy with hot stellar core and outer star dust arms.
2. **Nebula Universe**: Dense interstellar nebula clouds illuminated by embedded proto-star clusters.
3. **Deep Space**: Vast cosmic void populated by distant galaxies, quasars, and cold starfields.
4. **Black Hole**: Supermassive singularity featuring an ultra-relativistic glowing accretion disk and gravitational event horizon.
5. **Wormhole Gateway**: Hyperspace transit corridor constructed from counter-rotating geometric particle rings.
6. **Golden Universe**: High-energy cosmic dawn characterized by radiant amber and gold stellar emissions.

#### Submode 3D Environments
1. **Classic Orbs**: Three interconnected floating energy spheres with tension lines and elastic collision dynamics.
2. **Planet Mode**: Miniature solar system featuring all 8 planetary bodies (Mercury, Venus, Earth with orbiting Moon, Mars, Jupiter with atmospheric bands, Saturn with tilted double rings, Uranus with thin vertical ring, and Neptune) orbiting a radiant Sun with solar flare corona.
3. **Galaxy Mode**: Procedural 3D universe with deterministic seed generation, multi-galaxy hierarchy, and deep space exploration.
4. **Atom Mode**: Quantum mechanical Bohr model featuring a dense 12-particle nucleus cluster (protons/neutrons) inside an energy shell, orbited by four high-speed electrons on inclined elliptical tracks.
5. **Shape Morph Mode**: High-density point cloud (2,400 vertices) that smoothly interpolates between Sphere, Cube, Torus, and Pyramid without mesh rebuilding.
6. **Fidget Mode**: Calming tactile space featuring five pastel floating spheres with soft harmonic spring physics and interactive repulsion.

---

## 3. Hand Gesture & Navigation Engine

### 3.1 Stable Baseline-Based Zoom (Drift Elimination)
Traditional distance-delta zoom algorithms suffer from cumulative drift because per-frame position deltas accumulate unevenly when hand jitter occurs. AirDraw implements an anchored baseline zoom system:

$$\Delta D = D_{\text{current}} - D_0$$

$$Z_{\text{target}} = \text{clamp}\left(Z_0 - \Delta D \times S_{\text{zoom}}, Z_{\min}, Z_{\max}\right)$$

$$Z_{\text{camera}}(t) = \text{lerp}\left(Z_{\text{camera}}(t-1), Z_{\text{target}}, \alpha\right)$$

Where:
- $D_0$: Initial palm-to-palm distance captured at the moment two-hand navigation engages.
- $Z_0$: Initial camera depth captured simultaneously with $D_0$.
- $S_{\text{zoom}}$: Configurable zoom sensitivity factor (default: 5.5).
- $\alpha$: Exponential smoothing coefficient ($\alpha = 0.10$).

Because $Z_{\text{target}}$ is anchored directly to the baseline distance difference $(\Delta D)$ rather than a continuous accumulator, holding hands at a constant distance locks the camera firmly in place with zero drift.

### 3.2 10-State Finite State Machine (FSM)
Gesture transitions are managed through a deterministic state machine to eliminate input conflicts:

```
                  ┌──────────────┐
                  │     IDLE     │
                  └──────┬───────┘
                         │ Hands Detected
                         ▼
                  ┌──────────────┐
                  │   TRACKING   │
                  └──────┬───────┘
        ┌────────────────┼────────────────┐
        │ Both Fists     │ 2 Hands Free   │ 1 Pinch Near Object
        ▼                ▼                ▼
 ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 │  RESETTING   │ │  NAVIGATING  │ │   GRABBING   │
 └──────────────┘ └──────┬───────┘ └──────┬───────┘
                  ┌──────┴──────┐         │ Dragging
                  ▼             ▼         ▼
           ┌──────────┐   ┌──────────┐┌──────────────┐
           │ ZOOMING  │   │ ROTATING ││   DRAGGING   │
           └──────────┘   └──────────┘└──────┬───────┘
                                             │ Release in Motion
                                             ▼
                                      ┌──────────────┐
                                      │   THROWING   │
                                      └──────────────┘
```

| State | Activation Criteria | Engine Action |
| :--- | :--- | :--- |
| `IDLE` | No hands in camera view | Retains inertia; glides to stop |
| `TRACKING` | 1 or 2 hands detected in neutral pose | Tracks fingertips; renders holographic skeleton |
| `NAVIGATING` | Both hands visible in open/neutral stance | Evaluates spatial differential for zoom and rotation |
| `ZOOMING` | Palm distance change $|\Delta D| > 0.05$ | Applies baseline-anchored camera Z translation |
| `ROTATING` | Differential steering angle $|\Delta \theta| > 0.04$ rad | Rotates 3D scene pitch and yaw with inertia damping |
| `GRABBING` | Single-hand pinch with raycast hit $\le 1.3$ units | Latches target sphere or selects celestial object |
| `DRAGGING` | Pinched hand in motion | Translates grabbed object along camera plane |
| `THROWING` | Pinch released while velocity $> 1.0$ unit/s | Imparts hand momentum to object with bounce damping |
| `SPAWNING` | Both open palms held together ($< 0.22$ distance) | Generates new energy sphere between palms |
| `RESETTING` | Both fists held together ($< 0.38$ distance) for 380ms | Smoothly animates camera and scene back to origin |

*Note: Pinching in empty space (raycast distance $> 1.3$ units) does not trigger `GRABBING`. This deliberate threshold allows two-hand navigation to operate reliably without accidental grabs.*

---

## 4. Hand Control Academy & Training Arena

AirDraw includes an interactive on-screen training curriculum (`orb-academy.js`) designed to guide new users through 3D hand interaction:

1. **Two-Hand Tracking**: Verifies camera framing and hand visibility.
2. **Stable Zoom In**: Guides moving hands apart and verifies camera advance.
3. **Stable Zoom Out**: Guides moving hands together and verifies camera retraction.
4. **Cosmic Steering**: Guides dual-hand steering wheel motion for pitch and yaw.
5. **Relativistic Flight**: Guides forward and backward translation through starfields.
6. **Raycast Pointing**: Guides index-finger targeting of celestial bodies.
7. **Pinch & Inspect**: Guides pinching celestial objects to inspect holographic telemetry cards.
8. **Universal Origin Reset**: Guides dual-fist gesture to reset coordinates.

### Live Feedback Loop
Each step displays an animated hand pose graphic alongside a real-time detector badge. When the vision pipeline confirms the correct spatial pose, the system emits an audio confirmation tone and activates a completion checkmark. Completion status is persisted in browser storage.

### Dedicated Practice Arena
A sandboxed training environment isolating a single glowing test orb with real-time on-screen telemetry. Users can practice grabbing, throwing, zooming, and rotating without scene clutter.

---

## 5. Galaxy Navigation HUD & Object Inspector

The Galaxy HUD (`orb-hud.js`) provides flight telemetry and celestial data overlays:
- **Telemetry Readout**: Real-time display of Active Environment, Universe Seed Number, Zoom Percentage, Travel Speed (km/s), and active Gesture FSM state.
- **Manual Zoom Steppers**: Precision `[ + ]` and `[ - ]` buttons and range slider for micro-adjustments.
- **Universe Control Bar**:
  - `Randomize`: Generates a new procedural universe with a randomized Mulberry32 seed.
  - `Lock`: Preserves current seed in `localStorage` across sessions.
  - `Restore`: Restores the previous seed configuration.
  - `Reset Cam`: Instantly re-aligns camera and flight velocity to default origin.
- **Holographic Celestial Object Inspector**:
  - Pointing and pinching any celestial object opens a holographic inspection card displaying Object Classification, Estimated Mass (Solar Masses $M_\odot$), Distance (Light Years), and Astrophysical Description.
  - `Fly Here / Focus`: Automatically glides the camera into close orbital proximity of the selected object.
  - `Universe View`: Smoothly pulls the camera back to macroscopic universe framing.

---

## 6. Audio Synthesis Subsystem

Powered by the browser-native Web Audio API without external audio assets:
- **Ambient Drone**: Continuous low-frequency drone (55Hz A1) modulated by a 0.2Hz sine LFO through a low-pass biquad filter.
- **Procedural Sound FX**:
  - Spawn: Ascending major triad arpeggio (440Hz – 880Hz).
  - Collision: Resonant crystal ping with exponential decay.
  - Merge: Sub-bass swell and harmonic fusion sweep.
  - Split: Spatial frequency separation sweep.
  - Zoom Pitch: Real-time frequency sweep tracking palm separation distance.
  - Dismiss: Exponential downward energy sweep.
  - Shape Morph: Polyphonic chord sweep (E minor / C major harmony).
  - Academy Celebration: Four-note arpeggiated chime (C5, E5, G5, C6).
- **Master Volume**: Configurable gain control (0% – 100%) and keyboard mute toggle (<kbd>M</kbd>).

---

## 7. Export & Persistence Systems

- **Draw Mode Export**:
  - Raster PNG (with active background or transparent alpha channel).
  - Scalable Vector Graphics (SVG) with stroke path geometry.
  - 2D Canvas WebM timelapse recording via `canvas.captureStream(30)`.
- **Orb Mode 3D Export**:
  - 3D Screenshot: Composites webcam video frame and WebGL canvas buffer into a high-resolution PNG image.
  - 3D Video Recording: Records continuous 30fps WebM video with audio synthesis track via `MediaRecorder`.
- **Session Persistence**: Debounced `localStorage` autosave preserves canvas artwork and user settings across reloads.
- **Drawing Gallery**: Local catalog storing artwork snapshots, timestamps, and stroke datasets.

---

## 8. Mouse & Touch Fallback

When camera hardware or WebGL acceleration is unavailable, the application automatically transitions to pointer input:
- **Draw Mode**: Click and drag to draw, erase, or manipulate vector strokes.
- **Orb Mode**:
  - Left-Click and Drag on Orb: Grab and move 3D energy sphere along camera plane.
  - Left-Click and Drag on Cosmic Object: Open holographic inspection card.
  - Left-Click and Drag on Background: Rotate 3D scene pitch and yaw.
  - Mouse Wheel: Camera zoom in and out.
  - HUD Controls: Fully interactive via standard mouse or touchscreen input.

---

## 9. Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| <kbd>Z</kbd> | Draw Mode | Undo last stroke or transform action |
| <kbd>Y</kbd> or <kbd>Shift</kbd>+<kbd>Z</kbd> | Draw Mode | Redo previously undone action |
| <kbd>C</kbd> | Draw Mode | Clear canvas |
| <kbd>S</kbd> | Draw Mode | Open Export / Save Dialog |
| <kbd>E</kbd> | Draw Mode | Toggle Eraser tool |
| <kbd>H</kbd> | Both Modes | Toggle side control panel visibility |
| <kbd>M</kbd> | Both Modes | Toggle audio synthesizer mute |
| <kbd>?</kbd> | Draw Mode | Open gesture reference modal |

---

## 10. Technical Specifications

- **Vision Runtime**: Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision` 0.10.14)
- **Model**: `hand_landmarker.task` (`float16` quantization)
- **3D Graphics Engine**: Three.js r160 (`three.module.js`) via ES Module import map
- **Post-Processing**: Three.js `EffectComposer`, `RenderPass`, `UnrealBloomPass`
- **Audio Engine**: Web Audio API (`AudioContext`, `OscillatorNode`, `BiquadFilterNode`, `GainNode`)
- **Speech Engine**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Video Capture**: MediaStream Recording API (`MediaRecorder` with VP9/WebM compression)
- **Build Requirements**: None (Pure browser-native ES Modules)

---

## 11. Local Deployment

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

## 12. Deployment to GitHub Pages

1. Push repository changes to the `main` branch:
   ```bash
   git add .
   git commit -m "feat: complete galaxy universe upgrade"
   git push origin main
   ```
2. In the GitHub repository, open **Settings** > **Pages**.
3. Under **Branch**, select `main` and root directory `/`, then click **Save**.
4. The live application will be served at `https://<username>.github.io/<repository>/`.

---

## 13. Troubleshooting & Diagnostics

### WebGL Hardware Acceleration
1. Navigate to `chrome://settings/system`.
2. Ensure **Use graphics acceleration when available** is enabled.
3. Relaunch Chrome and close GPU-intensive browser tabs.
4. *AirDraw automatically falls back to CPU execution if WebGL context allocation fails.*

### Camera Permissions
1. Verify the application is served over `https://` or `http://localhost` (browsers restrict camera access on `file://`).
2. Click the camera settings icon in the browser address bar and verify permission is set to **Allow**.
3. If camera hardware is unavailable, select **Use Mouse / Touch** to continue using all tools via pointer input.

---

## 14. Author & License

- **Author**: Prathap ([GitHub](https://github.com/Prathap2349))
- **Repository**: [Prathap2349/airdraw](https://github.com/Prathap2349/airdraw)
- **License**: MIT License
