/**
 * ============================================================================
 * ORB GESTURES - Dedicated Two-Hand Gesture Controller for 3D Interaction
 * Implements Zoom, Rotation, Grab/Move, Throw, Spawn, Dismiss, Scale, Reset
 * ============================================================================
 */
import * as THREE from 'three';

export class OrbGestureController {
    constructor(camera, sceneManager, physics, audio, effects) {
        this.camera = camera;
        this.sceneManager = sceneManager;
        this.physics = physics;
        this.audio = audio;
        this.effects = effects;

        // Three.js Raycaster for 3D selection
        this.raycaster = new THREE.Raycaster();

        // Gesture state
        this.selectedOrb = null;
        this.grabHand = null;         // 'Left' or 'Right'
        this.previousHandPos = null;

        // Two-Hand Zoom state
        this.isTwoHandZooming = false;
        this.initialPalmDistance = null;
        this.targetCameraZ = 5.2;
        this.currentCameraZ = 5.2;

        // Two-Hand Rotation state
        this.isTwoHandRotating = false;
        this.prevSteerAngle = null;
        this.rotationVelocityY = 0;
        this.rotationVelocityX = 0;

        // Spawn gesture state
        this.isSpawning = false;
        this.spawnOrbInstance = null;
        this.initialSpawnPalmDist = 0;

        // Reset gesture state
        this.bothFistsDuration = 0;

        // Forward push dismiss state
        this.prevAverageDepth = null;
        this.pushCooldown = 0;

        // Tracking status output
        this.trackingStatus = {
            handsCount: 0,
            activeGesture: 'IDLE',
            instruction: 'Bring hands into view to interact with energy spheres.'
        };
    }

