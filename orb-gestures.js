/**
 * ============================================================================
 * ORB GESTURES - Robust Two-Hand Gesture Controller & State Machine
 * Fixes camera zoom drift via baseline-based distance anchoring
 * Implements 10-state machine, flight travel, pitch/yaw rotation, and conflict prevention
 * ============================================================================
 */
import * as THREE from 'three';

export class OrbGestureController {
    constructor(camera, sceneManager, physics, audio, effects, universe = null) {
        this.camera = camera;
        this.sceneManager = sceneManager;
        this.physics = physics;
        this.audio = audio;
        this.effects = effects;
        this.universe = universe;

        // Three.js Raycaster
        this.raycaster = new THREE.Raycaster();

        // 10-State Machine: IDLE, TRACKING, NAVIGATING, ZOOMING, ROTATING, GRABBING, DRAGGING, THROWING, SPAWNING, RESETTING
        this.state = 'IDLE';

        // Object selection & manipulation
        this.selectedOrb = null;
        this.selectedCosmicObject = null;
        this.grabHand = null;

        // Baseline-Based Stable Zoom
        this.basePalmDistance = null;
        this.baseCameraZ = null;
        this.targetCameraZ = 5.2;
        this.currentCameraZ = 5.2;
        this.minCameraZ = 2.0;
        this.maxCameraZ = 12.0;
        this.zoomSensitivity = 5.5;

        // Navigation & Rotation with Inertia
        this.rotationSensitivity = 1.0;
        this.rotationVelocityY = 0;
        this.rotationVelocityX = 0;
        this.prevSteerAngle = null;
        this.prevAvgPalm = null;

        // Space Travel (Forward / Backward Flight)
        this.travelVelocityZ = 0;
        this.baseHandScale = null;

        // Spawn state
        this.isSpawning = false;
        this.spawnOrbInstance = null;
        this.initialSpawnPalmDist = 0;

        // Reset state
        this.bothFistsDuration = 0;

        // Push / Dismiss state
        this.prevAverageDepth = null;
        this.pushCooldown = 0;

        // Real-Time Tracking Telemetry
        this.trackingStatus = {
            handsCount: 0,
            state: 'IDLE',
            activeGesture: 'IDLE',
            instruction: 'Bring both hands into view to interact with the 3D universe.',
            zoomPercent: 100,
            travelSpeed: 0,
            selectedName: 'None'
        };

        this.loadSettings();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('airdraw_orb_settings');
            if (saved) {
                const s = JSON.parse(saved);
                if (s.zoomSens) this.zoomSensitivity = parseFloat(s.zoomSens);
                if (s.rotSens) this.rotationSensitivity = parseFloat(s.rotSens);
            }
        } catch (e) { }
    }

    setUniverse(universe) {
        this.universe = universe;
    }

    /**
     * Converts normalized [0,1] landmark into a 3D ray point in camera space
     */
    get3DRaycastPoint(normalizedX, normalizedY, depthZ = 0) {
        const ndcX = (1.0 - normalizedX) * 2 - 1; // Mirrored webcam
        const ndcY = -(normalizedY * 2 - 1);

        const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
        vector.unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();

        const distance = (depthZ - this.camera.position.z) / dir.z;
        return this.camera.position.clone().add(dir.multiplyScalar(distance));
    }

    processHands(handsData, timestamp) {
        const count = handsData ? handsData.length : 0;
        this.trackingStatus.handsCount = count;

        if (count === 0) {
            this.handleNoHands();
            return;
        }

        const hand1 = handsData[0];
        const hand2 = (count > 1) ? handsData[1] : null;

        // ====================================================================
        // STATE 1: RESETTING (Both Fists Together)
        // ====================================================================
        if (hand2 && hand1.isFist && hand2.isFist) {
            const fistDist = Math.hypot(hand1.palmCenter.x - hand2.palmCenter.x, hand1.palmCenter.y - hand2.palmCenter.y);
            if (fistDist < 0.38) {
                this.bothFistsDuration += 16;
                this.state = 'RESETTING';
                this.trackingStatus.state = 'RESETTING';
                this.trackingStatus.instruction = 'Holding both fists... Resetting environment!';

                if (this.bothFistsDuration > 380) {
                    this.executeReset();
                    this.bothFistsDuration = 0;
                    return;
                }
                return;
            }
        } else {
            this.bothFistsDuration = 0;
        }

        // ====================================================================
        // STATE 2: DISMISSING (Two-Hand Forward Push)
        // ====================================================================
        if (hand2 && !this.selectedOrb && timestamp > this.pushCooldown) {
            const avgScale = (hand1.handScale + hand2.handScale) / 2;
            if (this.prevAverageDepth !== null) {
                const scaleDelta = avgScale - this.prevAverageDepth;
                if (scaleDelta > 40 && hand1.isOpenHand && hand2.isOpenHand) {
                    this.executeDismiss();
                    this.pushCooldown = timestamp + 1800;
                    this.prevAverageDepth = null;
                    return;
                }
            }
            this.prevAverageDepth = avgScale;
        }

        // ====================================================================
        // STATE 3: SPAWNING (Both Open Palms Held Together)
        // ====================================================================
        if (hand2 && hand1.isOpenHand && hand2.isOpenHand && !this.selectedOrb && !this.isTwoHandZooming) {
            const palmDist = Math.hypot(hand1.palmCenter.x - hand2.palmCenter.x, hand1.palmCenter.y - hand2.palmCenter.y);

            if (!this.isSpawning && palmDist < 0.42) {
                this.isSpawning = true;
                this.state = 'SPAWNING';
                this.initialSpawnPalmDist = palmDist;

                const midNormX = (hand1.palmCenter.x + hand2.palmCenter.x) / 2;
                const midNormY = (hand1.palmCenter.y + hand2.palmCenter.y) / 2;
                const spawnPos = this.get3DRaycastPoint(midNormX, midNormY, 0);

                this.spawnOrbInstance = this.sceneManager.spawnOrb(spawnPos);
                this.spawnOrbInstance.targetScale = 0.4;
                if (this.audio) this.audio.playSpawn();
                if (this.effects) this.effects.spawnShockwave(spawnPos, 0x00ff88, 2.0, 0.4);

                this.trackingStatus.state = 'SPAWNING';
                this.trackingStatus.instruction = 'Move palms apart to expand newly created sphere.';
                return;
            } else if (this.isSpawning && this.spawnOrbInstance) {
                const scale = Math.max(0.4, Math.min(2.0, (palmDist / Math.max(this.initialSpawnPalmDist, 0.1)) * 0.8));
                this.spawnOrbInstance.targetScale = scale;

                const midNormX = (hand1.palmCenter.x + hand2.palmCenter.x) / 2;
                const midNormY = (hand1.palmCenter.y + hand2.palmCenter.y) / 2;
                const curPos = this.get3DRaycastPoint(midNormX, midNormY, 0);
                this.spawnOrbInstance.mesh.position.lerp(curPos, 0.2);
                return;
            }
        } else if (this.isSpawning) {
            this.isSpawning = false;
            this.spawnOrbInstance = null;
        }

        // ====================================================================
        // STATE 4 & 5: GRABBING & DRAGGING (Selective Pinch Only)
        // ====================================================================
        const pinchingHand = (hand1.isPinching ? hand1 : (hand2 && hand2.isPinching ? hand2 : null));

        if (pinchingHand) {
            if (!this.selectedOrb && !this.selectedCosmicObject) {
                const rayPt = this.get3DRaycastPoint(pinchingHand.pinchPoint.x, pinchingHand.pinchPoint.y, 0);

                // Check Classic Orbs
                const closestOrb = this.findClosestOrb(rayPt, 1.3);
                if (closestOrb) {
                    this.selectedOrb = closestOrb;
                    this.selectedOrb.isGrabbed = true;
                    this.grabHand = pinchingHand.handedness;
                    this.state = 'GRABBING';
                    if (this.audio) this.audio.playGrab();

                    this.trackingStatus.state = 'GRABBING';
                    this.trackingStatus.selectedName = closestOrb.name;
                    this.trackingStatus.instruction = `Grabbed ${closestOrb.name}. Drag to move, release while moving to throw.`;
                    return;
                }

                // Check Cosmic Objects in Universe / Planet mode
                if (this.universe) {
                    const closestCosmic = this.universe.findClosestCosmicObject(rayPt, 1.8);
                    if (closestCosmic) {
                        this.selectedCosmicObject = closestCosmic;
                        this.universe.focusObject(closestCosmic);
                        this.trackingStatus.selectedName = closestCosmic.name;
                        this.trackingStatus.instruction = `Selected: ${closestCosmic.name}. Moving toward object!`;
                        if (window.OrbHUD) window.OrbHUD.showObjectInfo(closestCosmic);
                        return;
                    }
                }
            } else if (this.selectedOrb) {
                // Dragging grabbed orb
                this.state = 'DRAGGING';
                const target3D = this.get3DRaycastPoint(pinchingHand.pinchPoint.x, pinchingHand.pinchPoint.y, 0);
                this.selectedOrb.targetPosition.copy(target3D);

                // Expand / Shrink scale with finger spread
                if (pinchingHand.fingerSpreadRatio) {
                    this.selectedOrb.targetScale = Math.max(0.5, Math.min(2.0, pinchingHand.fingerSpreadRatio * 1.5));
                }

                // Merge check
                for (let o of this.sceneManager.orbs) {
                    if (o !== this.selectedOrb && o.visible) {
                        const merged = this.physics.attemptMerge(this.selectedOrb, o);
                        if (merged) {
                            this.selectedOrb = merged;
                            break;
                        }
                    }
                }

                this.trackingStatus.state = 'DRAGGING';
                this.trackingStatus.instruction = `Dragging ${this.selectedOrb.name}. Release while moving to throw.`;
                return;
            }
        } else if (this.selectedOrb) {
            // Pinch Released -> THROWING
            this.state = 'THROWING';
            this.selectedOrb.isGrabbed = false;
            const throwSpeed = this.selectedOrb.velocity.length();

            if (throwSpeed > 1.2 && this.audio) {
                this.audio.playThrow(throwSpeed);
            }

            this.selectedOrb = null;
            this.grabHand = null;
            this.trackingStatus.selectedName = 'None';
        }

        // ====================================================================
        // STATE 6 & 7: TWO-HAND ZOOMING & NAVIGATION (Baseline Anchored)
        // ====================================================================
        if (hand2 && !this.selectedOrb) {
            const p1 = hand1.palmCenter;
            const p2 = hand2.palmCenter;
            const palmDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const steerAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const avgPalm = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            // 1. Stable Baseline Zoom (Fixes Camera Drift)
            if (this.basePalmDistance === null) {
                this.basePalmDistance = palmDist;
                this.baseCameraZ = this.currentCameraZ;
                this.baseHandScale = (hand1.handScale + hand2.handScale) / 2;
            } else {
                const deltaPalm = palmDist - this.basePalmDistance;

                // Hands apart -> Zoom In (lower camera Z)
                // Hands together -> Zoom Out (higher camera Z)
                if (Math.abs(deltaPalm) > 0.03) {
                    this.state = 'ZOOMING';
                    this.targetCameraZ = Math.max(
                        this.minCameraZ,
                        Math.min(this.maxCameraZ, this.baseCameraZ - deltaPalm * this.zoomSensitivity)
                    );

                    if (this.audio) this.audio.modulateZoomPitch(palmDist);
                } else {
                    this.state = 'NAVIGATING';
                }
            }

            // 2. Two-Hand Scene Rotation (Yaw & Pitch & Roll)
            if (this.prevAvgPalm !== null) {
                const deltaX = avgPalm.x - this.prevAvgPalm.x;
                const deltaY = avgPalm.y - this.prevAvgPalm.y;

                if (Math.abs(deltaX) > 0.005 || Math.abs(deltaY) > 0.005) {
                    this.state = 'ROTATING';
                    // Horizontal displacement -> Yaw
                    this.rotationVelocityY += deltaX * 1.6 * this.rotationSensitivity;
                    // Vertical displacement -> Pitch
                    this.rotationVelocityX += deltaY * 1.2 * this.rotationSensitivity;
                }
            }
            this.prevAvgPalm = avgPalm;

            // 3. Two-Hand Steering Angle -> Roll / Orbit
            if (this.prevSteerAngle !== null) {
                const deltaAngle = steerAngle - this.prevSteerAngle;
                if (Math.abs(deltaAngle) > 0.02) {
                    this.rotationVelocityY += deltaAngle * 0.4 * this.rotationSensitivity;
                }
            }
            this.prevSteerAngle = steerAngle;

            // 4. Space Flight Forward / Backward
            if (this.baseHandScale !== null) {
                const currentScale = (hand1.handScale + hand2.handScale) / 2;
                const scaleDelta = currentScale - this.baseHandScale;
                if (Math.abs(scaleDelta) > 18) {
                    // Moving hands forward -> travel into scene
                    this.travelVelocityZ = -Math.sign(scaleDelta) * Math.min(0.12, Math.abs(scaleDelta) * 0.003);
                } else {
                    this.travelVelocityZ *= 0.85;
                }
            }

            this.trackingStatus.state = this.state;
            this.trackingStatus.instruction = (this.state === 'ZOOMING') ?
                'Two-Hand Zoom: Move palms apart to zoom in, together to zoom out.' :
                'Two-Hand Navigation: Tilt hands to rotate, move hands to look around.';
        } else {
            // Reset baseline anchors on hand separation or single hand
            this.basePalmDistance = null;
            this.baseCameraZ = null;
            this.baseHandScale = null;
            this.prevAvgPalm = null;
            this.prevSteerAngle = null;
            this.travelVelocityZ = 0;

            if (count === 1 && !this.selectedOrb) {
                this.state = 'TRACKING';
                this.trackingStatus.state = 'TRACKING';
                this.trackingStatus.instruction = 'One hand detected. Bring second hand into view for navigation.';
            }
        }

        // Update zoom percentage telemetry
        const zoomRange = this.maxCameraZ - this.minCameraZ;
        const currentZoom = Math.round(((this.maxCameraZ - this.currentCameraZ) / zoomRange) * 100 + 50);
        this.trackingStatus.zoomPercent = currentZoom;
        this.trackingStatus.travelSpeed = Math.round(Math.abs(this.travelVelocityZ) * 100);
    }

    findClosestOrb(point, maxThreshold = 1.3) {
        let closest = null;
        let minDist = Infinity;

        this.sceneManager.orbs.forEach(orb => {
            if (!orb.visible) return;
            const d = orb.mesh.position.distanceTo(point);
            if (d < minDist && d < maxThreshold) {
                minDist = d;
                closest = orb;
            }
        });

        return closest;
    }

    executeReset() {
        this.sceneManager.reset();
        this.targetCameraZ = 5.2;
        this.currentCameraZ = 5.2;
        this.camera.position.set(0, 0, 5.2);
        this.camera.rotation.set(0, 0, 0);
        this.rotationVelocityX = 0;
        this.rotationVelocityY = 0;
        this.travelVelocityZ = 0;

        if (this.universe) {
            this.universe.focusObject(null);
        }

        if (this.audio) this.audio.playShapeMorph();
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0xffffff, 4.0, 0.6);

        this.state = 'IDLE';
        this.trackingStatus.state = 'RESETTING';
        this.trackingStatus.instruction = 'Universe coordinates and camera reset to default origin.';
    }

    executeDismiss() {
        this.sceneManager.dismissOrbs();
        if (this.audio) this.audio.playDismiss();
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0xff00ff, 5.0, 0.7);

        this.trackingStatus.instruction = 'Energy spheres dispersed. Bring palms together to spawn.';
    }

    handleNoHands() {
        if (this.selectedOrb) {
            this.selectedOrb.isGrabbed = false;
            this.selectedOrb = null;
        }
        this.isSpawning = false;
        this.basePalmDistance = null;
        this.baseCameraZ = null;
        this.prevSteerAngle = null;
        this.prevAvgPalm = null;

        this.state = 'IDLE';
        this.trackingStatus.state = 'IDLE';
        this.trackingStatus.selectedName = 'None';
        this.trackingStatus.instruction = 'Bring both hands into view to control 3D space.';
    }

    setManualZoom(percent) {
        const p = Math.max(0, Math.min(200, percent));
        const zoomRange = this.maxCameraZ - this.minCameraZ;
        this.targetCameraZ = this.maxCameraZ - ((p - 50) / 100) * zoomRange;
    }

    stepZoom(inward = true) {
        const step = (this.maxCameraZ - this.minCameraZ) * 0.12;
        if (inward) {
            this.targetCameraZ = Math.max(this.minCameraZ, this.targetCameraZ - step);
        } else {
            this.targetCameraZ = Math.min(this.maxCameraZ, this.targetCameraZ + step);
        }
    }

    update(dt) {
        // Smooth Camera Zoom Interpolation
        this.currentCameraZ = THREE.MathUtils.lerp(this.currentCameraZ, this.targetCameraZ, 0.1);
        this.camera.position.z = this.currentCameraZ;

        // Space Flight Forward / Backward
        if (Math.abs(this.travelVelocityZ) > 0.001) {
            this.camera.translateZ(this.travelVelocityZ);
            this.targetCameraZ = this.camera.position.z;
            this.currentCameraZ = this.camera.position.z;
        }

        // Apply Scene Rotation Momentum with Inertia
        if (Math.abs(this.rotationVelocityY) > 0.0001) {
            this.sceneManager.scene.rotation.y += this.rotationVelocityY;
            this.rotationVelocityY *= 0.92; // Damping
        }
        if (Math.abs(this.rotationVelocityX) > 0.0001) {
            this.sceneManager.scene.rotation.x += this.rotationVelocityX;
            this.rotationVelocityX *= 0.92;
        }
    }
}
