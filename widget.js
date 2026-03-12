console.log('✓ widget.js loaded');
if (window.addLog) addLog('✓ widget.js loaded');

// Check if Firebase is available
if (typeof firebase === 'undefined') {
  console.warn('⚠️ Firebase not loaded - running in offline mode');
  if (window.addLog) addLog('⚠️ Firebase not available');
}

const BASE_HEALTH = 1000000000;
let currentMaxHealth = BASE_HEALTH;
let previousHealth = BASE_HEALTH;
let lastLevel = 0;

const bossImageEl = document.getElementById('boss-image');
const healthFill = document.getElementById('health-bar-fill');
const healthText = document.getElementById('health-text');
const bossNameEl = document.getElementById('boss-name');
const damageZone = document.getElementById('damage-zone');
const dropsZone = document.getElementById('drops-zone');
const playersZone = document.getElementById('players-zone');
const statusEl = document.getElementById('status');

// Fallback placeholder image
const placeholderBg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23333" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23fff" font-size="20"%3ECleaning Manager Jim%3C/text%3E%3C/svg%3E';

if (bossImageEl) {
  bossImageEl.onerror = () => {
    bossImageEl.style.background = `url('${placeholderBg}') center/contain no-repeat`;
    console.warn('Boss image failed to load, using placeholder');
  };
}

const firebaseConfig = {
  apiKey: "AIzaSyBvx5u1OGwS6YAvmVhBF9bstiUn-Vp6TVY",
  authDomain: "corporate-extraction.firebaseapp.com",
  databaseURL: "https://corporate-extraction-default-rtdb.firebaseio.com",
  projectId: "corporate-extraction",
  storageBucket: "corporate-extraction.firebasestorage.app",
  messagingSenderId: "184892788723",
  appId: "1:184892788723:web:93959fe24c883a27088c86"
};

let db = null, bossRef = null, activeEmployeesRef = null;

try {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    bossRef = db.ref('frank_corporate_data');
    activeEmployeesRef = db.ref('active_employees');
    if (window.addLog) addLog('✓ Firebase initialized');
  }
} catch (e) {
  console.error('Firebase init error:', e);
  if (window.addLog) addLog('❌ Firebase error: ' + e.message);
}

// Firebase connection status
if (db && bossRef) {
  db.ref('.info/connected').on('value', (snapshot) => {
    if (snapshot.val() === true) {
      console.log('Firebase connected');
      if (healthText) healthText.innerText = 'Syncing...';
      if (statusEl) statusEl.innerHTML = '● <span style="color: #00ff00;">SYNCED</span>';
    } else {
      console.warn('Firebase disconnected');
      if (healthText) healthText.innerText = 'Connecting...';
      if (statusEl) statusEl.innerHTML = '● <span style="color: #ffaa00;">CONNECTING...</span>';
    }
  });

  // Boss listener
  bossRef.on('value', (snapshot) => {

let flashTimeout;
let damageHistory = [];
let playerHistory = new Map();
const MAX_DAMAGE_INDICATORS = 8;
const MAX_PLAYER_CARDS = 6;

// ──────────────────────────────────────────────────────────────
// BOSS HEALTH & PHASES
// ──────────────────────────────────────────────────────────────
bossRef.on('value', (snapshot) => {
  let boss = snapshot.val();
  if (!boss) return;

  if (lastLevel === 0) {
      lastLevel = boss.level;
  } else if (boss.level > lastLevel) {
      triggerVictoryScreen(boss.level);
      lastLevel = boss.level;
  }

  const currentLevel = boss.level;
  const currentHealth = boss.health;
  currentMaxHealth = BASE_HEALTH * currentLevel;

  const hpPercent = currentHealth / currentMaxHealth;
  let newTitle = "CLEANING MANAGER JIM — LV." + currentLevel;

  const percentage = Math.max(0, (currentHealth / currentMaxHealth) * 100);
  healthFill.style.width = percentage + '%';
  healthText.innerText = `${Math.floor(currentHealth).toLocaleString()} / ${currentMaxHealth.toLocaleString()}`;
  bossNameEl.innerText = newTitle;

  if (currentHealth < previousHealth && currentHealth > 0) {
    triggerHitAnimation();
  }
  previousHealth = currentHealth;
  });

  // Player activity listeners
  activeEmployeesRef.on('child_changed', (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;
    if (data && data.damage > 0) {
      addDamageIndicator(data.name, data.damage, key);
      spawnEmojiPopUp(data.emoji || '⚔️', data.name, data.damage);
      addPlayerCard(data.name, key);
    }
  });

  activeEmployeesRef.on('child_added', (snapshot) => {
    const data = snapshot.val();
    const key = snapshot.key;
    if (data && data.damage > 0 && (Date.now() - data.timestamp < 30000)) {
      addDamageIndicator(data.name, data.damage, key);
      spawnEmojiPopUp(data.emoji || '⚔️', data.name, data.damage);
      addPlayerCard(data.name, key);
    }
  });

  // Rare drops listener
  db.ref('rare_drops').on('child_added', (snapshot) => {
    const drop = snapshot.val();
    if (drop && Date.now() - drop.timestamp < 5000) {
      showDropNotification(drop.item, drop.rarity, drop.player);
    }
  });
} else {
  if (window.addLog) addLog('⚠️ Firebase unavailable - listeners skipped');
}

// ──────────────────────────────────────────────────────────────
// VICTORY SCREEN
// ──────────────────────────────────────────────────────────────
function triggerVictoryScreen(newLevel) {
    const vScreen = document.createElement('div');
    vScreen.style.position = 'fixed';
    vScreen.style.top = '0'; vScreen.style.left = '0';
    vScreen.style.width = '100vw'; vScreen.style.height = '100vh';
    vScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    vScreen.style.display = 'flex'; vScreen.style.flexDirection = 'column';
    vScreen.style.justifyContent = 'center'; vScreen.style.alignItems = 'center';
    vScreen.style.zIndex = '99999'; vScreen.style.fontFamily = 'monospace';
    vScreen.style.textAlign = 'center'; vScreen.style.textShadow = '3px 3px 0px #00ffff';

    vScreen.innerHTML = `
        <h1 style="font-size: 5rem; color: #ff00ff; margin: 0; text-transform: uppercase;">DEFEATED!</h1>
        <h2 style="font-size: 2rem; color: #fff; text-shadow: none;">JIM HAS BEEN FIRED...</h2>
        <p style="font-size: 1.5rem; color: #00ffff; text-shadow: none; margin-top: 20px;">NEXT BOSS INCOMING — LEVEL ${newLevel}</p>
    `;
    document.body.appendChild(vScreen);

    if(bossImageEl) bossImageEl.style.opacity = '0.3';

    setTimeout(() => {
        vScreen.style.transition = 'opacity 1s';
        vScreen.style.opacity = '0';
        if(bossImageEl) bossImageEl.style.opacity = '1';
        setTimeout(() => vScreen.remove(), 1000);
    }, 3000);
}

// ──────────────────────────────────────────────────────────────
// HIT ANIMATION
// ──────────────────────────────────────────────────────────────
function triggerHitAnimation() {
  if (!bossImageEl) return;
  clearTimeout(flashTimeout);

  bossImageEl.classList.add('boss-shake');

  flashTimeout = setTimeout(() => {
      bossImageEl.classList.remove('boss-shake');
  }, 200);
}

// ──────────────────────────────────────────────────────────────
// DAMAGE INDICATORS
// ──────────────────────────────────────────────────────────────
function addDamageIndicator(name, damage, id) {
  if (!damageZone) return;

  const el = document.createElement('div');
  el.className = 'damage-indicator';
  el.setAttribute('data-id', id);
  el.innerHTML = `<span>${name}</span><span class="damage-value">+${Math.floor(damage).toLocaleString()}</span>`;

  damageZone.insertBefore(el, damageZone.firstChild);

  // Keep only last N indicators
  const indicators = damageZone.querySelectorAll('.damage-indicator');
  if (indicators.length > MAX_DAMAGE_INDICATORS) {
    indicators[indicators.length - 1].remove();
  }

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (el.parentNode) el.remove();
  }, 3000);
}