    /**
     * Converts normalized [0,1] landmark into a 3D ray in Three.js camera space
     */
    get3DRaycastPoint(normalizedX, normalizedY, depthZ = 0) {
        // Mirrored webcam: normalizedX inverted
        const ndcX = (1.0 - normalizedX) * 2 - 1;
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
        // PRIORITY 1: Gesture I — Reset (Both Fists Together)
        // ====================================================================
        if (hand2 && hand1.isFist && hand2.isFist) {
            const fistDist = Math.hypot(hand1.palmCenter.x - hand2.palmCenter.x, hand1.palmCenter.y - hand2.palmCenter.y);
            if (fistDist < 0.35) {
                this.bothFistsDuration += 16;
                if (this.bothFistsDuration > 400) {
                    this.executeReset();
                    this.bothFistsDuration = 0;
                    return;
                }
            }
        } else {
            this.bothFistsDuration = 0;
        }

        // ====================================================================
        // PRIORITY 2: Gesture F — Dismiss Orbs (Two-Hand Forward Push)
        // ====================================================================
        if (hand2 && !this.selectedOrb && timestamp > this.pushCooldown) {
            // Hand scale or landmark depth indicates forward push
            const avgScale = (hand1.handScale + hand2.handScale) / 2;
            if (this.prevAverageDepth !== null) {
                const scaleDelta = avgScale - this.prevAverageDepth;
                if (scaleDelta > 38 && hand1.isOpenHand && hand2.isOpenHand) {
                    this.executeDismiss();
                    this.pushCooldown = timestamp + 1800;
                    this.prevAverageDepth = null;
                    return;
                }
            }
            this.prevAverageDepth = avgScale;
        }

        // ====================================================================
        // PRIORITY 3: Gesture D — Spawn Orb (Both Open Palms Facing Camera)
        // ====================================================================
        if (hand2 && hand1.isOpenHand && hand2.isOpenHand && !this.selectedOrb && !this.isTwoHandZooming) {
            const palmDist = Math.hypot(hand1.palmCenter.x - hand2.palmCenter.x, hand1.palmCenter.y - hand2.palmCenter.y);

            if (!this.isSpawning && palmDist < 0.45) {
                this.isSpawning = true;
                this.initialSpawnPalmDist = palmDist;

                const midNormX = (hand1.palmCenter.x + hand2.palmCenter.x) / 2;
                const midNormY = (hand1.palmCenter.y + hand2.palmCenter.y) / 2;
                const spawnPos = this.get3DRaycastPoint(midNormX, midNormY, 0);

                this.spawnOrbInstance = this.sceneManager.spawnOrb(spawnPos);
                this.spawnOrbInstance.targetScale = 0.4;
                if (this.audio) this.audio.playSpawn();
                if (this.effects) this.effects.spawnShockwave(spawnPos, 0x00ff88, 2.0, 0.4);

                this.trackingStatus.activeGesture = 'SPAWN_ORB';
                this.trackingStatus.instruction = 'Move palms apart to expand the newly spawned sphere.';
                return;
            } else if (this.isSpawning && this.spawnOrbInstance) {
                // Scale sphere with palm separation
                const scale = Math.max(0.4, Math.min(1.8, (palmDist / Math.max(this.initialSpawnPalmDist, 0.1)) * 0.8));
                this.spawnOrbInstance.targetScale = scale;

                const midNormX = (hand1.palmCenter.x + hand2.palmCenter.x) / 2;
                const midNormY = (hand1.palmCenter.y + hand2.palmCenter.y) / 2;
                const curPos = this.get3DRaycastPoint(midNormX, midNormY, 0);
                this.spawnOrbInstance.mesh.position.lerp(curPos, 0.2);
                return;
            }
        } else if (this.isSpawning) {
            // Finalize spawn
            this.isSpawning = false;
            this.spawnOrbInstance = null;
        }

        // ====================================================================
        // PRIORITY 4: Gesture C & E — Grab, Move & Throw
        // ====================================================================
        const pinchingHand = (hand1.isPinching ? hand1 : (hand2 && hand2.isPinching ? hand2 : null));

        if (pinchingHand) {
            if (!this.selectedOrb) {
                // Raycast to find closest sphere under fingertip
                const rayPt = this.get3DRaycastPoint(pinchingHand.pinchPoint.x, pinchingHand.pinchPoint.y, 0);
                const closest = this.findClosestOrb(rayPt, 1.4);

                if (closest) {
                    this.selectedOrb = closest;
                    this.selectedOrb.isGrabbed = true;
                    this.grabHand = pinchingHand.handedness;
                    if (this.audio) this.audio.playGrab();

                    this.trackingStatus.activeGesture = 'GRAB_MOVE';
                    this.trackingStatus.instruction = `Holding ${closest.name}. Move to reposition, release while moving to throw.`;
                }
            } else {
                // Move grabbed sphere
                const target3D = this.get3DRaycastPoint(pinchingHand.pinchPoint.x, pinchingHand.pinchPoint.y, 0);
                this.selectedOrb.targetPosition.copy(target3D);

                // Gesture G — Expand and Shrink based on finger spread
                if (pinchingHand.fingerSpreadRatio) {
                    this.selectedOrb.targetScale = Math.max(0.5, Math.min(2.0, pinchingHand.fingerSpreadRatio * 1.5));
                }

                // Check Merge with other orbs
                for (let o of this.sceneManager.orbs) {
                    if (o !== this.selectedOrb && o.visible) {
                        const merged = this.physics.attemptMerge(this.selectedOrb, o);
                        if (merged) {
                            this.selectedOrb = merged;
                            break;
                        }
                    }
                }
            }
            return;
        } else if (this.selectedOrb) {
            // Pinch Released -> Gesture E: Throw Orb
            this.selectedOrb.isGrabbed = false;
            const throwSpeed = this.selectedOrb.velocity.length();

            if (throwSpeed > 1.2 && this.audio) {
                this.audio.playThrow(throwSpeed);
            }

            this.selectedOrb = null;
            this.grabHand = null;
        }

        // ====================================================================
        // PRIORITY 5: Gesture A & B — Two-Hand Zoom & Scene Rotation
        // ====================================================================
        if (hand2 && !this.selectedOrb) {
            const p1 = hand1.palmCenter;
            const p2 = hand2.palmCenter;
            const palmDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            const steerAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            // Two-Hand Zoom
            if (this.initialPalmDistance === null) {
                this.initialPalmDistance = palmDist;
            } else {
                const deltaDist = palmDist - this.initialPalmDistance;
                // Move hands apart: zoom in (decrease Z); move hands together: zoom out (increase Z)
                this.targetCameraZ = Math.max(2.8, Math.min(8.5, this.currentCameraZ - deltaDist * 3.5));

                if (this.audio) {
                    this.audio.modulateZoomPitch(palmDist);
                }
            }

            // Two-Hand Steering Rotation
            if (this.prevSteerAngle !== null) {
                const deltaAngle = steerAngle - this.prevSteerAngle;
                this.rotationVelocityY += deltaAngle * 0.45;
            }
            this.prevSteerAngle = steerAngle;

            // Two-Hand Horizontal Translation Rotation
            const avgPalmX = (p1.x + p2.x) / 2;
            if (this.prevAvgPalmX !== undefined) {
                const deltaX = avgPalmX - this.prevAvgPalmX;
                this.rotationVelocityY += deltaX * 1.8;
            }
            this.prevAvgPalmX = avgPalmX;

            this.trackingStatus.activeGesture = 'TWO_HAND_NAV';
            this.trackingStatus.instruction = 'Two-Hand Navigation: Move hands apart to zoom, rotate hands to turn.';
        } else {
            this.initialPalmDistance = null;
            this.prevSteerAngle = null;
            this.prevAvgPalmX = undefined;

            if (count === 1) {
                this.trackingStatus.activeGesture = 'ONE_HAND';
                this.trackingStatus.instruction = 'Pinch near any energy sphere to grab and move it.';
            }
        }
    }

    findClosestOrb(point, maxThreshold = 1.4) {
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
        if (this.audio) this.audio.playShapeMorph();
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0xffffff, 4.0, 0.6);

        this.trackingStatus.activeGesture = 'RESET';
        this.trackingStatus.instruction = 'Environment reset to default holographic state.';
    }

    executeDismiss() {
        this.sceneManager.dismissOrbs();
        if (this.audio) this.audio.playDismiss();
        if (this.effects) this.effects.spawnShockwave(new THREE.Vector3(0, 0, 0), 0xff00ff, 5.0, 0.7);

        this.trackingStatus.activeGesture = 'DISMISS';
        this.trackingStatus.instruction = 'Energy spheres dispersed. Bring palms together to spawn.';
    }

    handleNoHands() {
        if (this.selectedOrb) {
            this.selectedOrb.isGrabbed = false;
            this.selectedOrb = null;
        }
        this.isSpawning = false;
        this.initialPalmDistance = null;
        this.prevSteerAngle = null;

        this.trackingStatus.activeGesture = 'NO_HANDS';
        this.trackingStatus.instruction = 'Show both hands to webcam to engage 3D holographic interaction.';
    }

    update(dt) {
        // Smooth Camera Zoom
        this.currentCameraZ = THREE.MathUtils.lerp(this.currentCameraZ, this.targetCameraZ, 0.08);
        this.camera.position.z = this.currentCameraZ;

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
