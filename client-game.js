/* Dual Tetris for TE SDK A/B Testing */

class TetrisGame {
    constructor(instanceId, accountId, nickname, canvasId, logsId, scoreId, linesId, sdkInstance) {
        this.instanceId = instanceId;
        this.accountId = accountId;
        this.nickname = nickname;
        this.canvas = document.getElementById(canvasId);
        this.context = this.canvas.getContext('2d');
        this.logContainer = document.getElementById(logsId);
        this.scoreEl = document.getElementById(scoreId);
        this.linesEl = document.getElementById(linesId);
        this.sdkInstance = sdkInstance;

        // Tetris engine configuration
        this.context.scale(20, 20); // 240/12 = 20

        // Use custom colors depending on User A (Blue) or User B (Green)
        // Default Tetris Colors
        this.colors = [
            null,
            '#FF0D72', // T
            '#0DC2FF', // O
            '#0DFF72', // L
            '#F538FF', // J
            '#FF8E0D', // I
            '#FFE138', // S
            '#3877FF'  // Z
        ];

        // Specific color theme overrides for AB test distinction
        if (this.instanceId === 'A') {
            this.colors[2] = '#2563eb'; // blue O block
            this.colors[5] = '#60a5fa'; // lighter blue I block
            this.colors[7] = '#1e3a8a'; // darker blue Z block
        } else {
            this.colors[2] = '#059669'; // green O block
            this.colors[5] = '#34d399'; // lighter green I block
            this.colors[7] = '#064e3b'; // darker green Z block
        }

        this.matrix = this.createMatrix(12, 20);
        this.player = {
            pos: { x: 0, y: 0 },
            matrix: null,
            score: 0,
            linesCleared: 0,
            totalLinesCleared: 0
        };

        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;

        this.isActive = false;

        this.playerReset();
        this.updateScoreUI();
    }

    /* --- Tracking --- */
    trackEvent(eventName, props = {}, distinctIdOverride = null) {
        const time = new Date().toLocaleTimeString();
        const item = document.createElement('div');
        item.className = 'log-entry';
        item.innerHTML = `[${time}] 🚀 <strong>ta.track</strong>('${eventName}', ${JSON.stringify(props)})`;
        this.logContainer.prepend(item);

        if (this.sdkInstance) {
            // Context Switching: Identity
            if (distinctIdOverride) {
                this.sdkInstance.identify(distinctIdOverride);
                // When distinctId is explicitly provided, we clear login to prioritize the guest identity
                this.sdkInstance.logout();
            } else {
                this.sdkInstance.login(this.accountId);
            }

            this.sdkInstance.userSet({ nickname: this.nickname });
            this.sdkInstance.track(eventName, props);
            if (typeof this.sdkInstance.flush === 'function') this.sdkInstance.flush();
        }
    }

    logSystem(message) {
        const time = new Date().toLocaleTimeString();
        const item = document.createElement('div');
        item.className = 'log-entry log-system';
        item.innerHTML = `[${time}] ⚡ ${message}`;
        this.logContainer.prepend(item);
    }

    /* --- Core Engine --- */
    createMatrix(w, h) {
        const matrix = [];
        while (h--) matrix.push(new Array(w).fill(0));
        return matrix;
    }

