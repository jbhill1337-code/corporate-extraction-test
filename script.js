/* ══════════════════════════════════════════════════════════════════════════
   FIREBASE CONFIG
═══════════════════════════════════════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyBvx5u1OGwS6YAvmVhBF9bstiUn-Vp6TVY",
  authDomain: "corporate-extraction.firebaseapp.com",
  databaseURL: "https://corporate-extraction-default-rtdb.firebaseio.com",
  projectId: "corporate-extraction",
  storageBucket: "corporate-extraction.firebasestorage.app",
  messagingSenderId: "184892788723",
  appId: "1:184892788723:web:93959fe24c883a27088c86"
};

let db, bossRef, employeesRef;
try {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    bossRef = db.ref('frank_corporate_data');
    employeesRef = db.ref('active_employees');
  }
} catch(e) { console.warn('Firebase offline:', e); }

const isOBS = new URLSearchParams(window.location.search).get('obs') === 'true';

/* ══ AUDIO SYSTEM ══════════════════════════════════════════════════════════ */
const bgm = new Audio('nocturnal-window-lights.mp3');
bgm.loop = true;
bgm.volume = 0.15;

const clickSfxFiles = ['sfx pack/Boss hit 1.wav', 'sfx pack/Bubble 1.wav', 'sfx pack/Hit damage 1.wav', 'sfx pack/Select 1.wav'];
const attackSounds = clickSfxFiles.map(file => { const audio = new Audio(encodeURI(file)); audio.volume = 0.3; return audio; });

function playClickSound() {
  try { const randomIdx = Math.floor(Math.random() * attackSounds.length); const sound = attackSounds[randomIdx].cloneNode(); sound.volume = 0.3; sound.play().catch(e => {}); } catch(e) {}
}

