// --- Webhook & System Variables ---
const DEFAULT_WEBHOOK_URL = 'https://izayah-coronalled-maturely.ngrok-free.dev';
const WEBHOOK_STORAGE_KEY = 'te_demo_webhook_url';

let currentConfig = {
  difficulty: 'normal',
  event: 'none',
  promo_discount_rate: 50,
  promo_trigger_level: 3
};
let activePromoDiscountRate = 50;
let bridgeLastTs = 0;
let bridgeSeenPushId = '';
let bridgeArmedAt = 0;

const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20); // 240/20 = 12 cols, 400/20 = 20 rows

let score = 0;
let linesCleared = 0;
let totalLinesCleared = 0;

const matrix = createMatrix(12, 20);

const player = {
  pos: { x: 0, y: 0 },
  matrix: null,
};

const colors = [
  null,
  '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'
];

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  if (type === 'T') return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
  if (type === 'O') return [[2, 2], [2, 2]];
  if (type === 'L') return [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
  if (type === 'J') return [[0, 4, 0], [0, 4, 0], [4, 4, 0]];
  if (type === 'I') return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
  if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
  if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        context.fillStyle = colors[value];
        context.fillRect(x + offset.x, y + offset.y, 1, 1);
        context.lineWidth = 0.05;
        context.strokeStyle = 'rgba(0,0,0,0.5)';
        context.strokeRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function draw() {
  context.fillStyle = '#34495e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(matrix, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);
}

function merge(matrix, player) {
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        matrix[y + player.pos.y][x + player.pos.x] = value;
      }
    });
  });
}

