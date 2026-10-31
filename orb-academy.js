/**
 * ============================================================================
 * ORB ACADEMY - Hand Control Academy & Training Arena
 * 8-step interactive training curriculum with real-time pose verification,
 * live checkmarks, animated illustrations, and dedicated practice mode
 * ============================================================================
 */

export class OrbAcademy {
    constructor(engine) {
        this.engine = engine;

        // Modal elements
        this.modal = document.getElementById('orb-academy-modal');
        this.btnClose = document.getElementById('btn-close-academy');
        this.btnOpen = document.getElementById('btn-open-academy');
        this.btnPrev = document.getElementById('academy-btn-prev');
        this.btnNext = document.getElementById('academy-btn-next');
        this.btnSkip = document.getElementById('academy-btn-skip');
        this.btnPractice = document.getElementById('academy-btn-practice');

        // Step content elements
        this.stepIndicator = document.getElementById('academy-step-num');
        this.stepTitle = document.getElementById('academy-step-title');
        this.stepDesc = document.getElementById('academy-step-desc');
        this.stepIcon = document.getElementById('academy-step-icon');
        this.stepStatus = document.getElementById('academy-detection-badge');
        this.stepDotsContainer = document.getElementById('academy-step-dots');

        // Practice Mode UI elements
        this.practiceBanner = document.getElementById('orb-practice-banner');
        this.btnExitPractice = document.getElementById('btn-exit-practice');

        this.currentStep = 0;
        this.isPracticeMode = false;
        this.stepCompleted = [false, false, false, false, false, false, false, false];

        // 8 Curriculum Steps
        this.steps = [
            {
                title: "1. Two-Hand Tracking",
                desc: "Raise both hands into camera view. Keep palms facing towards the screen at a comfortable distance.",
                icon: "👐",
                check: (hands, status) => (status.handsCount >= 2)
            },
            {
                title: "2. Stable Zoom In",
                desc: "Move your hands apart horizontally. Notice the universe camera smoothly gliding inward without drift.",
                icon: "↔️",
                check: (hands, status) => (status.state === 'ZOOMING' && status.zoomPercent > 110)
            },
            {
                title: "3. Stable Zoom Out",
                desc: "Bring your hands closer together. Notice the universe smoothly pulling back to a wider perspective.",
                icon: "🤏",
                check: (hands, status) => (status.state === 'ZOOMING' && status.zoomPercent < 90)
            },
            {
                title: "4. Cosmic Steering & Rotation",
                desc: "Move your hands like a steering wheel — one hand higher, one hand lower — to rotate the 3D scene smoothly with momentum.",
                icon: "🔄",
                check: (hands, status) => (status.state === 'ROTATING')
            },
            {
                title: "5. Relativistic Space Flight",
                desc: "Push both hands forward towards camera or pull back to engage warp travel through the stars.",
                icon: "🚀",
                check: (hands, status) => (Math.abs(status.travelSpeed) > 0.05)
            },
            {
                title: "6. Raycast Selection",
                desc: "Extend your index finger forward to point at any galaxy, planet, or cosmic gateway in 3D space.",
                icon: "☝️",
                check: (hands, status) => (hands && hands.length > 0 && !hands[0].isFist && !hands[0].isPinching)
            },
            {
                title: "7. Pinch & Hologram Inspect",
                desc: "Pinch thumb and index fingertips together on any celestial object to open its holographic scientific data card.",
                icon: "👌",
                check: (hands, status) => (status.state === 'GRABBING' || status.state === 'DRAGGING' || (hands && hands.some(h => h.isPinching)))
            },
            {
                title: "8. Universal Origin Reset",
                desc: "Close both hands into fists and bring them close together. Hold for half a second to snap camera back to origin.",
                icon: "✊✊",
                check: (hands, status) => (status.state === 'RESETTING')
            }
        ];

        this.init();
    }

    init() {
        if (this.btnClose && this.modal) {
            this.btnClose.addEventListener('click', () => this.close());
        }

        if (this.btnOpen) {
            this.btnOpen.addEventListener('click', () => this.open());
        }

        if (this.btnSkip) {
            this.btnSkip.addEventListener('click', () => this.close());
        }

        if (this.btnNext) {
            this.btnNext.addEventListener('click', () => {
                if (this.currentStep < this.steps.length - 1) {
                    this.goToStep(this.currentStep + 1);
                } else {
                    this.markCompleted();
                    this.close();
                }
            });
        }

        if (this.btnPrev) {
            this.btnPrev.addEventListener('click', () => {
                if (this.currentStep > 0) {
                    this.goToStep(this.currentStep - 1);
                }
            });
        }

        if (this.btnPractice) {
            this.btnPractice.addEventListener('click', () => {
                this.close();
                this.startPracticeMode();
            });
        }

        if (this.btnExitPractice) {
            this.btnExitPractice.addEventListener('click', () => {
                this.stopPracticeMode();
            });
        }

        this.renderDots();
        this.goToStep(0);

        // Auto-show on first visit if not completed
        try {
            const completed = localStorage.getItem('airdraw_academy_completed');
            if (!completed) {
                // Will show when user first enters Orb Mode
            }
        } catch (e) { }
    }