/* ══ LAYOUT FIX ═════════════════════════════════════════════════════════════ */
function injectStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
    #game-container {
      max-width: 1600px !important;
      margin: 0 auto !important;
      display: flex !important;
      flex-direction: column !important;
      padding: 10px !important;
      align-items: center !important;
      box-sizing: border-box !important;
    }
    #boss-name { width: 100% !important; text-align: center !important; }
    #game-wrapper {
      width: 100% !important;
      display: flex !important;
      flex-direction: row !important;
      gap: 15px !important;
      align-items: flex-start !important;
      justify-content: center !important;
    }
    #center-col {
      flex: 1 1 auto !important;
      min-width: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
    }
    .side-col { flex: 0 0 240px !important; width: 240px !important; }
    #boss-area {
      display: flex !important; align-items: flex-end !important;
      justify-content: center !important; gap: 60px !important;
      width: 100% !important; position: relative !important;
      overflow: visible !important; cursor: pointer !important;
      padding-bottom: 10px !important;
    }
    /* ── Strict uniform sprite boxes ── */
    .boss-char-wrapper {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      flex-shrink: 0 !important;
    }
    .boss-char-inner {
      width: 260px !important;
      height: 320px !important;
      display: flex !important;
      align-items: flex-end !important;
      justify-content: center !important;
      overflow: visible !important;
      position: relative !important;
      flex-shrink: 0 !important;
    }
    /* Single rule governing all boss/companion sprites — uniform, never clips */
    #boss-image, #companion-image {
      position: static !important;
      display: block !important;
      width: 260px !important;
      height: 320px !important;
      object-fit: contain !important;
      object-position: bottom center !important;
      image-rendering: pixelated !important;
      image-rendering: crisp-edges !important;
    }
    /* Hit layers sit on top, same box */
    #boss-hit-layer, #companion-hit-layer {
      position: absolute !important;
      bottom: 0 !important; left: 0 !important;
      width: 260px !important; height: 320px !important;
      object-fit: contain !important;
      object-position: bottom center !important;
      image-rendering: pixelated !important;
      pointer-events: none !important;
    }
    #richard-event-container {
      pointer-events: none; position: fixed;
      bottom: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 99999; overflow: hidden;
    }
    #richard-image {
      position: absolute; bottom: -5px; height: 30vh; width: auto;
      image-rendering: pixelated; opacity: 0;
      transition: opacity 1.2s ease, transform 1.2s ease;
      transform: translateX(-160px); object-fit: contain;
      filter: drop-shadow(0 0 15px #00ffff);
    }
    #richard-event-container.active #richard-image { opacity: 0.85; transform: translateX(0) !important; }
    #richard-dialogue {
      position: absolute; bottom: 30vh; padding: 10px 15px;
      background-color: rgba(0,0,0,0.92); color: #fff;
      border: 2px solid #00ffff; font-size: 1.1rem; max-width: 260px;
      text-align: center; text-transform: uppercase;
      opacity: 0; transform: scale(0.8);
      transition: opacity 0.5s 1.5s, transform 0.5s 1.5s;
      box-shadow: 4px 4px 0 #ff00ff; font-family: 'VT323', monospace;
      letter-spacing: 1px;
    }
    #richard-event-container.active #richard-dialogue { opacity: 1; transform: scale(1); }
    @media (max-width: 900px) {
      #game-wrapper { flex-direction: column !important; align-items: center !important; }
      .side-col { width: 100% !important; max-width: 400px !important; flex: none !important; }
      #boss-image, #companion-image { width: 180px !important; height: 220px !important; }
      .boss-char-inner { width: 180px !important; height: 220px !important; }
    }
  `;
  document.head.appendChild(style);
}

/* ══ GAME STATE ═════════════════════════════════════════════════════════════ */
let myCoins = 0, myClickDmg = 2500, myAutoDmg = 0, multi = 1, frenzy = 0;
let clickCost = 10, autoCost = 50, critChance = 0, critCost = 100, myUser = '', lastManualClick = 0;
let myInventory = {}, itemBuffMultiplier = 1.0, isAnimatingHit = false;
let overtimeUnlocked = false, synergyLevel = 0, rageFuelUnlocked = false, hustleCoinsPerClick = 0;
let phishLevel = 1;
// Scaling costs for premium upgrades (were static — now scale exponentially)
let synergyCost = 150, rageCost = 75, hustleCost = 30;

const daveHitFrames = ['assets/hit/dave-hit-1.png', 'assets/hit/dave-hit-2.png'];
const richHitFrames = ['assets/phases/rich/rich_hit_a.png', 'assets/phases/rich/rich_hit_b.png'];

const richardQuotes = [
  "SYNERGY IS KEY.", "LET'S CIRCLE BACK.", "LIVIN' THE DREAM.", "CHECK THE BACK ROOM.",
  "BANDWIDTH EXCEEDED.", "RESULTS SPEAK LOUDEST.", "WHO TOUCHED MY STAPLER?",
  "MAXIMIZE YOUR OUTPUT.", "LEVERAGE THE PIPELINE.", "GROWTH MINDSET, PEOPLE.",
  "FAILURE IS NOT OPTIMAL.", "PING ME ON SLACK.", "DISRUPT THE DISRUPTION.",
  "WE'RE A FAMILY HERE...", "QUARTERLY OR BUST.", "DELIVER VALUE, OR ELSE.",
  "THINK OUTSIDE THE BOX.", "MY DOOR IS ALWAYS CLOSED.", "SCALE IT, NOW."
];

// Companion speeds: Larry is slow/deliberate (security), Manny is fast (nervous intern)
const companions = {
  larry: { frames: ['chars/larry_frame1.png','chars/larry_frame2.png','chars/larry_frame3.png','chars/larry_frame4.png','chars/larry_frame5.png','chars/larry_frame6.png'], speed: 380 },
  manny: { frames: ['chars/manny_frame1.png','chars/manny_frame2.png','chars/manny_frame3.png','chars/manny_frame4.png','chars/manny_frame5.png','chars/manny_frame6.png'], speed: 130 }
};
let currentCompanion = companions.larry;
let frameIndex = 0;
let companionAnimTimer = null;
let currentBossIsDave = true;

function restartCompanionAnim() {
  if (companionAnimTimer) clearInterval(companionAnimTimer);
  companionAnimTimer = setInterval(() => {
    const compImg = document.getElementById('companion-image');
    if (compImg && !isAnimatingHit) {
      frameIndex = (frameIndex + 1) % currentCompanion.frames.length;
      compImg.src = currentCompanion.frames[frameIndex];
    }
  }, currentCompanion.speed);
}

/* ══ LOOT TABLE ═════════════════════════════════════════════════════════════ */
// Bonuses are now FLAT ADDITIVE % — not exponential multipliers.
// itemBuffMultiplier = 1.0 + sum(item.bonus * count) — prevents late-game snowball.
const lootTable = [
  { name: 'Coffee Mug',        emoji: '☕', rarity: 'common',    bonus: 0.03, desc: '+3% DMG'    },
  { name: 'Sticky Note',       emoji: '📝', rarity: 'common',    bonus: 0.03, desc: '+3% DMG'    },
  { name: 'USB Drive',         emoji: '💾', rarity: 'uncommon',  bonus: 0.06, desc: '+6% DMG'    },
  { name: 'Laser Pointer',     emoji: '🔴', rarity: 'uncommon',  bonus: 0.06, desc: '+6% DMG'    },
  { name: 'Energy Drink',      emoji: '⚡', rarity: 'uncommon',  bonus: 0.08, desc: '+8% DMG'    },
  { name: 'Gold Stapler',      emoji: '🔩', rarity: 'rare',      bonus: 0.12, desc: '+12% DMG'   },
  { name: 'VPN Token',         emoji: '🔐', rarity: 'rare',      bonus: 0.15, desc: '+15% DMG'   },
  { name: 'Employee of Month', emoji: '🏆', rarity: 'legendary', bonus: 0.25, desc: '+25% DMG'   },
  { name: 'Briefcase of Cash', emoji: '💼', rarity: 'legendary', bonus: 0.40, desc: '+40% DMG'   },
];

function rollLoot(x, y) {
  // Significantly rarer drops: ~15% chance total (was 60%)
  const roll = Math.random();
  let pool;
  if      (roll < 0.008) pool = lootTable.filter(i => i.rarity === 'legendary'); // 0.8% (was 3%)
  else if (roll < 0.030) pool = lootTable.filter(i => i.rarity === 'rare');      // 2.2% (was 9%)
  else if (roll < 0.090) pool = lootTable.filter(i => i.rarity === 'uncommon'); // 6%   (was 23%)
  else if (roll < 0.150) pool = lootTable.filter(i => i.rarity === 'common');   // 6%   (was 25%)
  else return; // 85% chance of nothing

  const item = pool[Math.floor(Math.random() * pool.length)];
  if (!myInventory[item.name]) myInventory[item.name] = { ...item, count: 0 };
  myInventory[item.name].count++;
  recalcItemBuff(); renderInventory(); save();

  const colorMap = { legendary: '#FFD700', rare: '#3498db', uncommon: '#2ecc71', common: '#fff' };
  const popup = document.createElement('div');
  popup.className = 'loot-popup';
  popup.innerText = item.emoji + ' ' + item.name + '!';
  const tx = (Math.random()-0.5)*120, ty = -80 - Math.random()*60, rot = (Math.random()-0.5)*20;
  popup.style.cssText = `left:${x}px;top:${y}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:${colorMap[item.rarity]};`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 3500);
}

function recalcItemBuff() {
  // ADDITIVE: itemBuffMultiplier = 1.0 + sum of (bonus * count) for each item
  // This is linear growth — avoids exponential snowball late game
  let totalBonus = 0;
  for (const key in myInventory) totalBonus += myInventory[key].bonus * myInventory[key].count;
  itemBuffMultiplier = 1.0 + totalBonus;
  const el = document.getElementById('loot-buff');
  if (el) el.innerText = Math.round(totalBonus * 100);
}

function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const key in myInventory) {
    const item = myInventory[key];
    const div = document.createElement('div');
    div.className = 'inv-item rarity-' + item.rarity;
    div.innerHTML = '<span style="font-size:24px">' + item.emoji + '</span><span class="inv-count">' + item.count + '</span><div class="inv-tooltip">' + item.name + '<br>' + item.desc + '</div>';
    grid.appendChild(div);
  }
}

/* ══ SYSTEM INIT ════════════════════════════════════════════════════════════ */
const introContainer = document.getElementById('intro-container');

function initSystem() {
  injectStyles();
  const bImg = document.getElementById('boss-image');
  const cImg = document.getElementById('companion-image');
  if (bImg) bImg.src = 'assets/phases/dave/dave_phase1.png';
  if (cImg) cImg.src = 'chars/larry_frame1.png';
  startRichardLoop();
  restartCompanionAnim();
  renderInventory();
  recalcItemBuff();
  if (myAutoDmg > 0) startAutoTimer();
}

/* ══ SKIP BUTTON & INTRO ═══════════════════════════════════════════════════ */
let ytPlayer = null;
let introEnded = false;

const endIntro = () => {
  if (introEnded) return;
  introEnded = true;

  // Stop & destroy YouTube player to kill its audio
  try { if (ytPlayer) { ytPlayer.stopVideo(); ytPlayer.destroy(); ytPlayer = null; } } catch(e) {}
  const ytEl = document.getElementById('yt-player');
  if (ytEl) { ytEl.src = ''; ytEl.style.display = 'none'; }

  // Glitch transition effect
  glitchTransition(() => {
    if (introContainer) introContainer.style.display = 'none';
    initSystem();
    load();
  });
};

function glitchTransition(callback) {
  // Create glitch overlay
  const glitch = document.createElement('div');
  glitch.id = 'glitch-overlay';
  glitch.style.cssText = `
    position:fixed; inset:0; z-index:99998; pointer-events:none;
    background:#000; opacity:0;
  `;
  document.body.appendChild(glitch);

  // Glitch canvas for scanline/color effects
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  glitch.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let frame = 0;
  const totalFrames = 40;

  const glitchColors = ['#ff00ff','#00ffff','#ffffff','#ff0000','#00ff00'];

  function drawGlitch(intensity) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const numSlices = Math.floor(4 + intensity * 12);
    for (let i = 0; i < numSlices; i++) {
      const y = Math.random() * canvas.height;
      const h = Math.random() * 30 * intensity + 2;
      const xShift = (Math.random() - 0.5) * 80 * intensity;
      const color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.random() * 0.6 * intensity;
      ctx.fillRect(xShift, y, canvas.width, h);
    }
    // scanlines
    ctx.globalAlpha = 0.15 * intensity;
    ctx.fillStyle = '#000';
    for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 2);
    ctx.globalAlpha = 1;
  }

  function animate() {
    frame++;
    const progress = frame / totalFrames;

    if (progress < 0.3) {
      // Phase 1: glitch builds up
      const intensity = progress / 0.3;
      glitch.style.opacity = intensity * 0.85;
      drawGlitch(intensity);
    } else if (progress < 0.6) {
      // Phase 2: white flash
      glitch.style.opacity = '1';
      glitch.style.background = '#fff';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawGlitch(1);
    } else if (progress < 0.7) {
      // Phase 3: snap to black
      glitch.style.background = '#000';
      glitch.style.opacity = '1';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (frame === Math.floor(totalFrames * 0.6) + 1) callback(); // trigger at black
    } else {
      // Phase 4: fade out glitch overlay
      const fadeOut = 1 - ((progress - 0.7) / 0.3);
      glitch.style.opacity = Math.max(0, fadeOut);
      drawGlitch(fadeOut);
      if (progress >= 1) { glitch.remove(); return; }
    }

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// Show skip button — but skip goes straight to glitch transition
(function() {
  const s = document.getElementById('skip-intro-btn');
  if (s) { s.style.display = 'block'; s.onclick = endIntro; }
})();

window.onYouTubeIframeAPIReady = function() {
  if (isOBS || !introContainer) return;
  ytPlayer = new YT.Player('yt-player', {
    videoId: 'HeKNgnDyD7I',
    playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, origin: window.location.origin },
    events: {
      onReady: (e) => {
        const btn = document.getElementById('start-intro-btn');
        if (btn) {
          btn.style.display = 'block';
          btn.onclick = () => {
            btn.style.display = 'none';
            document.getElementById('yt-player').style.display = 'block';
            e.target.playVideo();
          };
        }
      },
      onStateChange: (e) => {
        if (e.data === 0) endIntro(); // video ended naturally
      }
    }
  });
};
// NO auto-failsafe — video must play to completion or be skipped

/* ══ BOSS SYNC ══════════════════════════════════════════════════════════════ */
if (bossRef) {
  bossRef.on('value', snap => {
    let b = snap.val(); if (!b) return;
    if (b.health <= 0) return handleDefeat(b);
    const maxHP = 1000000000 * b.level;
    const isDave = (b.level % 2 !== 0);
    currentBossIsDave = isDave;
    currentBossLevel = b.level; // track for armor calc

    const cName = document.getElementById('companion-name');
    const bName = document.getElementById('main-boss-name');
    const armor = Math.round(getBossArmor() * 100);
    if (cName) cName.innerText = isDave ? 'Security Larry' : 'Intern Manny';
    if (bName) bName.innerText = (isDave ? 'VP Dave' : 'DM Rich') + ' · Lv.' + b.level + (armor > 0 ? ' 🛡️' + armor + '%' : '');

    const newComp = isDave ? companions.larry : companions.manny;
    if (newComp !== currentCompanion) {
      currentCompanion = newComp; frameIndex = 0; restartCompanionAnim();
      const cImg = document.getElementById('companion-image');
      if (cImg) cImg.src = currentCompanion.frames[0];
    }

    const bImg = document.getElementById('boss-image');
    if (bImg && !isAnimatingHit) {
      const phase = b.health / maxHP;
      const prefix = isDave ? 'assets/phases/dave/dave_phase' : 'assets/phases/rich/rich_phase';
      bImg.src = prefix + (phase <= 0.25 ? '4' : phase <= 0.50 ? '3' : phase <= 0.75 ? '2' : '1') + '.png';
    }

    const fill = document.getElementById('health-bar-fill');
    const txt = document.getElementById('health-text');
    if (fill) fill.style.width = (Math.max(0, b.health / maxHP) * 100) + '%';
    if (txt) txt.innerText = Math.max(0, b.health).toLocaleString() + ' / ' + maxHP.toLocaleString();
  });
}

function handleDefeat(b) {
  let nextLvl = b.level + 1;
  if (nextLvl > 10) {
    nextLvl = 1;
    const active = (Date.now() - lastManualClick) < 10000;
    myCoins += active ? 1000000 : 250000;
    const popup = document.createElement('div');
    popup.className = 'loot-popup';
    popup.innerText = active ? 'ACTIVE PRESTIGE! +1M COINS' : 'PRESTIGE! +250K COINS';
    popup.style.cssText = 'left:50%;top:50%;--tx:0px;--ty:-80px;--rot:0deg;';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 3500);
    updateUI();
  }
  bossRef.set({ level: nextLvl, health: 1000000000 * nextLvl });
}

/* ══ CHARGE METER LOOP ══════════════════════════════════════════════════════ */
setInterval(() => {
  frenzy = Math.max(0, frenzy - (rageFuelUnlocked ? 1 : 2));
  multi = frenzy >= 100 ? 5 : frenzy >= 75 ? 3 : frenzy >= 50 ? 2 : 1;
  const fill = document.getElementById('frenzy-bar-fill');
  const txt = document.getElementById('frenzy-text');
  if (fill) fill.style.width = frenzy + '%';
  if (txt) txt.innerText = multi > 1 ? 'COMBO ' + multi + 'x' : 'CHARGE METER';
  const md = document.getElementById('shop-multi-display');
  if (md) md.innerText = multi.toFixed(2);
}, 100);

/* ══ COMBAT ══════════════════════════════════════════════════════════════════ */

// Boss armor: scales with level. Level 1 = 0%, Level 5 = 20%, Level 9 = 50%
// Formula: armor = min(0.55, (level - 1) * 0.065)  — caps at 55% reduction
function getBossArmor() {
  if (!bossRef) return 0;
  // We read level from the last known Firebase snapshot stored in currentBossLevel
  return Math.min(0.55, Math.max(0, (currentBossLevel - 1) * 0.065));
}

// Track current boss level from Firebase updates
let currentBossLevel = 1;

function attack(e) {
  if (isOBS) return;
  lastManualClick = Date.now();
  playClickSound();

  if (!isAnimatingHit) {
    isAnimatingHit = true;
    const bArea = document.getElementById('boss-area');
    if (bArea) { bArea.style.filter = 'drop-shadow(0 0 30px rgba(255,0,0,0.4))'; setTimeout(() => bArea.style.filter = 'none', 300); }

    const bImg = document.getElementById('boss-image');
    if (bImg) {
      const old = bImg.src;
      const frames = currentBossIsDave ? daveHitFrames : richHitFrames;
      bImg.src = frames[Math.floor(Math.random() * frames.length)];
      bImg.style.transform = 'scale(1.05)';
      setTimeout(() => { bImg.src = old; bImg.style.transform = 'scale(1)'; }, 200);
    }

    setTimeout(() => {
      const cImg = document.getElementById('companion-image');
      if (cImg) { cImg.style.transform = 'scale(1.05)'; setTimeout(() => { cImg.style.transform = 'scale(1)'; isAnimatingHit = false; }, 200); }
    }, 100);
  }

  const isCrit = (Math.random() * 100) < critChance;
  const synergyBonus = 1 + (synergyLevel * 0.10);
  const armor = getBossArmor();
  const rawDmg = Math.floor(myClickDmg * multi * itemBuffMultiplier * synergyBonus * (isCrit ? 5 : 1));
  const dmg = Math.floor(rawDmg * (1 - armor));
  if (bossRef) bossRef.transaction(b => { if (b) b.health -= dmg; return b; });

  myCoins += (1 + hustleCoinsPerClick) * multi;
  frenzy = Math.min(100, frenzy + 8);
  updateUI(); save();

  const clickX = e.clientX || window.innerWidth / 2;
  const clickY = e.clientY || window.innerHeight / 2;
  const tx = (Math.random()-0.5)*100, ty = -60 - Math.random()*60, rot = (Math.random()-0.5)*20;
  const p = document.createElement('div');
  p.className = isCrit ? 'damage-popup crit-popup' : 'damage-popup';
  p.innerText = '+' + dmg.toLocaleString();
  p.style.cssText = 'left:' + clickX + 'px;top:' + clickY + 'px;--tx:' + tx + 'px;--ty:' + ty + 'px;--rot:' + rot + 'deg;';
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1200);

  // Loot drop ~2% per click (was 5%)
  if (Math.random() < 0.02) rollLoot(clickX, clickY - 80);
}

let autoTimer;
function startAutoTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    if (myAutoDmg > 0 && bossRef) {
      const armor = getBossArmor();
      const autoDmgReduced = Math.floor(myAutoDmg * (1 - armor));
      bossRef.transaction(b => { if (b) b.health -= autoDmgReduced; return b; });
    }
    if (Math.random() < 0.005) rollLoot(window.innerWidth / 2 + (Math.random()-0.5)*200, window.innerHeight * 0.4);
  }, overtimeUnlocked ? 600 : 1000);
}

/* ══ UI & SAVE ══════════════════════════════════════════════════════════════ */
function updateUI() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
  set('coin-count', myCoins.toLocaleString());
  set('click-power', myClickDmg.toLocaleString());
  set('auto-power', myAutoDmg.toLocaleString());
  set('crit-chance-display', critChance);
  set('loot-buff', Math.round((itemBuffMultiplier - 1) * 100));

  const bc = document.getElementById('buy-click');
  if (bc) bc.innerHTML = '⚔️ Sharpen Blade (+2.5k dmg)<br><span>Cost: ' + clickCost.toLocaleString() + '</span>';

  const ba = document.getElementById('buy-auto');
  if (ba) ba.innerHTML = '🪖 Hire Merc (+1k/s)<br><span>Cost: ' + autoCost.toLocaleString() + '</span>';

  const cr = document.getElementById('buy-crit');
  if (cr) cr.innerHTML = '🎯 Lucky Shot (+5% crit)<br><span class="cost-tag">Cost: ' + critCost.toLocaleString() + '</span>';

  const bo = document.getElementById('buy-overtime');
  if (bo) {
    if (overtimeUnlocked) {
      bo.innerHTML = '⏱️ Overtime (faster auto)<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';
      bo.style.opacity = '0.6'; bo.style.cursor = 'default';
    } else {
      bo.innerHTML = '⏱️ Overtime (faster auto)<br><span class="cost-tag">Cost: 200</span>';
      bo.style.opacity = '1'; bo.style.cursor = 'pointer';
    }
  }

  const bs = document.getElementById('buy-synergy');
  if (bs) bs.innerHTML = '⚡ Synergy Boost (+10% dmg)<br><span class="cost-tag">Lv.' + synergyLevel + ' · Cost: ' + synergyCost.toLocaleString() + '</span>';

  const br = document.getElementById('buy-rage');
  if (br) {
    if (rageFuelUnlocked) {
      br.innerHTML = '🔥 Rage Fuel (slower decay)<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';
      br.style.opacity = '0.6'; br.style.cursor = 'default';
    } else {
      br.innerHTML = '🔥 Rage Fuel (slower decay)<br><span class="cost-tag">Cost: ' + rageCost.toLocaleString() + '</span>';
      br.style.opacity = '1'; br.style.cursor = 'pointer';
    }
  }

  const bh = document.getElementById('buy-hustle');
  if (bh) bh.innerHTML = '💰 Side Hustle (+2 coins/click)<br><span class="cost-tag">Cost: ' + hustleCost.toLocaleString() + '</span>';
}

function save() {
  if (!isOBS) localStorage.setItem('gwm_v13', JSON.stringify({
    c: myCoins, cd: myClickDmg, ad: myAutoDmg, ac: autoCost, cc: clickCost,
    critC: critChance, critCost: critCost, u: myUser,
    inv: myInventory, ot: overtimeUnlocked, syn: synergyLevel, rf: rageFuelUnlocked, hc: hustleCoinsPerClick,
    sc: synergyCost, rc: rageCost, hcost: hustleCost
  }));
}

function load() {
  const s = localStorage.getItem('gwm_v13');
  if (s) {
    const d = JSON.parse(s);
    myCoins = d.c || 0; myClickDmg = d.cd || 2500; myAutoDmg = d.ad || 0;
    autoCost = d.ac || 50; clickCost = d.cc || 10; critChance = d.critC || 0;
    critCost = d.critCost || 100; myUser = d.u || '';
    myInventory = d.inv || {}; overtimeUnlocked = d.ot || false;
    synergyLevel = d.syn || 0; rageFuelUnlocked = d.rf || false; hustleCoinsPerClick = d.hc || 0;
    synergyCost = d.sc || 150; rageCost = d.rc || 75; hustleCost = d.hcost || 30;
    const u = document.getElementById('username-input'); if (u && myUser) u.value = myUser;
    recalcItemBuff(); renderInventory(); updateUI();
    if (myAutoDmg > 0) startAutoTimer();
  }
}

/* ══ RICHARD EVENT ══════════════════════════════════════════════════════════ */
let usedRichardQuotes = [];
function startRichardLoop() {
  setTimeout(() => {
    const c = document.getElementById('richard-event-container');
    const d = document.getElementById('richard-dialogue');
    const img = document.getElementById('richard-image');
    if (!c || !d || !img) { setTimeout(startRichardLoop, 5000); return; }

    // Pick quote without repeat until all used
    if (usedRichardQuotes.length >= richardQuotes.length) usedRichardQuotes = [];
    const available = richardQuotes.filter(q => !usedRichardQuotes.includes(q));
    const quote = available[Math.floor(Math.random() * available.length)];
    usedRichardQuotes.push(quote);
    d.innerText = quote;

    // Set image
    const imgs = ['yourbossvar/boss-crossing.png', 'yourbossvar/boss-pointing.png'];
    img.src = imgs[Math.floor(Math.random() * imgs.length)];
    img.style.display = 'block';

    // Pick side
    const fromLeft = Math.random() > 0.5;
    img.style.left = fromLeft ? '10px' : 'auto';
    img.style.right = fromLeft ? 'auto' : '10px';
    img.style.transform = fromLeft ? 'translateX(-160px)' : 'translateX(160px)';
    d.style.left = fromLeft ? '6vw' : 'auto';
    d.style.right = fromLeft ? 'auto' : '6vw';

    void c.offsetWidth; // force reflow
    c.classList.add('active');

    setTimeout(() => {
      c.classList.remove('active');
      setTimeout(startRichardLoop, 3000);
    }, 8000);
  }, 30000 + Math.random() * 20000);
}

/* ══ PHISHING MINIGAME ══════════════════════════════════════════════════════ */
const phishingEmails = [
  // Easy — obvious phishing
  { from: 'it-support@company-secure-login.biz', subject: 'URGENT: Your account will be DELETED!!!', body: 'Dear User,\n\nYour account has been flagged. You MUST verify immediately or face permanent termination.\n\nCLICK HERE: http://login.company-secure-login.biz/verify\n\n- IT Department', isPhish: true, tip: 'Fake domain, all-caps urgency, threats, suspicious link.' },
  { from: 'noreply@payroll.yourcompany.com', subject: 'Paystub for this period is ready', body: 'Hi,\n\nYour paystub for the current pay period is now available in the HR portal.\n\nLog in at hr.yourcompany.com to view it.\n\n- Payroll Team', isPhish: false, tip: 'Correct company domain, no urgency, no suspicious links.' },
  { from: 'ceo-message@corporat3.net', subject: 'Personal request from CEO Richard', body: 'Hello,\n\nThis is Richard. I need you to purchase $500 in Amazon gift cards for a client RIGHT NOW and send me the codes privately. Do not tell anyone.\n\n- Richard', isPhish: true, tip: 'Gift card scam. Wrong domain, secrecy demands, and "CEO" never legitimately asks for gift cards.' },
  { from: 'calendar@google.com', subject: 'Meeting: Q4 Planning - 3pm Today', body: 'You have been invited to a meeting:\n\nQ4 Budget Planning\nWhen: Today at 3:00 PM\nOrganizer: district.manager@yourcompany.com\n\nThis is a Google Calendar notification.', isPhish: false, tip: 'Legitimate Google Calendar notification. Real google.com domain.' },
  // Medium
  { from: 'security@your-company.support', subject: 'Multi-Factor Authentication Required', body: 'Your MFA token has expired. To maintain access:\n\nhttp://mfa-portal.your-company.support/enroll\n\nFailure to act within 24 hours will suspend your access.\n\n- Security Operations', isPhish: true, tip: 'Unofficial hyphened support domain, urgency pressure tactic.' },
  { from: 'helpdesk@yourcompany.com', subject: 'Password Expiry Notice - 5 Days Remaining', body: 'Your domain password will expire in 5 days.\n\nPlease update it at the IT Self-Service portal: https://helpdesk.yourcompany.com/password\n\n- IT Help Desk', isPhish: false, tip: 'Correct company domain, portal link matches, reasonable timeframe.' },
  { from: 'no-reply@microsoftonline-auth.com', subject: 'Sign in attempt blocked - Action Required', body: 'We detected unusual sign-in on your Microsoft 365 account.\n\nVerify it was you: https://microsoftonline-auth.com/verify?user=you\n\nAccess revoked in 1 hour if not reviewed.', isPhish: true, tip: '"microsoftonline-auth.com" is NOT microsoft.com — classic lookalike domain attack.' },
  { from: 'notifications@slack.com', subject: 'New message from Dave in #general', body: 'Dave posted in #general:\n\n"Hey team, sprint review is moved to Thursday. See the updated calendar invite."\n\nOpen Slack to reply.', isPhish: false, tip: 'Legitimate Slack notification from slack.com. No suspicious links or requests.' },
  { from: 'dropbox-share@dropbox-notifications.net', subject: 'Richard shared "Q4 Financial Summary.xlsx"', body: 'Richard Morris has shared a file with you on Dropbox.\n\nFile: Q4 Financial Summary.xlsx\nClick to view: https://dropbox-notifications.net/file/q4-financials\n\nThis link expires in 24 hours.', isPhish: true, tip: 'Real Dropbox emails come from dropbox.com, NOT dropbox-notifications.net.' },
  { from: 'accounting@yourcompany.com', subject: 'Invoice #INV-20241 - Approved for Payment', body: 'Hi team,\n\nInvoice #INV-20241 from Crestline Supplies has been approved.\n\nPayment of $3,240 will process Friday per net-30 terms.\n\nQuestions? Reply to this email.\n\n- Accounts Payable', isPhish: false, tip: 'Internal email, correct domain, no links, normal business process.' },
  // Medium-Hard
  { from: 'admin@yourcompany.com.phishkit.ru', subject: 'Benefits Enrollment Deadline - Today Only', body: 'Open Enrollment closes at midnight tonight.\n\nLog in: http://benefits-yourcompany.phishkit.ru/login\n\nHR will not be able to make exceptions.\n\n- Human Resources', isPhish: true, tip: 'The domain is "yourcompany.com.phishkit.ru" — the company name is just a subdomain on a Russian server!' },
  { from: 'it@yourcompany.com', subject: 'Scheduled System Maintenance - Saturday 2AM', body: 'Routine maintenance is scheduled for Saturday from 2:00 AM to 4:00 AM EST.\n\nSystems affected: VPN, email relay, internal wiki.\n\nNo action is required from you.\n\n- IT Infrastructure', isPhish: false, tip: 'Correct domain, no links, no urgency, no requests from you — textbook safe email.' },
  { from: 'support@yourcompany-hr-portal.com', subject: 'Your Direct Deposit Was Updated', body: 'Your direct deposit banking information was updated on 11/22.\n\nIf you did not authorize this, click to reverse it:\nhttps://yourcompany-hr-portal.com/revert-change\n\n- HR Portal Security', isPhish: true, tip: 'Fake domain (yourcompany-hr-portal.com ≠ yourcompany.com). Fear tactic about bank changes.' },
  { from: 'noreply@workday.com', subject: 'Action Required: Complete Your Performance Review', body: 'Hi,\n\nYour annual performance review is due by December 15th. Please log in to Workday to complete your self-evaluation.\n\nworkday.com/yourcompany\n\n- HR Team', isPhish: false, tip: 'Legitimate Workday notification. Correct domain, standard HR process, no urgency or threats.' },
  // Hard — nearly perfect fakes
  { from: 'david.zhang@yourcompany.com', subject: 'Fwd: Urgent Wire Transfer Request', body: 'Hey,\n\nI\'m in a meeting and can\'t call. Please wire $18,500 immediately:\n\nBank: First National\nRouting: 021000021\nAccount: 4928301847\n\nDon\'t discuss with anyone — it\'s time-sensitive.\n\nThanks,\nDave', isPhish: true, tip: 'Wire fraud — even from a legit-looking company address. Legitimate finance NEVER skips approval or demands secrecy.' },
  { from: 'noreply@github.com', subject: 'Security alert: new sign-in from unknown device', body: 'We noticed a new sign-in to your GitHub account:\n\nLocation: Amsterdam, Netherlands\nDevice: Chrome on Windows\n\nIf this wasn\'t you, secure your account at github.com/settings/security.\n\n- The GitHub Team', isPhish: false, tip: 'Legitimate GitHub security alert from github.com. Link points to the real GitHub domain.' },
  { from: 'aws-notifications@amazon.com', subject: 'AWS Billing Alert: Unusual activity detected', body: 'Your AWS account has been charged $847.32 this month — 340% higher than usual.\n\nReview usage at: console.aws.amazon.com/billing\n\nCheck for unauthorized resources.\n\n- AWS Billing', isPhish: false, tip: 'Legitimate AWS email from amazon.com. The link goes to the real AWS console subdomain.' },
  { from: 'alert@richm0rris-executive.com', subject: 'Confidential: Board Decision - All Staff', body: 'Effective immediately, all employees must confirm employment status via the link below or be removed from payroll.\n\nhttps://staff-confirm.richm0rris-executive.com/validate\n\nDo not share this with HR. This is confidential.\n\n- Executive Office', isPhish: true, tip: 'Zero ("0") instead of "o" in the domain. Fake authority + secrecy demands = major red flags.' },
  { from: 'finance@yourcompany.com', subject: 'Q3 Expense Report - Please Review and Sign', body: 'Hi,\n\nAttached is the Q3 expense summary for your department. Please review and submit your electronic signature by EOD Friday through our secure portal at hr.yourcompany.com/expenses.\n\nThanks,\nFinance Team', isPhish: false, tip: 'Correct internal domain, legitimate request with a real company portal link and reasonable deadline.' },
  { from: 'security-update@paypa1.com', subject: 'PayPal: Suspicious Transaction - Verify Now', body: 'Your PayPal account shows a suspicious transaction of $329.99 from Nigeria.\n\nSecure your account immediately:\nhttps://paypa1.com/secure-login\n\nThis will expire in 30 minutes.\n\n- PayPal Security', isPhish: true, tip: '"paypa1.com" uses the number 1 instead of the letter l. Classic homoglyph attack. Real PayPal = paypal.com.' },
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let phishPool = [], phishIndex = 0, phishScore = 0, phishTotal = 6;
let phishTimer = null, phishTimeLeft = 0, phishAnswered = false;

function setMikitaImg(variant) {
  // Updates ALL mikita images on the page (intro overlay + game header)
  const src = 'assets/chars/mikita_' + variant + '.png';
  document.querySelectorAll('#mikita-char-img').forEach(img => img.src = src);
}

function openPhishingGame() {
  phishPool = shuffleArray(phishingEmails).slice(0, phishTotal);
  phishIndex = 0; phishScore = 0; phishAnswered = false;

  const overlay = document.getElementById('phishing-game-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  const el = document.getElementById('phish-score'); if (el) el.innerText = '0 / ' + phishTotal;
  const rs = document.getElementById('phish-result-screen'); if (rs) rs.style.display = 'none';
  const btns = document.getElementById('phish-buttons'); if (btns) btns.style.display = 'flex';

  // Switch Mikita to terminal mode during the game
  setMikitaImg('terminal');

  loadPhishEmail();
}

function loadPhishEmail() {
  if (phishIndex >= phishPool.length) return endPhishGame();
  const email = phishPool[phishIndex];
  phishAnswered = false;

  // Slide in the email client with a fade
  const emailClient = document.querySelector('.email-client');
  if (emailClient) {
    emailClient.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    emailClient.style.opacity = '1';
    emailClient.style.transform = 'translateY(0)';
  }

  const s = document.getElementById('phish-sender'); if (s) s.innerText = email.from;
  const sub = document.getElementById('phish-subject'); if (sub) sub.innerText = email.subject;
  const body = document.getElementById('phish-body'); if (body) { body.innerText = email.body; body.style.opacity = '1'; }

  // Re-enable buttons
  const btns = document.getElementById('phish-buttons');
  if (btns) { btns.style.display = 'flex'; btns.style.pointerEvents = 'auto'; btns.style.opacity = '1'; }

  // Reset timer bar (no transition so it snaps to full instantly)
  const tf = document.getElementById('phish-timer-fill');
  if (tf) {
    tf.style.transition = 'none';
    tf.style.width = '100%';
    tf.style.backgroundColor = '#00ffcc';
    // Force reflow before re-enabling transition
    void tf.offsetWidth;
    tf.style.transition = 'width 0.1s linear, background-color 0.3s';
  }

  if (phishTimer) clearInterval(phishTimer);
  phishTimeLeft = 80;
  phishTimer = setInterval(() => {
    phishTimeLeft--;
    const pct = (phishTimeLeft / 80) * 100;
    if (tf) { tf.style.width = pct + '%'; tf.style.backgroundColor = pct < 30 ? '#ff4444' : pct < 60 ? '#ff8800' : '#00ffcc'; }
    if (phishTimeLeft <= 0) { clearInterval(phishTimer); if (!phishAnswered) answerPhish(null); }
  }, 100);
}

function answerPhish(userSaysPhish) {
  if (phishAnswered) return;
  phishAnswered = true;

  // Stop timer immediately — freeze the bar visually where it is
  if (phishTimer) clearInterval(phishTimer);
  phishTimer = null;

  const email = phishPool[phishIndex];
  const correct = userSaysPhish !== null && (userSaysPhish === email.isPhish);
  if (correct) phishScore++;

  // Update score
  const scoreEl = document.getElementById('phish-score');
  if (scoreEl) scoreEl.innerText = phishScore + ' / ' + phishTotal;

  // Freeze timer bar color to result color — no width change
  const tf = document.getElementById('phish-timer-fill');
  if (tf) {
    tf.style.transition = 'background-color 0.3s';
    tf.style.backgroundColor = correct ? '#00ff88' : '#ff4444';
  }

  // Disable buttons immediately to prevent double-clicks
  const btns = document.getElementById('phish-buttons');
  if (btns) { btns.style.pointerEvents = 'none'; btns.style.opacity = '0.4'; }

  // Fade out current email, show result, then fade in next
  const emailClient = document.querySelector('.email-client');
  if (emailClient) {
    emailClient.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    emailClient.style.opacity = '0';
    emailClient.style.transform = 'translateY(-8px)';
  }

  const bodyEl = document.getElementById('phish-body');
  const verdict = userSaysPhish === null ? '⏱️ TIMED OUT!' : correct ? '✅ CORRECT!' : '❌ WRONG!';
  const color = correct ? '#00aa55' : '#cc0000';
  const answer = email.isPhish ? '🚩 PHISHING' : '✅ LEGITIMATE';

  // After fade-out, show the result panel
  setTimeout(() => {
    if (emailClient) {
      emailClient.style.opacity = '1';
      emailClient.style.transform = 'translateY(0)';
    }
    if (bodyEl) {
      bodyEl.innerHTML =
        '<strong style="color:' + color + ';font-size:1.4em;display:block;margin-bottom:8px">' + verdict + '</strong>' +
        '<span style="color:#ccc;font-size:0.95em">💡 ' + email.tip + '</span>' +
        '<br><br><em style="color:#888;font-size:0.9em">This email was: ' + answer + '</em>';
    }
  }, 220);

  // After 2.5s total, slide out and load next
  setTimeout(() => {
    if (emailClient) {
      emailClient.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      emailClient.style.opacity = '0';
      emailClient.style.transform = 'translateY(8px)';
    }
    setTimeout(() => {
      phishIndex++;
      if (phishIndex >= phishPool.length) endPhishGame();
      else loadPhishEmail();
    }, 260);
  }, 2500);
}

function endPhishGame() {
  if (phishTimer) clearInterval(phishTimer);
  const btns = document.getElementById('phish-buttons'); if (btns) btns.style.display = 'none';
  const rs = document.getElementById('phish-result-screen'); if (rs) rs.style.display = 'block';
  const fm = document.getElementById('phish-final-msg');

  const pct = phishScore / phishTotal;
  let reward = 0, msg = '', mikitaVariant = 'instructor', mikitaLine = '';

  if (pct >= 0.85) {
    reward = 8000;
    msg = '🏆 ELITE ANALYST!\n' + phishScore + '/' + phishTotal + ' Correct!\n+' + reward.toLocaleString() + ' COINS!';
    mikitaVariant = 'instructor'; // proud instructor pose
    mikitaLine = '"Outstanding work. You just saved the company."';
  } else if (pct >= 0.67) {
    reward = 3000;
    msg = '✅ SOLID WORK!\n' + phishScore + '/' + phishTotal + ' Correct!\n+' + reward.toLocaleString() + ' Coins';
    mikitaVariant = 'idle'; // casual approval
    mikitaLine = '"Not bad. Keep your guard up out there."';
  } else if (pct >= 0.50) {
    reward = 800;
    msg = '⚠️ NEEDS TRAINING\n' + phishScore + '/' + phishTotal + ' Correct\n+' + reward + ' Coins';
    mikitaVariant = 'terminal'; // focused concern
    mikitaLine = '"We need to review the basics. Come back soon."';
  } else {
    reward = 0;
    msg = '❌ PHISHED!\n' + phishScore + '/' + phishTotal + ' Correct\nBetter luck next time...';
    mikitaVariant = 'terminal'; // serious face
    mikitaLine = '"...I\'m putting you on mandatory retraining."';
  }

  if (fm) fm.innerText = msg;

  // Swap Mikita image to match the result
  setMikitaImg(mikitaVariant);

  // Show Mikita's reaction line under the score
  let reactionEl = document.getElementById('phish-mikita-reaction');
  if (!reactionEl) {
    reactionEl = document.createElement('p');
    reactionEl.id = 'phish-mikita-reaction';
    reactionEl.style.cssText = 'color:#00ffff;font-size:1.1rem;margin:8px 0 12px;font-style:italic;text-align:center;';
    if (fm) fm.parentNode.insertBefore(reactionEl, fm.nextSibling);
  }
  reactionEl.innerText = mikitaLine;

  myCoins += reward; updateUI(); save();
}

/* ══ EVENT BINDING ══════════════════════════════════════════════════════════ */
function bindInteractions() {
  const bind = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

  bind('btn-clock-in', 'click', () => {
    const v = document.getElementById('username-input').value.trim().toUpperCase();
    if (v) {
      myUser = v;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('game-container').style.display = 'flex';
      if (employeesRef) employeesRef.push({ name: myUser, status: '💼' }).onDisconnect().remove();
      bgm.play().catch(() => {});
      if (myAutoDmg > 0) startAutoTimer();
      save();
    }
  });

  bind('btn-attack', 'pointerdown', attack);
  bind('boss-area', 'pointerdown', attack);

  bind('buy-click', 'click', () => { if (myCoins >= clickCost) { myCoins -= clickCost; myClickDmg += 2500; clickCost = Math.floor(clickCost * 1.5); updateUI(); save(); } });
  bind('buy-auto', 'click', () => { if (myCoins >= autoCost) { myCoins -= autoCost; myAutoDmg += 1000; autoCost = Math.floor(autoCost * 1.5); if (myAutoDmg === 1000) startAutoTimer(); updateUI(); save(); } });
  bind('buy-crit', 'click', () => { if (myCoins >= critCost) { myCoins -= critCost; critChance = Math.min(95, critChance + 5); critCost = Math.floor(critCost * 1.8); updateUI(); save(); } });
  bind('buy-overtime', 'click', () => { const cost = 200; if (myCoins >= cost && !overtimeUnlocked) { myCoins -= cost; overtimeUnlocked = true; if (myAutoDmg > 0) startAutoTimer(); updateUI(); save(); } });
  bind('buy-synergy', 'click', () => { if (myCoins >= synergyCost) { myCoins -= synergyCost; synergyLevel++; synergyCost = Math.floor(synergyCost * 1.8); updateUI(); save(); } });
  bind('buy-rage', 'click', () => { if (myCoins >= rageCost && !rageFuelUnlocked) { myCoins -= rageCost; rageFuelUnlocked = true; rageCost = Math.floor(rageCost * 2.0); updateUI(); save(); } });
  bind('buy-hustle', 'click', () => { if (myCoins >= hustleCost) { myCoins -= hustleCost; hustleCoinsPerClick += 2; hustleCost = Math.floor(hustleCost * 1.8); updateUI(); save(); } });

  bind('skill-phishing', 'click', () => {
    const o = document.getElementById('mikita-overlay');
    if (o) o.style.display = 'flex';
    setMikitaImg('idle'); // idle pose while explaining rules
    // Clear any leftover reaction line from last game
    const r = document.getElementById('phish-mikita-reaction');
    if (r) r.innerText = '';
  });
  bind('mikita-close', 'click', () => { const o = document.getElementById('mikita-overlay'); if (o) o.style.display = 'none'; });
  bind('mikita-start-game-btn', 'click', () => { const o = document.getElementById('mikita-overlay'); if (o) o.style.display = 'none'; openPhishingGame(); });

  bind('btn-legit', 'click', () => answerPhish(false));
  bind('btn-phish', 'click', () => answerPhish(true));
  bind('phish-close-btn', 'click', () => { const o = document.getElementById('phishing-game-overlay'); if (o) o.style.display = 'none'; });
  bind('skip-intro-btn', 'click', endIntro);

  if (isOBS) { initSystem(); load(); }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bindInteractions); }
else { bindInteractions(); }