function collide(matrix, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (matrix[y + o.y] && matrix[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

function playerDrop() {
  player.pos.y++;
  if (collide(matrix, player)) {
    player.pos.y--;
    merge(matrix, player);
    playerReset();
    arenaSweep();
  }
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(matrix, player)) {
    player.pos.x -= dir;
  }
}

function playerReset() {
  const pieces = 'ILJOTSZ';
  player.matrix = createPiece(pieces[pieces.length * Math.random() | 0]);
  player.pos.y = 0;
  player.pos.x = (matrix[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
  if (collide(matrix, player)) {
    matrix.forEach(row => row.fill(0));
    score = 0;
    linesCleared = 0;
    totalLinesCleared = 0;
    updateUI();
  }
}

function playerRotate() {
  const pos = player.pos.x;
  let offset = 1;
  rotateMatrix(player.matrix);
  while (collide(matrix, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotateMatrix(player.matrix, -1);
      player.pos.x = pos;
      return;
    }
  }
}

function rotateMatrix(matrix, dir = 1) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) matrix.forEach(row => row.reverse());
  else matrix.reverse();
}

function arenaSweep() {
  let rowCount = 1;
  let cleared = 0;
  outer: for (let y = matrix.length - 1; y > 0; --y) {
    for (let x = 0; x < matrix[y].length; ++x) {
      if (matrix[y][x] === 0) continue outer;
    }
    const row = matrix.splice(y, 1)[0].fill(0);
    matrix.unshift(row);
    ++y;
    score += rowCount * 10;
    rowCount *= 2;
    cleared++;
  }
  if (cleared > 0) {
    linesCleared += cleared;
    totalLinesCleared += cleared;
    updateUI();

    // SDK Track
    logEvent('line_clear', {
      lines: cleared,
      score_awarded: rowCount * 5,
      total_score: score,
      total_lines: totalLinesCleared
    });

    // TRIGGER logic - check if we reached trigger level equivalent
    if (totalLinesCleared >= currentConfig.promo_trigger_level) {
      logSystem(`🎯 <strong>Trigger Condition Met:</strong> ${totalLinesCleared} Lines 도달. TE 콘솔 발송 대기 상태`, '#c4b5fd');
      onClickStore();
      totalLinesCleared = 0; // reset for repeated triggers
    }
  }
}

function startGameLoop() {
  if (window._tetrisInterval) clearInterval(window._tetrisInterval);
  window._tetrisInterval = setInterval(() => {
    playerDrop();
    draw();
  }, 1000);
}

// --- Inputs ---
function moveLeft() { playerMove(-1); draw(); }
function moveRight() { playerMove(1); draw(); }
function moveDown() { playerDrop(); draw(); }
function rotate() { playerRotate(); draw(); }

document.addEventListener('keydown', event => {
  if (event.keyCode === 37) { playerMove(-1); draw(); }
  else if (event.keyCode === 39) { playerMove(1); draw(); }
  else if (event.keyCode === 40) { playerDrop(); draw(); }
  else if (event.keyCode === 38) { playerRotate(); draw(); }
  else if (event.keyCode === 32) {
    playerRotate();
    logEvent('block_rotate', { input_type: 'spacebar', current_score: score });
    draw();
  }
});

// --- Webhook / Engage / Base logic (adapted from original) ---

function extractClientParams(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.params && typeof payload.params === 'object') return payload.params;
  if (payload.properties && typeof payload.properties === 'object') return payload.properties;
  if (payload.content && typeof payload.content === 'object') return payload.content;
  return payload;
}

function applyClientChannelMessage(payload) {
  const params = extractClientParams(payload);
  const title = params.title || params.msg_title || '지금 구매 시 더 많은 스코어 인정';
  const body = params.body || params.msg_body || '라인 클리어 폭탄 50% 할인!';
  const cta = params.cta || params.button_text || '확인하기';
  const rate = Number(params.discount_rate);
  if (Number.isFinite(rate)) activePromoDiscountRate = rate;

  const popup = document.getElementById('promo-popup');
  const copy = document.getElementById('promo-copy');
  const ctaButton = popup ? popup.querySelector('.btn-cta') : null;
  const heading = popup ? popup.querySelector('h2') : null;

  if (heading) heading.innerText = title;
  if (copy) {
    if (Number.isFinite(rate)) copy.innerHTML = `${body}<br>할인율: <strong>${rate}%</strong>`;
    else copy.innerText = body;
  }
  if (ctaButton) ctaButton.innerText = cta;
  if (popup) {
    popup.style.display = 'flex';
    popup.classList.remove('popup-bounce');
    void popup.offsetWidth; // trigger reflow
    popup.classList.add('popup-bounce');
  }

  logSystem(`📩 <strong>Client Channel Received:</strong> title=${title}, cta=${cta}`, '#4ade80');
}

function handleStrategyTriggerMessage(result) {
  if (!result || typeof result !== 'object') return;
  const content = result.content && typeof result.content === 'object' ? result.content : {};
  const userParams = result.userParams && typeof result.userParams === 'object' ? result.userParams : {};
  const merged = Object.assign({}, content, userParams, {
    push_id: result.pushId,
    channel_msg_type: result.channelMsgType
  });
  applyClientChannelMessage(merged);
  logSystem(`🧩 <strong>TriggerListener:</strong> pushId=${result.pushId || 'n/a'}, channelMsgType=${result.channelMsgType || 'n/a'}`, '#34d399');
}

function flushPendingTriggerMessages() {
  if (!Array.isArray(window.__pendingTriggerMessages) || window.__pendingTriggerMessages.length === 0) return;
  const list = window.__pendingTriggerMessages.splice(0, window.__pendingTriggerMessages.length);
  list.forEach(handleStrategyTriggerMessage);
}

function getWebhookUrl() { return localStorage.getItem(WEBHOOK_STORAGE_KEY) || DEFAULT_WEBHOOK_URL; }

function getBridgeLatestUrl() {
  try { return `${new URL(getWebhookUrl()).origin}/latest`; }
  catch { return null; }
}

function setWebhookUrl(url) { localStorage.setItem(WEBHOOK_STORAGE_KEY, url); }

function renderWebhookUrl() {
  const input = document.getElementById('input-webhook-url');
  if (input) input.value = getWebhookUrl();
}

async function pollWebhookBridge() {
  const latestUrl = getBridgeLatestUrl();
  if (!latestUrl) return;
  try {
    const res = await fetch(`${latestUrl}?since=${bridgeLastTs}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.has_update) return;

    // Remove the bridgeArmedAt check that swallows valid payloads
    bridgeLastTs = Number(data.ts || Date.now());

    if (typeof logServerWebhook === 'function') {
      logServerWebhook(data.raw || data);
    }

    applyClientChannelMessage({ title: data.title, body: data.body, cta: data.cta, discount_rate: data.discount_rate });
  } catch (err) { }
}

function logServerWebhook(payload) {
  const container = document.getElementById('server-logs-content');
  if (!container) return;

  if (container.innerHTML.includes('Waiting for webhook...')) {
    container.innerHTML = '';
  }

  const time = new Date().toLocaleTimeString();

  // Extract key fields from TE webhook format
  let title = 'N/A';
  let body = 'N/A';
  let cta = 'N/A';
  let discount = 'N/A';

  try {
    const firstObj = Array.isArray(payload) ? payload[0] : payload;
    const params = firstObj.params || {};
    title = params.title || 'N/A';
    body = params.body || params.content || 'N/A';
    cta = params.cta || params.button_text || 'N/A';
    discount = params.discount_rate || 'N/A';
  } catch (e) { }

  const div = document.createElement('div');
  div.className = 'server-log-item';
  div.style.borderLeft = '4px solid #3b82f6';
  div.innerHTML = `
    <div class="server-log-time" style="color:#60a5fa; font-weight:bold;">🔔 [${time}] 웹훅 도착!</div>
    <div style="margin-top: 5px; color: #e2e8f0;">
      <div style="margin-bottom: 4px;"><span style="color:#94a3b8; width: 45px; display: inline-block;">제목:</span> <strong style="color: #fff;">${title}</strong></div>
      <div style="margin-bottom: 4px;"><span style="color:#94a3b8; width: 45px; display: inline-block;">본문:</span> <span style="color: #cbd5e1;">${body}</span></div>
      <div style="margin-bottom: 4px;"><span style="color:#94a3b8; width: 45px; display: inline-block;">버튼:</span> <span style="color: #fbbf24;">[${cta}]</span></div>
      <div><span style="color:#94a3b8; width: 45px; display: inline-block;">할인율:</span> <span style="color: #fca5a5;">${discount}</span></div>
    </div>
  `;
  container.prepend(div);
}

function startWebhookBridgePolling() { setInterval(pollWebhookBridge, 500); }

function logSystem(message, color) {
  const logContainer = document.getElementById('event-logs');
  if (!logContainer) {
    console.log(message.replace(/<[^>]*>?/gm, ''));
    return;
  }
  const logItem = document.createElement('div');
  logItem.className = 'log-item system';
  if (color) logItem.style.color = color;
  logItem.innerHTML = message;
  logContainer.prepend(logItem);
}

function logEvent(name, props) {
  if (window.ta) {
    window.ta.track(name, props);
    if (typeof window.ta.flush === 'function') window.ta.flush();
  }
  const logContainer = document.getElementById('event-logs');
  if (!logContainer) {
    console.log(`[Track] ${name}`, props);
    return;
  }
  const time = new Date().toLocaleTimeString();
  const logItem = document.createElement('div');
  logItem.className = 'log-item track';
  logItem.innerHTML = `[${time}] 🚀 <strong>ta.track</strong>('${name}', ${JSON.stringify(props)})`;
  logContainer.prepend(logItem);
}

window.onSDKLoad = function () {
  logSystem('✅ <strong>SDK Success:</strong> ThinkingData Web SDK가 정상 로드되었습니다.', '#22c55e');
  if (window.ta && typeof window.ta.getDistinctId === 'function') {
    logSystem(`🆔 <strong>Device Distinct ID:</strong> ${window.ta.getDistinctId()}`, '#a5b4fc');
  }
  if (getWebhookUrl() !== DEFAULT_WEBHOOK_URL) {
    setWebhookUrl(DEFAULT_WEBHOOK_URL);
    logSystem(`🧭 <strong>Webhook URL Auto-Fix:</strong> ${DEFAULT_WEBHOOK_URL}`, '#38bdf8');
  }
  renderWebhookUrl();
  updateUI();
  flushPendingTriggerMessages();
  bridgeArmedAt = 0; // Disabled to ensure webhooks are always processed
  void pollWebhookBridge();
  startWebhookBridgePolling();

  // Start Tetris
  playerReset();
  startGameLoop();
  draw();
};
window.onTriggerMessage = handleStrategyTriggerMessage;

function updateUI() {
  document.getElementById('score').innerText = score;
  document.getElementById('lines').innerText = linesCleared;
}

function onClickStore() {
  document.getElementById('store-modal').style.display = 'flex';
  logEvent('open_store', { current_score: score, lines: linesCleared });
}

function closeStore() { document.getElementById('store-modal').style.display = 'none'; }

function onBuyProduct(productId, price) {
  if (score >= price) {
    score -= price;
    updateUI();
    logEvent('item_purchase', { product_id: productId, price, status: 'success' });
    alert('구입 성공! 특수 블록/폭탄 획득');
    closeStore();
    return;
  }
  logEvent('item_purchase', { product_id: productId, price, status: 'failed', reason: 'insufficient_score' });
  alert('스코어가 부족합니다!');
  showEngagePopup('charge_offer', '점수가 부족하신가요?', '할인 패키지를 확인해보세요!');
}

function showEngagePopup(type, title, body) {
  const overlay = document.getElementById('engage-overlay');
  document.getElementById('engage-title').innerText = title;
  document.getElementById('engage-body').innerText = body;
  overlay.style.display = 'flex';
  logSystem(`🔔 <strong>Engage Triggered:</strong> ${type} 조건으로 인앱 메시지 노출`, '#93c5fd');
}

function closeEngage() { document.getElementById('engage-overlay').style.display = 'none'; }

function saveWebhookConfig() {
  const input = document.getElementById('input-webhook-url');
  const url = (input.value || '').trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) { alert('http:// 또는 https:// 로 시작해야 합니다.'); return; }
  setWebhookUrl(url);
  logSystem(`🌐 <strong>Webhook URL Updated:</strong> ${url}`);
  alert('Webhook URL 저장 완료');
}

function startSalesDemoMode() {
  setWebhookUrl(DEFAULT_WEBHOOK_URL);
  renderWebhookUrl();
  bridgeLastTs = 0;
  bridgeSeenPushId = '';
  bridgeArmedAt = Date.now();
  currentConfig.promo_trigger_level = 3; // For demo, trigger after 3 lines instead of 7
  logSystem('🚀 <strong>Sales Demo Mode:</strong> 데모 시작! 3줄 클리어 시 트리거 발동 설정완료', '#22c55e');
  void pollWebhookBridge();
}

function closePromo() {
  document.getElementById('promo-popup').style.display = 'none';
  onClickStore();
}

function applyPromo() {
  document.getElementById('promo-popup').style.display = 'none';
  const priceText = document.querySelector('.product-info p');
  const discountRate = activePromoDiscountRate;
  const originalPrice = 5000;
  const discountedPrice = originalPrice * (1 - discountRate / 100);

  if (priceText) {
    priceText.innerHTML = `<span style="text-decoration: line-through; color: #999;">${originalPrice} Score</span> <span style="color: #ef4444; font-weight: bold;">${discountedPrice.toLocaleString()} Score (${discountRate}%)</span>`;
  }
  logEvent('payment_push_click', { promo_id: 'special_discount', discount_rate: discountRate });
  logEvent('promo_applied', { promo_id: 'special_discount', discount_rate: discountRate, type: 'payment_push' });
  alert('패키지 적용 완료: 폭탄 가격이 할인되었습니다.');
  onClickStore();
}

function sendLineClearTwice() {
  const payload = { lines: 1, score_awarded: 10, total_score: score, total_lines: linesCleared + 1 };
  logEvent('line_clear', payload);
  logEvent('line_clear', payload);
  logSystem('⚡ <strong>Trigger Helper:</strong> line_clear 이벤트 2회 즉시 전송', '#f59e0b');
}

function force10Rotates() {
  for (let i = 0; i < 10; i++) {
    logEvent('block_rotate', { input_type: 'auto', current_score: score });
  }
  logSystem('⚡ <strong>Trigger Helper:</strong> block_rotate 이벤트 10회 즉시 전송 완료!', '#f59e0b');
}

function sendTriggerEvent() {
  logEvent('trigger_event', { input_type: 'manual', current_score: score });
  logSystem('🎯 <strong>Manual Trigger:</strong> trigger_event 이벤트 1회 전송 완료!', '#3b82f6');
}
