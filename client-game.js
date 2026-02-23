/* Zelda-style Mini Engine for TE SDK Multi-Instance A/B Testing */

const TILE_SIZE = 32;
const MAP_COLS = 20;
const MAP_ROWS = 10;

class GameInstance {
    constructor(canvasId, logId, taInstance, controlScheme, colorTheme) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.logContainer = document.getElementById(logId);
        this.ta = taInstance;
        this.colorTheme = colorTheme; // { hero: '#...', chest: '#...' }

        // Define controls
        this.keys = { up: false, down: false, left: false, right: false, action: false };
        this.controlScheme = controlScheme; // { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', action: 'KeyE' }

        // Setup Canvas Resolution
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Game State
        this.hero = { x: 2, y: 3, w: 24, h: 24, speed: 4 };
        this.chest = { x: 15, y: 5, w: TILE_SIZE, h: TILE_SIZE, isOpen: false };

        this.lastActionTime = 0;

        // Start Loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * 0.9;
        this.canvas.height = rect.height * 0.7;
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

        // Boundaries
        this.hero.x = Math.max(0, Math.min(this.canvas.width - this.hero.w, this.hero.x));
        this.hero.y = Math.max(0, Math.min(this.canvas.height - this.hero.h, this.hero.y));
    }

    tryInteract() {
        const now = Date.now();
        if (now - this.lastActionTime < 500) return; // debounce
        this.lastActionTime = now;

        // AABB Collision with Chest
        const hit = (
            this.hero.x < this.chest.x + this.chest.w &&
            this.hero.x + this.hero.w > this.chest.x &&
            this.hero.y < this.chest.y + this.chest.h &&
            this.hero.y + this.hero.h > this.chest.y
        );

        if (hit) {
            this.chest.isOpen = !this.chest.isOpen;
            if (this.chest.isOpen) {
                this.logEvent('trigger_event', { interaction: 'open_chest', map: 'forest' });
                this.logSystem('📦 상자를 열었습니다! (trigger_event 전송)');
            } else {
                this.logSystem('📦 상자를 닫았습니다.');
            }
        } else {
            this.logSystem('🗡️ 허공에 칼질 중...');
        }
    }

    draw() {
        // Clear
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Draw Retro Grass Background
        this.ctx.fillStyle = '#86efac'; // Base grass color
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Add grass texture details
        this.ctx.fillStyle = '#4ade80';
        for (let i = 0; i < this.canvas.width; i += TILE_SIZE) {
            for (let j = 0; j < this.canvas.height; j += TILE_SIZE) {
                if ((i + j) % 64 === 0) {
                    this.ctx.fillRect(i + 4, j + 4, 4, 8);
                    this.ctx.fillRect(i + 8, j + 8, 4, 4);
                }
            }
        }

        // 2. Draw Chest (Zelda Retro Style)
        const cx = this.chest.x;
        const cy = this.chest.y;
        const cw = this.chest.w;
        const ch = this.chest.h;

        if (this.chest.isOpen) {
            // Open Chest
            this.ctx.fillStyle = '#d97706'; // Dark wood inside
            this.ctx.fillRect(cx, cy, cw, ch);
            this.ctx.fillStyle = '#f59e0b'; // Light wood body
            this.ctx.fillRect(cx, cy + ch / 2, cw, ch / 2);
            this.ctx.fillStyle = '#fef3c7'; // Glowing item inside
            this.ctx.fillRect(cx + cw / 4, cy + ch / 4, cw / 2, cw / 2);

            this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
            this.ctx.font = 'bold 10px monospace';
            this.ctx.fillText('OPEN', cx, cy - 5);
        } else {
            // Closed Chest
            this.ctx.fillStyle = '#b45309'; // Main wood body
            this.ctx.fillRect(cx, cy, cw, ch);
            this.ctx.fillStyle = '#92400e'; // Lid shadow
            this.ctx.fillRect(cx, cy, cw, ch / 2);
            this.ctx.fillStyle = '#fcd34d'; // Gold lock
            this.ctx.fillRect(cx + cw / 2 - 4, cy + ch / 2 - 4, 8, 8);

            this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
            this.ctx.font = 'bold 10px monospace';
            this.ctx.fillText('CHEST', cx, cy - 5);
        }

        // 3. Draw Hero (Retro Link Style)
        const hx = this.hero.x;
        const hy = this.hero.y;

        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(hx + 12, hy + 22, 10, 4, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Tunic (Body)
        this.ctx.fillStyle = this.colorTheme.hero;
        this.ctx.fillRect(hx + 4, hy + 10, 16, 12);

        // Belt
        this.ctx.fillStyle = '#78350f';
        this.ctx.fillRect(hx + 4, hy + 16, 16, 4);
        this.ctx.fillStyle = '#fde047'; // Belt buckle
        this.ctx.fillRect(hx + 10, hy + 16, 4, 4);

        // Head/Face
        this.ctx.fillStyle = '#fcd34d'; // Skin tone
        this.ctx.fillRect(hx + 4, hy + 4, 16, 10);

        // Hat (Retro pointed hood overlapping)
        this.ctx.fillStyle = this.colorTheme.hero;
        this.ctx.beginPath();
        this.ctx.moveTo(hx + 0, hy + 8);
        this.ctx.lineTo(hx + 12, hy - 4);
        this.ctx.lineTo(hx + 24, hy + 8);
        this.ctx.fill();

        // Eyes (facing forward or looking down)
        this.ctx.fillStyle = '#1e293b';
        if (this.keys.down || (!this.keys.up && !this.keys.left && !this.keys.right)) {
            // Facing down
            this.ctx.fillRect(hx + 8, hy + 8, 2, 2);
            this.ctx.fillRect(hx + 14, hy + 8, 2, 2);
        } else if (this.keys.left) {
            this.ctx.fillRect(hx + 4, hy + 8, 2, 2);
        } else if (this.keys.right) {
            this.ctx.fillRect(hx + 18, hy + 8, 2, 2);
        } else if (this.keys.up) {
            // Back of head, no eyes
            this.ctx.fillStyle = this.colorTheme.hero;
            this.ctx.fillRect(hx + 4, hy + 4, 16, 10);
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
            { hero: '#2563eb' } // TE Blue
        );

        gameB = new GameInstance(
            'canvasB', 'logsB', taB,
            { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Space' },
            { hero: '#059669' } // TE Green
        );

        gameA.logSystem('게임 A 엔진 준비 완료 - W/A/S/D 키 조작');
        gameB.logSystem('게임 B 엔진 준비 완료 - 방향키 조작');
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

// User A Callback
window.onTriggerMessageA = function (result) {
    if (!result || !result.length) return;
    const msg = result[0];
    const params = msg.custom_params || {};

    document.getElementById('popupA-title').innerText = msg.title || params.title || '캠페인 도착';
    document.getElementById('popupA-body').innerText = msg.content || params.body || '내용 없음';
    document.getElementById('popupA-btn').innerText = msg.button_text || params.cta || '확인';

    const popup = document.getElementById('popupA');
    popup.style.display = 'flex';
    popup.classList.remove('popup-bounce');
    void popup.offsetWidth;
    popup.classList.add('popup-bounce');

    if (gameA) gameA.logSystem('🎉 캠페인 A 팝업이 트래킹 되었습니다!', '#3b82f6');
};

// User B Callback
window.onTriggerMessageB = function (result) {
    if (!result || !result.length) return;
    const msg = result[0];
    const params = msg.custom_params || {};

    document.getElementById('popupB-title').innerText = msg.title || params.title || '캠페인 도착';
    document.getElementById('popupB-body').innerText = msg.content || params.body || '내용 없음';
    document.getElementById('popupB-btn').innerText = msg.button_text || params.cta || '확인';

    const popup = document.getElementById('popupB');
    popup.style.display = 'flex';
    popup.classList.remove('popup-bounce');
    void popup.offsetWidth;
    popup.classList.add('popup-bounce');

    if (gameB) gameB.logSystem('🎉 캠페인 B 팝업이 트래킹 되었습니다!', '#10b981');
};