    createPiece(type) {
        if (type === 'T') return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
        if (type === 'O') return [[2, 2], [2, 2]];
        if (type === 'L') return [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
        if (type === 'J') return [[0, 4, 0], [0, 4, 0], [4, 4, 0]];
        if (type === 'I') return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
        if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
        if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
    }

    drawMatrix(matrix, offset) {
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.context.fillStyle = this.colors[value];
                    this.context.fillRect(x + offset.x, y + offset.y, 1, 1);
                    // block inner border
                    this.context.fillStyle = 'rgba(0,0,0,0.1)';
                    this.context.fillRect(x + offset.x + 0.1, y + offset.y + 0.1, 0.8, 0.8);
                }
            });
        });
    }

    draw() {
        // clear with tetris grid color
        this.context.fillStyle = '#f8fafc';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // draw board
        this.drawMatrix(this.matrix, { x: 0, y: 0 });

        // draw current piece
        if (this.player.matrix) {
            this.drawMatrix(this.player.matrix, this.player.pos);
        }
    }

    merge() {
        this.player.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    this.matrix[y + this.player.pos.y][x + this.player.pos.x] = value;
                }
            });
        });
    }

    collide() {
        const m = this.player.matrix;
        const o = this.player.pos;
        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && (this.matrix[y + o.y] && this.matrix[y + o.y][x + o.x]) !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    playerDrop() {
        this.player.pos.y++;
        if (this.collide()) {
            this.player.pos.y--;
            this.merge();
            this.playerReset();
            this.arenaSweep();
            this.updateScoreUI();
        }
        this.dropCounter = 0;
    }

    playerMove(dir) {
        this.player.pos.x += dir;
        if (this.collide()) {
            this.player.pos.x -= dir;
        }
    }

    playerReset() {
        const pieces = 'ILJOTSZ';
        this.player.matrix = this.createPiece(pieces[pieces.length * Math.random() | 0]);
        this.player.pos.y = 0;
        this.player.pos.x = (this.matrix[0].length / 2 | 0) - (this.player.matrix[0].length / 2 | 0);

        if (this.collide()) {
            this.matrix.forEach(row => row.fill(0)); // game over, clear board
            this.trackEvent('game_over', {
                final_score: this.player.score,
                total_lines_cleared: this.player.totalLinesCleared
            });
            this.player.score = 0;
            this.player.linesCleared = 0;
            this.player.totalLinesCleared = 0;
            this.updateScoreUI();

            this.trackEvent('game_start', {
                initial_difficulty: 'normal',
                user_group: this.instanceId
            });
        }
    }

    playerRotate() {
        const pos = this.player.pos.x;
        let offset = 1;
        // transpose & reverse
        this.player.matrix.forEach((row, y) => {
            for (let x = 0; x < y; ++x) {
                [this.player.matrix[x][y], this.player.matrix[y][x]] = [this.player.matrix[y][x], this.player.matrix[x][y]];
            }
        });
        this.player.matrix.forEach(row => row.reverse());

        // Wall kick logic
        while (this.collide()) {
            this.player.pos.x += offset;
            offset = -(offset + (offset > 0 ? 1 : -1));
            if (offset > this.player.matrix[0].length) {
                // reverse if failed
                this.player.matrix.forEach(row => row.reverse());
                this.player.matrix.forEach((row, y) => {
                    for (let x = 0; x < y; ++x) {
                        [this.player.matrix[x][y], this.player.matrix[y][x]] = [this.player.matrix[y][x], this.player.matrix[x][y]];
                    }
                });
                this.player.pos.x = pos;
                return;
            }
        }

        // Custom Trigger Track
        this.trackEvent('block_rotate', {
            input_type: 'key',
            current_score: this.player.score
        });
    }

    arenaSweep() {
        let rowCount = 1;
        outer: for (let y = this.matrix.length - 1; y > 0; --y) {
            for (let x = 0; x < this.matrix[y].length; ++x) {
                if (this.matrix[y][x] === 0) continue outer;
            }

            // remove row
            const row = this.matrix.splice(y, 1)[0].fill(0);
            this.matrix.unshift(row);
            ++y;

            this.player.score += rowCount * 10;
            rowCount *= 2;
            this.player.linesCleared++;
            this.player.totalLinesCleared++;
        }

        if (this.player.linesCleared > 0) {
            this.trackEvent('line_clear', {
                lines_cleared_combo: this.player.linesCleared,
                current_score: this.player.score
            });
            this.player.linesCleared = 0;
        }
    }

    updateScoreUI() {
        if (this.scoreEl) this.scoreEl.innerText = this.player.score;
        if (this.linesEl) this.linesEl.innerText = this.player.totalLinesCleared;
    }

    // Input handlers
    handleInput(code) {
        if (this.instanceId === 'A') {
            switch (code) {
                case 'KeyA': this.playerMove(-1); break;
                case 'KeyD': this.playerMove(1); break;
                case 'KeyS': this.playerDrop(); break;
                case 'KeyW': this.playerRotate(); break;
                case 'Space': this.playerRotate(); break;
            }
        } else {
            switch (code) {
                case 'ArrowLeft': this.playerMove(-1); break;
                case 'ArrowRight': this.playerMove(1); break;
                case 'ArrowDown': this.playerDrop(); break;
                case 'ArrowUp': this.playerRotate(); break;
                case 'Enter': this.playerRotate(); break;
            }
        }
        this.draw();
    }

    update(time = 0) {
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.playerDrop();
            this.draw(); // draw update after drop
        }
    }
}

// Global Games
let gameA, gameB;
let lastTime = 0;

window.addEventListener('load', () => {
    // Wait slightly to ensure thinkingdata is loaded if async
    setTimeout(() => {
        gameA = new TetrisGame('A', 'user_a_tester', '유저A', 'canvasA', 'logsA', 'scoreA', 'linesA', window.ta_a ? window.ta_a : null);
        gameB = new TetrisGame('B', 'user_b_tester', '유저B', 'canvasB', 'logsB', 'scoreB', 'linesB', window.ta_b ? window.ta_b : null);

        gameA.trackEvent('game_start', { initial_difficulty: 'normal', user_group: 'A' });
        gameB.trackEvent('game_start', { initial_difficulty: 'normal', user_group: 'B' });

        gameA.draw();
        gameB.draw();

        // Start global animation loop
        requestAnimationFrame(gameLoop);
    }, 500);
});

function gameLoop(time) {
    if (gameA) gameA.update(time);
    if (gameB) gameB.update(time);
    requestAnimationFrame(gameLoop);
}