    renderDots() {
        if (!this.stepDotsContainer) return;
        this.stepDotsContainer.innerHTML = '';
        for (let i = 0; i < this.steps.length; i++) {
            const dot = document.createElement('span');
            dot.className = 'academy-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => this.goToStep(i));
            this.stepDotsContainer.appendChild(dot);
        }
    }

    goToStep(idx) {
        this.currentStep = Math.max(0, Math.min(this.steps.length - 1, idx));
        const step = this.steps[this.currentStep];

        if (this.stepIndicator) this.stepIndicator.textContent = `STEP ${this.currentStep + 1} OF ${this.steps.length}`;
        if (this.stepTitle) this.stepTitle.textContent = step.title;
        if (this.stepDesc) this.stepDesc.textContent = step.desc;
        if (this.stepIcon) this.stepIcon.textContent = step.icon;

        if (this.stepStatus) {
            if (this.stepCompleted[this.currentStep]) {
                this.stepStatus.className = 'academy-status verified';
                this.stepStatus.textContent = '✓ Gesture Verified';
            } else {
                this.stepStatus.className = 'academy-status pending';
                this.stepStatus.textContent = 'Awaiting Gesture...';
            }
        }

        if (this.stepDotsContainer) {
            const dots = this.stepDotsContainer.querySelectorAll('.academy-dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === this.currentStep);
                dot.classList.toggle('done', this.stepCompleted[i]);
            });
        }

        if (this.btnNext) {
            this.btnNext.textContent = (this.currentStep === this.steps.length - 1) ? 'Finish Academy' : 'Next Step →';
        }
    }

    open() {
        if (this.modal) {
            this.modal.classList.remove('hidden');
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    }

    markCompleted() {
        try {
            localStorage.setItem('airdraw_academy_completed', 'true');
        } catch (e) { }
        if (this.engine && this.engine.audio) {
            this.engine.audio.playCelebrationChime();
        }
    }

    /**
     * Called on every frame from OrbEngine to evaluate live pose feedback
     */
    evaluateFrame(handsData, trackingStatus) {
        if (!this.modal || this.modal.classList.contains('hidden')) return;

        const step = this.steps[this.currentStep];
        if (!step) return;

        const isMatch = step.check(handsData, trackingStatus);
        if (isMatch && !this.stepCompleted[this.currentStep]) {
            this.stepCompleted[this.currentStep] = true;
            if (this.stepStatus) {
                this.stepStatus.className = 'academy-status verified';
                this.stepStatus.textContent = '✓ Gesture Verified!';
            }
            if (this.engine && this.engine.audio) {
                this.engine.audio.playGrab();
            }
            if (this.stepDotsContainer) {
                const dots = this.stepDotsContainer.querySelectorAll('.academy-dot');
                if (dots[this.currentStep]) dots[this.currentStep].classList.add('done');
            }
        }
    }

    // ========================================================================
    // PRACTICE MODE / TRAINING ARENA
    // ========================================================================
    startPracticeMode() {
        this.isPracticeMode = true;
        if (this.practiceBanner) {
            this.practiceBanner.classList.remove('hidden');
        }

        // Switch engine to classic single target orb mode
        if (this.engine && this.engine.modesManager) {
            this.engine.modesManager.switchMode('classic');
        }
        if (this.engine && this.engine.sceneManager) {
            // Keep exactly 1 training sphere
            this.engine.sceneManager.orbs.forEach((orb, i) => {
                orb.visible = (i === 0);
                if (i === 0) {
                    orb.mesh.position.set(0, 0, 0);
                    orb.velocity.set(0, 0, 0);
                }
            });
        }
    }

    stopPracticeMode() {
        this.isPracticeMode = false;
        if (this.practiceBanner) {
            this.practiceBanner.classList.add('hidden');
        }
        if (this.engine && this.engine.modesManager) {
            this.engine.modesManager.switchMode('galaxy');
        }
    }
}
