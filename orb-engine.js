/**
 * ============================================================================
 * ORB ENGINE - Three.js Master Engine & Lifecycle Coordinator
 * Seamlessly manages scene, camera, bloom composer, physics, and gestures
 * Integrates Procedural Universe, Galaxy Navigation HUD, and Hand Control Academy
 * ============================================================================
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { OrbAudioSystem } from './orb-audio.js';
import { OrbEffects } from './orb-effects.js';
import { OrbPhysics } from './orb-physics.js';
import { OrbSceneManager } from './orb-scene.js';
import { OrbGestureController } from './orb-gestures.js';
import { OrbModesManager } from './orb-modes.js';
import { OrbExportSystem } from './orb-export.js';
import { OrbHUD } from './orb-hud.js';
import { OrbAcademy } from './orb-academy.js';

export class OrbEngine {
    constructor() {
        this.isActive = false;
        this.canvas = document.getElementById('orb-canvas');
        this.video = document.getElementById('webcam');

        // Quality presets: 'HIGH' | 'BALANCED' | 'PERFORMANCE'
        this.quality = 'BALANCED';

        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.bloomPass = null;

        // Subsystems
        this.audio = null;
        this.effects = null;
        this.physics = null;
        this.sceneManager = null;
        this.gestureController = null;
        this.modesManager = null;
        this.exportSystem = null;
        this.hud = null;
        this.academy = null;

        // Loop & time
        this.animFrameId = null;
        this.clock = new THREE.Clock();

        // Mouse fallback interaction
        this.isMouseDown = false;
        this.prevMousePos = { x: 0, y: 0 };
        this.draggedOrb = null;

        this.init();
    }

    init() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // 1. Scene
        this.scene = new THREE.Scene();

        // 2. Camera
        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 5.2);

        // Renderer with transparency for webcam background
        // preserveDrawingBuffer is set to false for maximum rendering throughput on Apple Silicon and integrated GPUs.
        // renderForCapture() is called on-demand immediately before taking screenshots.
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        // Diagnostics tracking
        this.lastFpsUpdate = performance.now();
        this.frameCount = 0;
        this.currentFps = 60;
        this.currentFrameTime = 16.6;

        // Reusable scratch vectors for zero per-frame allocations
        this._projVec = new THREE.Vector3();
        this._projResult = { x: 0, y: 0 };

        // 4. Post-processing (UnrealBloomPass)
        try {
            this.composer = new EffectComposer(this.renderer);
            const renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);

            this.bloomPass = new UnrealBloomPass(
                new THREE.Vector2(width, height),
                0.9,  // Bloom strength
                0.5,  // Bloom radius
                0.15  // Bloom threshold
            );
            this.composer.addPass(this.bloomPass);
        } catch (e) {
            console.warn('UnrealBloomPass unavailable, using standard renderer:', e);
            this.composer = null;
        }

        // 5. Instantiate Subsystems
        this.audio = new OrbAudioSystem();
        this.effects = new OrbEffects(this.scene, this.camera);
        this.physics = new OrbPhysics(this.audio, this.effects);
        this.sceneManager = new OrbSceneManager(this.scene);
        this.modesManager = new OrbModesManager(
            this.scene,
            this.camera,
            this.audio,
            this.effects,
            this.sceneManager
        );
        this.gestureController = new OrbGestureController(
            this.camera,
            this.sceneManager,
            this.physics,
            this.audio,
            this.effects,
            this.modesManager.getUniverse()
        );
        this.exportSystem = new OrbExportSystem(this.video, this.canvas);

        // 6. Instantiate HUD and Academy controllers
        this.hud = new OrbHUD(this);
        window.OrbHUD = this.hud;

        this.academy = new OrbAcademy(this);
        window.OrbAcademy = this.academy;

        // 7. Listeners
        window.addEventListener('resize', () => this.onResize());
        this.initMouseFallback();
    }

    setQuality(level) {
        this.quality = level;
        const width = window.innerWidth;
        const height = window.innerHeight;

        if (level === 'PERFORMANCE') {
            this.renderer.setPixelRatio(1.0);
            if (this.bloomPass) this.bloomPass.enabled = false;
        } else if (level === 'BALANCED') {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
            if (this.bloomPass) {
                this.bloomPass.enabled = true;
                this.bloomPass.strength = 0.75;
                this.bloomPass.radius = 0.40;
            }
        } else { // HIGH
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.85));
            if (this.bloomPass) {
                this.bloomPass.enabled = true;
                this.bloomPass.strength = 1.15;
                this.bloomPass.radius = 0.55;
            }
        }

        if (this.effects) this.effects.setQuality(level);
        if (this.composer) this.composer.setSize(width, height);
        this.renderer.setSize(width, height);
    }

    renderForCapture() {
        if (this.composer && this.bloomPass && this.bloomPass.enabled) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onVisibilityChange(isVisible) {
        if (!isVisible) {
            if (this.audio) this.audio.stopAmbientHum();
        } else if (this.isActive) {
            this.clock.start();
            if (this.audio) this.audio.startAmbientHum();
        }
    }

    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        if (this.composer) {
            this.composer.setSize(width, height);
        }

        const skelCanvas = document.getElementById('skeleton-canvas');
        if (skelCanvas) {
            skelCanvas.width = width;
            skelCanvas.height = height;
        }
    }

    initMouseFallback() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.prevMousePos = { x: e.clientX, y: e.clientY };

            // Check if clicking directly on a sphere or cosmic object
            const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
            const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
            const ray = new THREE.Raycaster();
            ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);

            // 1. Check orbs
            const intersects = [];
            this.sceneManager.orbs.forEach(orb => {
                if (orb.visible && orb.coreMesh) {
                    const hits = ray.intersectObject(orb.coreMesh);
                    if (hits.length > 0) intersects.push({ orb, dist: hits[0].distance });
                }
            });

            if (intersects.length > 0) {
                intersects.sort((a, b) => a.dist - b.dist);
                this.draggedOrb = intersects[0].orb;
                this.draggedOrb.isGrabbed = true;
                if (this.audio) this.audio.playGrab();
                return;
            }

            // 2. Check selectable cosmic objects in Galaxy Mode
            if (this.modesManager && this.modesManager.currentMode === 'galaxy') {
                const uni = this.modesManager.getUniverse();
                if (uni && uni.selectableObjects.length > 0) {
                    const meshes = uni.selectableObjects.map(o => o.mesh);
                    const cosmicHits = ray.intersectObjects(meshes, true);
                    if (cosmicHits.length > 0) {
                        const hitMesh = cosmicHits[0].object;
                        const matched = uni.selectableObjects.find(o => o.mesh === hitMesh || o.mesh.children.includes(hitMesh));
                        if (matched) {
                            if (this.hud) this.hud.showObjectCard(matched);
                            if (this.audio) this.audio.playGrab();
                        }
                    }
                }
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isActive) return;
            const dx = e.clientX - this.prevMousePos.x;
            const dy = e.clientY - this.prevMousePos.y;
            this.prevMousePos = { x: e.clientX, y: e.clientY };

            if (!this.isMouseDown) return;

            if (this.draggedOrb) {
                // Drag sphere along camera plane
                const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
                const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
                const pt = this.gestureController.get3DRaycastPoint((ndcX + 1) / 2, (-ndcY + 1) / 2, 0);
                this.draggedOrb.targetPosition.copy(pt);
            } else {
                // Rotate scene with mouse drag
                this.gestureController.rotationVelocityY += dx * 0.003;
                this.gestureController.rotationVelocityX += dy * 0.003;
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.draggedOrb) {
                this.draggedOrb.isGrabbed = false;
                const speed = this.draggedOrb.velocity.length();
                if (speed > 1.0 && this.audio) this.audio.playThrow(speed);
                this.draggedOrb = null;
            }
            this.isMouseDown = false;
        });

        // Mouse Wheel Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.gestureController.targetCameraZ = Math.max(
                this.gestureController.minCameraZ,
                Math.min(this.gestureController.maxCameraZ, this.gestureController.targetCameraZ + e.deltaY * 0.005)
            );
        }, { passive: false });
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.clock.start();
        this.onResize();

        if (this.audio) {
            this.audio.startAmbientHum();
        }

        const renderLoop = () => {
            if (!this.isActive) return;
            this.animFrameId = requestAnimationFrame(renderLoop);

            const dt = Math.min(this.clock.getDelta(), 0.1);
            const elapsedTime = this.clock.getElapsedTime();

            // 1. Update Physics (only in classic orbs mode)
            if (this.modesManager.currentMode === 'classic') {
                this.physics.update(this.sceneManager.orbs, dt);
            }

            // 2. Update Scene & Idle Animations
            this.sceneManager.update(elapsedTime, dt);

            // 3. Update Submode Environments (including Galaxy procedural universe)
            this.modesManager.update(elapsedTime, dt);

            // 4. Update Gestures (Zoom & Rotation inertia)
            this.gestureController.update(dt);

            // 5. Update Particle Effects
            this.effects.update(dt, this.sceneManager.orbs, this.currentFingertips);

            // 6. Render Frame
            if (this.composer && this.bloomPass && this.bloomPass.enabled) {
                this.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }

            // 7. Diagnostics Telemetry (FPS, Frame Time, Draw Calls)
            this.frameCount++;
            const perfNow = performance.now();
            if (perfNow - this.lastFpsUpdate >= 500) {
                this.currentFps = Math.round((this.frameCount * 1000) / (perfNow - this.lastFpsUpdate));
                this.currentFrameTime = dt * 1000;
                this.frameCount = 0;
                this.lastFpsUpdate = perfNow;

                if (this.hud && typeof this.hud.updateDiagnostics === 'function') {
                    this.hud.updateDiagnostics({
                        fps: this.currentFps,
                        frameTime: this.currentFrameTime,
                        drawCalls: this.renderer.info.render.calls,
                        triangles: this.renderer.info.render.triangles,
                        quality: this.quality
                    });
                }
            }
        };

        this.animFrameId = requestAnimationFrame(renderLoop);
    }

    stop() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.audio) {
            this.audio.stopAmbientHum();
        }
        if (this.effects) {
            this.effects.clearSkeleton();
        }
    }

    /**
     * Consumes MediaPipe landmark results dispatched by predictWebcamLoop()
     */
    handleLandmarks(results, timestamp) {
        if (!this.isActive) return;

        const handsCount = results && results.landmarks ? results.landmarks.length : 0;
        const width = window.innerWidth;
        const height = window.innerHeight;

        const parsedHands = [];
        this.currentFingertips = [];

        for (let i = 0; i < handsCount; i++) {
            const rawLms = results.landmarks[i];
            const handedness = (results.handedness && results.handedness[i]) ?
                results.handedness[i][0].categoryName : (i === 0 ? 'Right' : 'Left');

            // Screen mapped points
            const screenPoints = rawLms.map(lm => ({
                x: (1.0 - lm.x) * width, // Mirrored
                y: lm.y * height
            }));

            // 3D fingertips for particle attraction
            const indexTip3D = this.gestureController.get3DRaycastPoint(rawLms[8].x, rawLms[8].y, 0);
            this.currentFingertips.push(indexTip3D);

            // Hand geometry & pose analysis
            const wrist = rawLms[0];
            const thumbTip = rawLms[4];
            const indexTip = rawLms[8];
            const middleMcp = rawLms[9];
            const middleTip = rawLms[12];
            const ringTip = rawLms[16];
            const pinkyTip = rawLms[20];

            const dist2D = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const handScale = Math.max(dist2D(wrist, middleMcp), 0.05);

            // Normalized pinch distance
            const pinchDist = dist2D(thumbTip, indexTip) / handScale;
            const isPinching = (pinchDist < 0.40);

            // Fist check
            const fingersCurled = dist2D(indexTip, wrist) < 0.25 * handScale &&
                dist2D(middleTip, wrist) < 0.25 * handScale &&
                dist2D(ringTip, wrist) < 0.25 * handScale &&
                dist2D(pinkyTip, wrist) < 0.25 * handScale;

            // Open hand check
            const isOpenHand = dist2D(indexTip, wrist) > 0.45 * handScale &&
                dist2D(middleTip, wrist) > 0.45 * handScale &&
                dist2D(ringTip, wrist) > 0.45 * handScale &&
                dist2D(pinkyTip, wrist) > 0.45 * handScale;

            // Finger spread ratio
            const spread = dist2D(thumbTip, pinkyTip) / handScale;

            parsedHands.push({
                handedness,
                rawLandmarks: rawLms,
                screenPoints,
                pinchPoint: { x: (thumbTip.x + indexTip.x) / 2, y: (thumbTip.y + indexTip.y) / 2 },
                palmCenter: { x: (wrist.x + middleMcp.x) / 2, y: (wrist.y + middleMcp.y) / 2 },
                handScale,
                isPinching,
                isFist: fingersCurled,
                isOpenHand,
                fingerSpreadRatio: spread
            });
        }

        // Process through Gesture Controller
        this.gestureController.processHands(parsedHands, timestamp);

        // Holographic hand skeleton
        const selectedScreenPos = (this.gestureController.selectedOrb) ?
            this.project3DToScreen(this.gestureController.selectedOrb.mesh.position) : null;
        this.effects.drawHandSkeleton(parsedHands, null, selectedScreenPos);

        // Update UI tracking badge
        if (window.OrbUI) {
            window.OrbUI.updateTrackingBadge(this.gestureController.trackingStatus);
        }

        // Update Galaxy Navigation HUD
        if (this.hud) {
            this.hud.update(this.gestureController.trackingStatus);
            if (this.gestureController.selectedCosmicObject) {
                this.hud.showObjectCard(this.gestureController.selectedCosmicObject);
            }
        }

        // Evaluate live Hand Control Academy feedback
        if (this.academy) {
            this.academy.evaluateFrame(parsedHands, this.gestureController.trackingStatus);
        }
    }

    project3DToScreen(pos3D) {
        this._projVec.copy(pos3D).project(this.camera);
        this._projResult.x = ((this._projVec.x + 1) / 2) * window.innerWidth;
        this._projResult.y = ((-this._projVec.y + 1) / 2) * window.innerHeight;
        return this._projResult;
    }

    dispose() {
        this.stop();
        if (this.effects) this.effects.dispose();
        if (this.renderer) this.renderer.dispose();
    }
}
