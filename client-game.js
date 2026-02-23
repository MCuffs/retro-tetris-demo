/* High-Quality Zelda Engine for TE SDK Multi-Instance A/B Testing */

const TILE_SIZE = 48; // Scaled up for higher res feel
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450; // Widescreen ratio

// Preload High-Quality Assets
const ASSETS = {
    bg: new Image(),
    heroA: new Image(), // User A Link
    heroB: new Image(), // User B Link
    chestClosed: new Image(),
    chestOpen: new Image()
};

// Using high-res placeholder image URLs representing the requested BotW/TotK style
ASSETS.bg.src = 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?q=80&w=1000&auto=format&fit=crop'; // Lush green forest/grassland background
ASSETS.heroA.src = 'https://cdn-icons-png.flaticon.com/512/3052/3052203.png'; // High-res Blue Knight/Hero icon
ASSETS.heroB.src = 'https://cdn-icons-png.flaticon.com/512/3052/3052192.png'; // High-res Green Knight/Hero icon
ASSETS.chestClosed.src = 'https://cdn-icons-png.flaticon.com/512/5109/5109670.png'; // High-res closed wooden chest
ASSETS.chestOpen.src = 'https://cdn-icons-png.flaticon.com/512/5109/5109647.png'; // High-res open glowing chest

class GameInstance {
    constructor(canvasId, logId, taInstance, controlScheme, heroImage) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.logContainer = document.getElementById(logId);
        this.ta = taInstance;
        this.heroImage = heroImage;

        // Internal Resolution (High-res 16:9)
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        // Visual display scaling handled by CSS
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.objectFit = 'cover';

        // Define controls
        this.keys = { up: false, down: false, left: false, right: false, action: false };
        this.controlScheme = controlScheme;

        // Game State
        this.hero = { x: 100, y: 200, w: 64, h: 64, speed: 6 };
        this.chest = { x: 500, y: 150, w: 80, h: 80, isOpen: false };
        this.lastActionTime = 0;

        // Start Loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    handleKeyDown(code) {
        if (code === this.controlScheme.up) this.keys.up = true;
        if (code === this.controlScheme.down) this.keys.down = true;
        if (code === this.controlScheme.left) this.keys.left = true;
        if (code === this.controlScheme.right) this.keys.right = true;