// Global Keyboard Listener
document.addEventListener('keydown', (e) => {
    // Prevent default scrolling for arrows and space
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }
    if (gameA) gameA.handleInput(e.code);
    if (gameB) gameB.handleInput(e.code);
});

// ==========================================
// Webhook Real-time Receiver (Polling)
// ==========================================
let bridgeLastTs = 0;

async function pollWebhookBridge() {
    try {
        const res = await fetch(`http://localhost:8788/latest?since=${bridgeLastTs}`, {
            method: 'GET',
            cache: 'no-store',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data || !data.has_update) return;

        bridgeLastTs = Number(data.ts || Date.now());
        console.log("🔥 Webhook received via Polling:", data);

        const params = data.params || {};

        // Extract target identifiers robustly (including push_id for dashboard test sends)
        const targetAccount = data.account_id || params.account_id || data.push_id || params.push_id;
        const targetDistinctId = data.distinct_id || params.distinct_id || data.push_id || params.push_id;
        const targetGroup = data.target_group || params.target_group || params.user_group;

        // Popup config extracted robustly
        const title = data.title || params.title || '축하합니다!';
        const body = data.body || params.body || params.reward_text || '보상을 획득했습니다!';
        const cta = data.cta || params.cta || params.button_text || '수령하기';
        const reward = data.discount_rate || params.reward_amount || params.discount_rate || '100';

        // Diagnostic logging for A/B testing routing
        console.log(`[Webhook Router] Parsing target payload...`);
        console.log(`[Webhook Router] Incoming: account=${targetAccount}, distinct=${targetDistinctId}, group=${targetGroup}`);

        const distA = gameA && gameA.sdkInstance ? gameA.sdkInstance.getDistinctId() : 'undefined';
        const distB = gameB && gameB.sdkInstance ? gameB.sdkInstance.getDistinctId() : 'undefined';
        console.log(`[Webhook Router] Current SDK States - A: ${distA} | B: ${distB}`);

        // Check if webhook is intended for User A
        let isUserA = targetGroup === 'A' || targetAccount === 'user_a_tester';
        if (targetDistinctId && distA === targetDistinctId) {
            isUserA = true;
            console.log(`[Webhook Router] Match resolving to A via distinct_id`);
        }

        // Check if webhook is intended for User B
        let isUserB = targetGroup === 'B' || targetAccount === 'user_b_tester';
        if (targetDistinctId && distB === targetDistinctId) {
            isUserB = true;
            console.log(`[Webhook Router] Match resolving to B via distinct_id`);
        }

        if (isUserA) {
            showWebhookPopup('popupA', title, body, reward, cta);
            if (gameA) {
                gameA.trackEvent('popup_open', {
                    popup_type: 'webhook_reward',
                    target_account: targetAccount || 'user_a_tester',
                    target_distinct_id: targetDistinctId || undefined
                }, targetDistinctId);
                gameA.logSystem(`웹훅 수신 완료 (User A)`);
            }
        } else if (isUserB) {
            showWebhookPopup('popupB', title, body, reward, cta);
            if (gameB) {
                gameB.trackEvent('popup_open', {
                    popup_type: 'webhook_reward',
                    target_account: targetAccount || 'user_b_tester',
                    target_distinct_id: targetDistinctId || undefined
                }, targetDistinctId);
                gameB.logSystem(`웹훅 수신 완료 (User B)`);
            }
        } else {
            // If no specific target is provided (e.g. generic dashboard test), display for User A (Primary) by default
            showWebhookPopup('popupA', title, body, reward, cta);
            if (gameA) {
                gameA.trackEvent('popup_open', {
                    popup_type: 'webhook_reward',
                    target_account: targetAccount || 'global_test',
                    target_distinct_id: targetDistinctId || undefined
                }, targetDistinctId);
                gameA.logSystem(`글로벌 웹훅 수신 완료 -> A 화면 표시`);
            }
        }
    } catch (err) {
        // silently ignore network poll errors
    }
}

// Start polling
setInterval(pollWebhookBridge, 1000);

function showWebhookPopup(popupId, title, body, reward, cta) {
    const titleEl = document.getElementById(popupId + '-title');
    const bodyEl = document.getElementById(popupId + '-body');
    const btnEl = document.getElementById(popupId + '-btn');

    if (titleEl) titleEl.innerText = title;
    if (bodyEl) bodyEl.innerHTML = `${body}<br><br><span style="color:var(--color-${popupId === 'popupA' ? 'a' : 'b'}); font-weight:bold;">${reward} Points</span>`;
    if (btnEl) btnEl.innerText = cta;

    document.getElementById(popupId).style.display = 'flex';
}

function closeWebhookPopup(popupId) {
    document.getElementById(popupId).style.display = 'none';

    const instance = popupId === 'popupA' ? gameA : gameB;
    if (instance) {
        instance.logSystem(`🎯 팝업 닫힘`);
    }
}