// ──────────────────────────────────────────────────────────────
// PLAYER CARDS
// ──────────────────────────────────────────────────────────────
function addPlayerCard(name, id) {
  if (!playersZone) return;

  // Don't add if already exists
  if (playerHistory.has(id)) {
    return;
  }

  playerHistory.set(id, name);

  const el = document.createElement('div');
  el.className = 'player-card';
  el.setAttribute('data-id', id);
  el.innerHTML = `<span class="player-name">${name}</span>`;

  playersZone.appendChild(el);

  // Keep only last N players
  if (playerHistory.size > MAX_PLAYER_CARDS) {
    const firstKey = playerHistory.keys().next().value;
    playerHistory.delete(firstKey);
    const cardEl = playersZone.querySelector(`[data-id="${firstKey}"]`);
    if (cardEl) cardEl.remove();
  }
}

// ──────────────────────────────────────────────────────────────
// RARE DROPS
// ──────────────────────────────────────────────────────────────
// RARE DROPS
// ──────────────────────────────────────────────────────────────
function showDropNotification(item, rarity, player) {
  if (!dropsZone) return;

  const el = document.createElement('div');
  el.className = 'drop-notification';

  // Color code by rarity
  let rarityColor = '#00ffcc'; // Common
  if (rarity === 'rare') rarityColor = '#0099ff';
  if (rarity === 'epic') rarityColor = '#ff00ff';
  if (rarity === 'legendary') rarityColor = '#ffd700';

  el.style.borderColor = rarityColor;
  el.style.color = rarityColor;
  el.style.boxShadow = `0 0 25px ${rarityColor}`;
  el.innerHTML = `
    <div>🎁 RARE DROP!</div>
    <div class="drop-item">${item}</div>
    <div style="font-size: 1.1rem; margin-top: 5px;">${player}</div>
  `;

  dropsZone.insertBefore(el, dropsZone.firstChild);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (el.parentNode) {
      el.style.animation = 'fadeOut 0.5s ease-out forwards';
      setTimeout(() => el.remove(), 500);
    }
  }, 5000);
}

// ──────────────────────────────────────────────────────────────
// EMOJI POPUPS
// ──────────────────────────────────────────────────────────────
function spawnEmojiPopUp(emoji, name, damage) {
  const el = document.createElement('div');
  el.className = 'floating-emote animate-float';
  el.textContent = emoji;

  const x = 100 + Math.random() * (window.innerWidth - 200);
  const y = 100 + Math.random() * (window.innerHeight - 200);
  const rotation = -30 + Math.random() * 60;

  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--rot', rotation + 'deg');

  document.body.appendChild(el);

  setTimeout(() => el.remove(), 2000);
}

// Fade out animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    to { opacity: 0; transform: translateY(20px); }
  }
`;
document.head.appendChild(style);