        if (code === this.controlScheme.action) {
            this.keys.action = true;
            this.tryInteract();
        }
    }

    handleKeyUp(code) {
        if (code === this.controlScheme.up) this.keys.up = false;
        if (code === this.controlScheme.down) this.keys.down = false;
        if (code === this.controlScheme.left) this.keys.left = false;
        if (code === this.controlScheme.right) this.keys.right = false;
        if (code === this.controlScheme.action) this.keys.action = false;
    }

    update() {
        if (this.keys.up) this.hero.y -= this.hero.speed;
        if (this.keys.down) this.hero.y += this.hero.speed;
        if (this.keys.left) this.hero.x -= this.hero.speed;
        if (this.keys.right) this.hero.x += this.hero.speed;

        // Boundaries matching internal resolution
        this.hero.x = Math.max(0, Math.min(this.canvas.width - this.hero.w, this.hero.x));
        this.hero.y = Math.max(0, Math.min(this.canvas.height - this.hero.h, this.hero.y));
    }

    tryInteract() {
        const now = Date.now();
        if (now - this.lastActionTime < 500) return; // debounce
        this.lastActionTime = now;

        // AABB Collision with Chest (expanded hitbox for easier interaction)
        const hit = (
            this.hero.x < this.chest.x + this.chest.w + 20 &&
            this.hero.x + this.hero.w > this.chest.x - 20 &&
            this.hero.y < this.chest.y + this.chest.h + 20 &&
            this.hero.y + this.hero.h > this.chest.y - 20
        );

        if (hit) {
            this.chest.isOpen = !this.chest.isOpen;
            if (this.chest.isOpen) {
                // UNIFIED EVENT NAME: Both instances fire exactly 'trigger_event' (or 'open_chest')
                // This ensures TE dashboard needs only 1 campaign config.
                const unifiedEventName = 'trigger_event';

                let nickname = this.ta && this.ta.name === 'userA' ? 'Link_A' : 'Zelda_B';

                this.logEvent(unifiedEventName, {
                    interaction: 'open_chest',
                    map_zone: 'hyrule_field',
                    hero_nickname: nickname
                });
                this.logSystem(`📦 여의주 상자를 열었습니다! (${unifiedEventName} 서버 발송)`);
            } else {
                this.logSystem('📦 상자를 닫았습니다.');
            }
        }
    }

    draw() {
        // Clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw High-Res Zelda Background (Image)
        if (ASSETS.bg.complete) {
            // Fill cover preserving aspect ratio manually
            this.ctx.drawImage(ASSETS.bg, 0, 0, this.canvas.width, this.canvas.height);
            // Draw a slight dark overlay to make sprites pop
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Fallback while loading
            this.ctx.fillStyle = '#4ade80';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 2. Draw Realistic Chest
        const chestImg = this.chest.isOpen ? ASSETS.chestOpen : ASSETS.chestClosed;

        // Draw shadow under chest
        this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(this.chest.x + this.chest.w / 2, this.chest.y + this.chest.h - 10, this.chest.w / 2, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        if (chestImg.complete) {
            // Add hover glow if close but not open
            if (!this.chest.isOpen) {
                const hit = (
                    this.hero.x < this.chest.x + this.chest.w + 20 && this.hero.x + this.hero.w > this.chest.x - 20 &&
                    this.hero.y < this.chest.y + this.chest.h + 20 && this.hero.y + this.hero.h > this.chest.y - 20
                );
                if (hit) {
                    this.ctx.shadowColor = '#fcd34d';
                    this.ctx.shadowBlur = 20;
                }
            }

            this.ctx.drawImage(chestImg, this.chest.x, this.chest.y, this.chest.w, this.chest.h);
            this.ctx.shadowBlur = 0; // reset
        } else {
            // Fallback rect
            this.ctx.fillStyle = this.chest.isOpen ? '#fcd34d' : '#854d0e';
            this.ctx.fillRect(this.chest.x, this.chest.y, this.chest.w, this.chest.h);
        }

        // Action Hint Text
        if (!this.chest.isOpen) {
            const hit = (
                this.hero.x < this.chest.x + this.chest.w + 20 && this.hero.x + this.hero.w > this.chest.x - 20 &&
                this.hero.y < this.chest.y + this.chest.h + 20 && this.hero.y + this.hero.h > this.chest.y - 20
            );
            if (hit) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 16px Outfit, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(this.ta.name === 'userA' ? 'Press E to Open' : 'Press SPACE to Open', this.chest.x + this.chest.w / 2, this.chest.y - 15);
                this.ctx.textAlign = 'left';
            }
        }

        // 3. Draw Hero (Detailed Image Sprite)
        // Draw hero shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(this.hero.x + this.hero.w / 2, this.hero.y + this.hero.h - 5, this.hero.w / 3, 8, 0, 0, Math.PI * 2);
        this.ctx.fill();

        if (this.heroImage && this.heroImage.complete) {
            // Bobbing animation when moving
            let walkOffset = 0;
            if (this.keys.up || this.keys.down || this.keys.left || this.keys.right) {
                walkOffset = Math.sin(Date.now() / 100) * 4;
            }

            // Flip horizontally if moving left
            if (this.keys.left) {
                this.ctx.save();
                this.ctx.translate(this.hero.x + this.hero.w, this.hero.y + walkOffset);
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(this.heroImage, 0, 0, this.hero.w, this.hero.h);
                this.ctx.restore();
            } else {
                this.ctx.drawImage(this.heroImage, this.hero.x, this.hero.y + walkOffset, this.hero.w, this.hero.h);
            }
        } else {
            // Fallback rect
            this.ctx.fillStyle = 'blue';
            this.ctx.fillRect(this.hero.x, this.hero.y, this.hero.w, this.hero.h);
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }

    logSystem(msg) {
        const item = document.createElement('div');
        item.className = 'log-entry log-system';
        item.innerText = `[SYS] ${msg}`;
        this.logContainer.prepend(item);
    }

    logEvent(eventName, props) {
        const time = new Date().toLocaleTimeString();
        const item = document.createElement('div');
        item.className = 'log-entry';
        item.innerText = `[${time}] TE.track("${eventName}")`;
        this.logContainer.prepend(item);

        if (this.ta) {
            this.ta.track(eventName, props);
            if (typeof this.ta.flush === 'function') this.ta.flush();
        }
    }
}

let gameA, gameB;

window.addEventListener('load', () => {
    // Determine TA Instances (Wait for SDK init)
    setTimeout(() => {
        const taA = window.taA || (window.thinkingdata && window.thinkingdata.userA) || null;
        const taB = window.taB || (window.thinkingdata && window.thinkingdata.userB) || null;

        gameA = new GameInstance(
            'canvasA', 'logsA', taA,
            { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'KeyE' },
            ASSETS.heroA
        );

        gameB = new GameInstance(
            'canvasB', 'logsB', taB,
            { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Space' },
            ASSETS.heroB
        );

        gameA.logSystem('Zelda Engine A Load Complete - W/A/S/D');
        gameB.logSystem('Zelda Engine B Load Complete - Arrows');
    }, 500);
});

// Global Keyboard Router
window.addEventListener('keydown', (e) => {
    // Prevent default scrolling for arrows and space
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
    }
    if (gameA) gameA.handleKeyDown(e.code);
    if (gameB) gameB.handleKeyDown(e.code);
});

window.addEventListener('keyup', (e) => {
    if (gameA) gameA.handleKeyUp(e.code);
    if (gameB) gameB.handleKeyUp(e.code);
});

// ==========================================
// TE SDK In-App Message (Trigger) Listeners
// ==========================================

// Both users listen for the exact same popup payload targeting their specific instance

window.onTriggerMessageA = function (result) {
    if (!result || !result.length) return;
    const msg = result[0];
    const params = msg.custom_params || {};

    document.getElementById('popupA-title').innerText = msg.title || params.title || 'Master Sword Discovered!';
    document.getElementById('popupA-body').innerText = msg.content || params.body || 'You have unlocked a legendary item.';
    document.getElementById('popupA-btn').innerText = msg.button_text || params.cta || 'Claim';

    const popup = document.getElementById('popupA');
    popup.style.display = 'flex';
    popup.classList.remove('popup-bounce');
    void popup.offsetWidth;
    popup.classList.add('popup-bounce');

    if (gameA) gameA.logSystem('🎉 A/B Pop-up (User A) Received via In-App Message', '#3b82f6');
};

window.onTriggerMessageB = function (result) {
    if (!result || !result.length) return;
    const msg = result[0];
    const params = msg.custom_params || {};

    document.getElementById('popupB-title').innerText = msg.title || params.title || 'Hylian Shield Discovered!';
    document.getElementById('popupB-body').innerText = msg.content || params.body || 'You have unlocked a legendary item.';
    document.getElementById('popupB-btn').innerText = msg.button_text || params.cta || 'Claim';

    const popup = document.getElementById('popupB');
    popup.style.display = 'flex';
    popup.classList.remove('popup-bounce');
    void popup.offsetWidth;
    popup.classList.add('popup-bounce');

    if (gameB) gameB.logSystem('🎉 A/B Pop-up (User B) Received via In-App Message', '#10b981');
};
