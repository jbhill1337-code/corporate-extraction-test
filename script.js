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
      max-width: 1400px !important;
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
    .side-col { flex: 0 0 220px !important; width: 220px !important; }
    #boss-area {
      display: flex !important; align-items: flex-end !important;
      justify-content: center !important; gap: 40px !important;
      width: 100% !important; position: relative !important;
      overflow: visible !important; cursor: pointer !important;
    }
    #boss-image, #companion-image {
      height: 280px !important; width: auto !important;
      display: block !important; image-rendering: pixelated !important;
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
      #boss-image, #companion-image { height: 200px !important; }
    }
  `;
  document.head.appendChild(style);
}

/* ══ GAME STATE ═════════════════════════════════════════════════════════════ */
let myCoins = 0, myClickDmg = 2500, myAutoDmg = 0, multi = 1, frenzy = 0;
let clickCost = 10, autoCost = 50, critChance = 0, critCost = 100, myUser = '', lastManualClick = 0;
let myInventory = {}, itemBuffMultiplier = 1.0, isAnimatingHit = false;
let overtimeUnlocked = false, synergyLevel = 0, rageFuelUnlocked = false, hustleCoinsPerClick = 0;

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
const lootTable = [
  { name: 'Coffee Mug', emoji: '☕', rarity: 'common', bonus: 1.05, desc: '+5% DMG' },
  { name: 'Sticky Note', emoji: '📝', rarity: 'common', bonus: 1.05, desc: '+5% DMG' },
  { name: 'USB Drive', emoji: '💾', rarity: 'uncommon', bonus: 1.12, desc: '+12% DMG' },
  { name: 'Laser Pointer', emoji: '🔴', rarity: 'uncommon', bonus: 1.12, desc: '+12% DMG' },
  { name: 'Energy Drink', emoji: '⚡', rarity: 'uncommon', bonus: 1.15, desc: '+15% DMG' },
  { name: 'Gold Stapler', emoji: '🔩', rarity: 'rare', bonus: 1.25, desc: '+25% DMG' },
  { name: 'VPN Token', emoji: '🔐', rarity: 'rare', bonus: 1.30, desc: '+30% DMG' },
  { name: 'Employee of Month', emoji: '🏆', rarity: 'legendary', bonus: 1.50, desc: '+50% DMG' },
  { name: 'Briefcase of Cash', emoji: '💼', rarity: 'legendary', bonus: 2.00, desc: 'DOUBLE DMG' },
];

function rollLoot(x, y) {
  const roll = Math.random();
  let pool;
  if (roll < 0.03) pool = lootTable.filter(i => i.rarity === 'legendary');
  else if (roll < 0.12) pool = lootTable.filter(i => i.rarity === 'rare');
  else if (roll < 0.35) pool = lootTable.filter(i => i.rarity === 'uncommon');
  else if (roll < 0.60) pool = lootTable.filter(i => i.rarity === 'common');
  else return;

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
  itemBuffMultiplier = 1.0;
  for (const key in myInventory) itemBuffMultiplier *= Math.pow(myInventory[key].bonus, myInventory[key].count);
  const el = document.getElementById('loot-buff');
  if (el) el.innerText = Math.round((itemBuffMultiplier - 1) * 100);
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

    const cName = document.getElementById('companion-name');
    const bName = document.getElementById('main-boss-name');
    if (cName) cName.innerText = isDave ? 'Security Larry' : 'Intern Manny';
    if (bName) bName.innerText = (isDave ? 'VP Dave' : 'DM Rich') + ' · Lv.' + b.level;

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
  const dmg = Math.floor(myClickDmg * multi * itemBuffMultiplier * synergyBonus * (isCrit ? 5 : 1));
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

  // Loot drop ~5% per click
  if (Math.random() < 0.05) rollLoot(clickX, clickY - 80);
}

let autoTimer;
function startAutoTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    if (myAutoDmg > 0 && bossRef) bossRef.transaction(b => { if (b) b.health -= myAutoDmg; return b; });
    if (Math.random() < 0.02) rollLoot(window.innerWidth / 2 + (Math.random()-0.5)*200, window.innerHeight * 0.4);
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
  const bc = document.getElementById('buy-click'); if (bc) bc.innerHTML = '⚔️ Upgrade Click (+2.5k) <br><span>Cost: ' + clickCost + '</span>';
  const ba = document.getElementById('buy-auto'); if (ba) ba.innerHTML = 'Hire Merc (+1k/s) <br><span>Cost: ' + autoCost + '</span>';
  const cr = document.getElementById('buy-crit'); if (cr) cr.innerHTML = '🎯 Lucky Shot (+5% crit) <br><span class="cost-tag">Cost: ' + critCost + '</span>';
}

function save() {
  if (!isOBS) localStorage.setItem('gwm_v12', JSON.stringify({
    c: myCoins, cd: myClickDmg, ad: myAutoDmg, ac: autoCost, cc: clickCost,
    critC: critChance, critCost: critCost, u: myUser,
    inv: myInventory, ot: overtimeUnlocked, syn: synergyLevel, rf: rageFuelUnlocked, hc: hustleCoinsPerClick
  }));
}

function load() {
  const s = localStorage.getItem('gwm_v12');
  if (s) {
    const d = JSON.parse(s);
    myCoins = d.c || 0; myClickDmg = d.cd || 2500; myAutoDmg = d.ad || 0;
    autoCost = d.ac || 50; clickCost = d.cc || 10; critChance = d.critC || 0;
    critCost = d.critCost || 100; myUser = d.u || '';
    myInventory = d.inv || {}; overtimeUnlocked = d.ot || false;
    synergyLevel = d.syn || 0; rageFuelUnlocked = d.rf || false; hustleCoinsPerClick = d.hc || 0;
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

function openPhishingGame() {
  phishPool = shuffleArray(phishingEmails).slice(0, phishTotal);
  phishIndex = 0; phishScore = 0; phishAnswered = false;

  const overlay = document.getElementById('phishing-game-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  const el = document.getElementById('phish-score'); if (el) el.innerText = '0 / ' + phishTotal;
  const rs = document.getElementById('phish-result-screen'); if (rs) rs.style.display = 'none';
  const btns = document.getElementById('phish-buttons'); if (btns) btns.style.display = 'flex';

  loadPhishEmail();
}

function loadPhishEmail() {
  if (phishIndex >= phishPool.length) return endPhishGame();
  const email = phishPool[phishIndex];
  phishAnswered = false;

  const s = document.getElementById('phish-sender'); if (s) s.innerText = email.from;
  const sub = document.getElementById('phish-subject'); if (sub) sub.innerText = email.subject;
  const body = document.getElementById('phish-body'); if (body) body.innerText = email.body;

  const tf = document.getElementById('phish-timer-fill');
  if (tf) { tf.style.width = '100%'; tf.style.backgroundColor = '#00ffcc'; }

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
  if (phishTimer) clearInterval(phishTimer);

  const email = phishPool[phishIndex];
  const correct = userSaysPhish !== null && (userSaysPhish === email.isPhish);
  if (correct) phishScore++;

  const scoreEl = document.getElementById('phish-score');
  if (scoreEl) scoreEl.innerText = phishScore + ' / ' + phishTotal;

  const tf = document.getElementById('phish-timer-fill');
  if (tf) tf.style.backgroundColor = correct ? '#00ff88' : '#ff4444';

  const bodyEl = document.getElementById('phish-body');
  if (bodyEl) {
    const verdict = userSaysPhish === null ? '⏱️ TIMED OUT!' : correct ? '✅ CORRECT!' : '❌ WRONG!';
    const color = correct ? '#00aa55' : '#cc0000';
    const answer = email.isPhish ? '🚩 PHISHING' : '✅ LEGITIMATE';
    bodyEl.innerHTML = '<strong style="color:' + color + ';font-size:1.3em">' + verdict + '</strong>\n\n💡 ' + email.tip + '\n\n<em style="color:#888;">This email was: ' + answer + '</em>';
  }

  setTimeout(() => { phishIndex++; if (phishIndex >= phishPool.length) endPhishGame(); else loadPhishEmail(); }, 2500);
}

function endPhishGame() {
  if (phishTimer) clearInterval(phishTimer);
  const btns = document.getElementById('phish-buttons'); if (btns) btns.style.display = 'none';
  const rs = document.getElementById('phish-result-screen'); if (rs) rs.style.display = 'block';
  const fm = document.getElementById('phish-final-msg');

  const pct = phishScore / phishTotal;
  let reward = 0, msg = '';
  if (pct >= 0.85) { reward = 8000; msg = '🏆 ELITE ANALYST!\n' + phishScore + '/' + phishTotal + ' Correct!\n+' + reward.toLocaleString() + ' COINS!'; }
  else if (pct >= 0.67) { reward = 3000; msg = '✅ SOLID WORK!\n' + phishScore + '/' + phishTotal + ' Correct!\n+' + reward.toLocaleString() + ' Coins'; }
  else if (pct >= 0.50) { reward = 800; msg = '⚠️ NEEDS TRAINING\n' + phishScore + '/' + phishTotal + ' Correct\n+' + reward + ' Coins'; }
  else { reward = 0; msg = '❌ PHISHED!\n' + phishScore + '/' + phishTotal + ' Correct\nBetter luck next time...'; }

  if (fm) fm.innerText = msg;
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
  bind('buy-synergy', 'click', () => { const cost = 150; if (myCoins >= cost) { myCoins -= cost; synergyLevel++; updateUI(); save(); } });
  bind('buy-rage', 'click', () => { const cost = 75; if (myCoins >= cost && !rageFuelUnlocked) { myCoins -= cost; rageFuelUnlocked = true; updateUI(); save(); } });
  bind('buy-hustle', 'click', () => { const cost = 30; if (myCoins >= cost) { myCoins -= cost; hustleCoinsPerClick += 2; updateUI(); save(); } });

  bind('skill-phishing', 'click', () => { const o = document.getElementById('mikita-overlay'); if (o) o.style.display = 'flex'; });
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


/* ══════════════════════════════════════════════════════════════════════════
   FIREWALL MINIGAME MODULE (PLUG & PLAY ADDITION)
═══════════════════════════════════════════════════════════════════════════ */

// 1. Inject the HTML Overlay dynamically (No need to touch index.html)
document.body.insertAdjacentHTML('beforeend', `
  <div id="firewall-minigame-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:200000; flex-direction:column; align-items:center; justify-content:center;">
    <h2 style="color:#00ffcc; font-family:monospace; margin-bottom:10px; font-size:2rem; text-shadow: 0 0 10px #00ffcc;">🛡️ FIREWALL DEFENSE</h2>
    <p style="color:#fff; font-family:monospace; margin-bottom:20px;">Click the viruses before they infect the Mainframe! Survive 15 seconds.</p>
    
    <div id="firewall-arena" style="width:300px; height:300px; border:3px solid #00ffcc; border-radius:10px; position:relative; overflow:hidden; background:#111; cursor:crosshair; box-shadow: 0 0 20px rgba(0,255,204,0.2);">
        <div id="mainframe-core" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:50px; z-index:10; user-select:none;">🖥️</div>
    </div>
    
    <div style="margin-top:20px; color:#fff; font-family:monospace; font-size:1.2rem;">
      Integrity: <span id="firewall-hp" style="color:#ff4444; font-weight:bold;">3</span>/3 &nbsp;|&nbsp; Time: <span id="firewall-time" style="color:#00ffcc; font-weight:bold;">15</span>s
    </div>
    
    <button id="firewall-close-btn" style="margin-top:30px; padding:10px 30px; background:#ff4444; border:2px solid white; border-radius:5px; color:white; font-weight:bold; cursor:pointer; font-family:monospace;">ABORT SEQUENCE</button>
  </div>
`);

// 2. Minigame Variables
let firewallActive = false;
let firewallTimer = null;
let virusSpawner = null;
let virusMover = null;
let mainframeHP = 3;
let firewallTimeLeft = 15;
let firewallBuffActive = false;

// 3. The Minigame Logic
function startFirewallGame() {
  if (firewallActive) return;
  firewallActive = true;
  mainframeHP = 3;
  firewallTimeLeft = 15;
  
  document.getElementById('firewall-hp').innerText = mainframeHP;
  document.getElementById('firewall-time').innerText = firewallTimeLeft;
  document.getElementById('firewall-minigame-overlay').style.display = 'flex';
  
  const arena = document.getElementById('firewall-arena');
  document.querySelectorAll('.virus-icon').forEach(v => v.remove()); // Clear old viruses

  // Spawn Viruses from edges
  virusSpawner = setInterval(() => {
    if (!firewallActive) return;
    const virus = document.createElement('div');
    virus.className = 'virus-icon';
    virus.innerText = '👾';
    virus.style.position = 'absolute';
    virus.style.fontSize = '30px';
    virus.style.userSelect = 'none';
    
    // Pick a random edge (0:Top, 1:Right, 2:Bottom, 3:Left)
    const edge = Math.floor(Math.random() * 4);
    let startX, startY;
    if (edge === 0) { startX = Math.random() * 270; startY = -30; }
    else if (edge === 1) { startX = 300; startY = Math.random() * 270; }
    else if (edge === 2) { startX = Math.random() * 270; startY = 300; }
    else { startX = -30; startY = Math.random() * 270; }
    
    virus.style.left = startX + 'px';
    virus.style.top = startY + 'px';
    
    // Destroy virus on click
    virus.onpointerdown = (e) => {
      e.stopPropagation();
      virus.remove();
      if (typeof playClickSound === 'function') playClickSound();
    };
    
    arena.appendChild(virus);
  }, 600); // Spawns a virus every 0.6 seconds

  // Move Viruses toward the Mainframe (Center)
  virusMover = setInterval(() => {
    document.querySelectorAll('.virus-icon').forEach(v => {
      let x = parseFloat(v.style.left);
      let y = parseFloat(v.style.top);
      
      // Center of 300x300 arena is 150, minus half the font size (~15) = 135
      let dx = 135 - x;
      let dy = 135 - y;
      let dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < 15) {
        // Virus hit the mainframe!
        v.remove();
        mainframeHP--;
        document.getElementById('firewall-hp').innerText = mainframeHP;
        
        // Screen shake effect on hit
        arena.style.transform = 'translate(5px, 5px)';
        setTimeout(() => arena.style.transform = 'translate(0, 0)', 50);

        if (mainframeHP <= 0) endFirewallGame(false);
      } else {
        // Move speed multiplier (1.5)
        v.style.left = (x + (dx / dist) * 1.5) + 'px'; 
        v.style.top = (y + (dy / dist) * 1.5) + 'px';
      }
    });
  }, 30);

  // Time Limit Countdown
  firewallTimer = setInterval(() => {
    firewallTimeLeft--;
    document.getElementById('firewall-time').innerText = firewallTimeLeft;
    if (firewallTimeLeft <= 0) endFirewallGame(true);
  }, 1000);
}

function endFirewallGame(won) {
  firewallActive = false;
  clearInterval(firewallTimer);
  clearInterval(virusSpawner);
  clearInterval(virusMover);
  document.getElementById('firewall-minigame-overlay').style.display = 'none';
  
  if (won) {
    if (typeof createDynamicPopup === 'function') createDynamicPopup("FIREWALL UP! BOSS HEAL BLOCKED FOR 60s!", 'loot-popup', window.innerWidth/2, window.innerHeight/2);
    firewallBuffActive = true;
    
    // Visual indicator that the boss is debuffed
    const bArea = document.getElementById('boss-area');
    if(bArea) bArea.style.borderBottom = '5px solid #00ffcc';
    
    // Shield lasts 60 seconds
    setTimeout(() => { 
        firewallBuffActive = false; 
        if(bArea) bArea.style.borderBottom = 'none';
        if (typeof createDynamicPopup === 'function') createDynamicPopup("FIREWALL DOWN! BOSS HEALING RESTORED!", 'damage-popup', window.innerWidth/2, window.innerHeight/2);
    }, 60000);
  } else {
    if (typeof createDynamicPopup === 'function') createDynamicPopup("MAINFRAME BREACHED! DEFENSE FAILED.", 'damage-popup', window.innerWidth/2, window.innerHeight/2);
  }
}

// 4. Connect to your UI (Event Delegation)
document.addEventListener('click', (e) => {
  // Looks for a click on anything containing the word "Firewall" inside your skills panel
  if (e.target.closest('#skill-firewall') || (e.target.innerText && e.target.innerText.includes('Firewall'))) {
     startFirewallGame();
  }
  if (e.target.id === 'firewall-close-btn') {
     endFirewallGame(false);
  }
});

// 5. The Boss Healing Mechanic (Requires Firewall to stop)
setInterval(() => {
  if (typeof bossRef !== 'undefined' && bossRef && !firewallBuffActive && !isOBS) {
    bossRef.transaction(b => {
      // If boss is alive and not at max health, it heals 50,000 HP per second
      if (b && b.health > 0 && b.health < (1000000000 * b.level)) {
        b.health += 50000; 
      }
      return b;
    });
  }
}, 1000);
