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

/* ══ STRICT LAYOUT FIX (Restored the perfect sizing!) ══════════════════════ */
function injectStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
    #game-container { max-width: 1400px !important; margin: 0 auto !important; display: flex !important; flex-direction: column !important; padding: 10px !important; align-items: center !important; box-sizing: border-box !important; }
    #boss-name { width: 100% !important; text-align: center !important; }
    #game-wrapper { width: 100% !important; display: flex !important; flex-direction: row !important; gap: 15px !important; align-items: flex-start !important; justify-content: center !important; }
    #center-col { flex: 1 1 auto !important; min-width: 0 !important; display: flex !important; flex-direction: column !important; align-items: center !important; }
    .side-col { flex: 0 0 240px !important; width: 240px !important; }
    #boss-area { display: flex !important; align-items: flex-end !important; justify-content: center !important; gap: 60px !important; width: 100% !important; position: relative !important; overflow: visible !important; cursor: pointer !important; padding-bottom: 10px !important; transition: filter 0.3s ease; }
    
    /* Strict uniform sprite boxes */
    .boss-char-wrapper { display: flex !important; flex-direction: column !important; align-items: center !important; flex-shrink: 0 !important; }
    .boss-char-inner { width: 260px !important; height: 320px !important; display: flex !important; align-items: flex-end !important; justify-content: center !important; overflow: visible !important; position: relative !important; flex-shrink: 0 !important; }
    #boss-image, #companion-image { position: static !important; display: block !important; width: 260px !important; height: 320px !important; object-fit: contain !important; object-position: bottom center !important; image-rendering: pixelated !important; image-rendering: crisp-edges !important; }
    #boss-hit-layer, #companion-hit-layer { position: absolute !important; bottom: 0 !important; left: 0 !important; width: 260px !important; height: 320px !important; object-fit: contain !important; object-position: bottom center !important; image-rendering: pixelated !important; pointer-events: none !important; }
    
    #richard-event-container { pointer-events: none; position: fixed; bottom: 0; left: 0; width: 100vw; height: 100vh; z-index: 99999; overflow: hidden; }
    #richard-image { position: absolute; bottom: -5px; height: 30vh; width: auto; image-rendering: pixelated; opacity: 0; transition: opacity 1.2s ease, transform 1.2s ease; transform: translateX(-160px); object-fit: contain; filter: drop-shadow(0 0 15px #00ffff); }
    #richard-event-container.active #richard-image { opacity: 0.85; transform: translateX(0) !important; }
    #richard-dialogue { position: absolute; bottom: 30vh; padding: 10px 15px; background-color: rgba(0,0,0,0.92); color: #fff; border: 2px solid #00ffff; font-size: 1.1rem; max-width: 260px; text-align: center; text-transform: uppercase; opacity: 0; transform: scale(0.8); transition: opacity 0.5s 1.5s, transform 0.5s 1.5s; box-shadow: 4px 4px 0 #ff00ff; font-family: 'VT323', monospace; letter-spacing: 1px; }
    #richard-event-container.active #richard-dialogue { opacity: 1; transform: scale(1); }
    
    .enc-btn { font-size: 3rem; background: #222; border: 2px solid #00ffcc; border-radius: 10px; padding: 10px 20px; cursor: pointer; transition: transform 0.1s; box-shadow: 0 5px 0 #00aa88; }
    .enc-btn:active { transform: translateY(5px); box-shadow: 0 0 0 #00aa88; }
    
    @media (max-width: 900px) {
      #game-wrapper { flex-direction: column !important; align-items: center !important; }
      .side-col { width: 100% !important; max-width: 400px !important; flex: none !important; }
      #boss-image, #companion-image, .boss-char-inner { width: 180px !important; height: 220px !important; }
    }
  `;
  document.head.appendChild(style);
}

/* ══ GAME STATE ═════════════════════════════════════════════════════════════ */
let myCoins = 0, myClickDmg = 2500, myAutoDmg = 0, multi = 1, frenzy = 0;
let clickCost = 10, autoCost = 50, critChance = 0, critCost = 100, myUser = '', lastManualClick = 0;
let myInventory = {}, itemBuffMultiplier = 1.0, isAnimatingHit = false;
let overtimeUnlocked = false, synergyLevel = 0, rageFuelUnlocked = false, hustleCoinsPerClick = 0;
let synergyCost = 150, rageCost = 75, hustleCost = 30;

// Minigame Buffs
let firewallBuffActive = false;
let encryptionMultiplier = 1.0; 
let currentBossLevel = 1;

const daveHitFrames = ['assets/hit/dave-hit-1.png', 'assets/hit/dave-hit-2.png'];
const richHitFrames = ['assets/phases/rich/rich_hit_a.png', 'assets/phases/rich/rich_hit_b.png'];

const richardQuotes = [
  "SYNERGY IS KEY.", "LET'S CIRCLE BACK.", "LIVIN' THE DREAM.", "CHECK THE BACK ROOM.",
  "BANDWIDTH EXCEEDED.", "RESULTS SPEAK LOUDEST.", "WHO TOUCHED MY STAPLER?",
  "MAXIMIZE YOUR OUTPUT.", "LEVERAGE THE PIPELINE.", "GROWTH MINDSET, PEOPLE.",
  "FAILURE IS NOT OPTIMAL.", "PING ME ON SLACK.", "DISRUPT THE DISRUPTION."
];

const companions = {
  larry: { frames: ['assets/chars/larry_frame1.png','assets/chars/larry_frame2.png','assets/chars/larry_frame3.png','assets/chars/larry_frame4.png','assets/chars/larry_frame5.png','assets/chars/larry_frame6.png'], speed: 380 },
  manny: { frames: ['assets/chars/manny_frame1.png','assets/chars/manny_frame2.png','assets/chars/manny_frame3.png','assets/chars/manny_frame4.png','assets/chars/manny_frame5.png','assets/chars/manny_frame6.png'], speed: 130 }
};
let currentCompanion = companions.larry; let frameIndex = 0; let companionAnimTimer = null; let currentBossIsDave = true;

function restartCompanionAnim() {
  if (companionAnimTimer) clearInterval(companionAnimTimer);
  companionAnimTimer = setInterval(() => {
    const compImg = document.getElementById('companion-image');
    if (compImg && !isAnimatingHit) { frameIndex = (frameIndex + 1) % currentCompanion.frames.length; compImg.src = currentCompanion.frames[frameIndex]; }
  }, currentCompanion.speed);
}

/* ══ LOOT TABLE (Fixed the Drop Rates!) ════════════════════════════════════ */
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
  // If this function is called, you ARE getting an item. This determines the rarity.
  const roll = Math.random(); 
  let pool;
  if      (roll < 0.05) pool = lootTable.filter(i => i.rarity === 'legendary'); // 5% chance 
  else if (roll < 0.20) pool = lootTable.filter(i => i.rarity === 'rare');      // 15% chance
  else if (roll < 0.50) pool = lootTable.filter(i => i.rarity === 'uncommon');  // 30% chance
  else pool = lootTable.filter(i => i.rarity === 'common');                     // 50% chance

  const item = pool[Math.floor(Math.random() * pool.length)];
  if (!myInventory[item.name]) myInventory[item.name] = { ...item, count: 0 };
  myInventory[item.name].count++;
  recalcItemBuff(); renderInventory(); save();

  const colorMap = { legendary: '#FFD700', rare: '#3498db', uncommon: '#2ecc71', common: '#fff' };
  const popup = document.createElement('div'); popup.className = 'loot-popup'; popup.innerText = item.emoji + ' ' + item.name + '!';
  const tx = (Math.random()-0.5)*120, ty = -80 - Math.random()*60, rot = (Math.random()-0.5)*20;
  popup.style.cssText = `left:${x}px;top:${y}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:${colorMap[item.rarity]};`;
  document.body.appendChild(popup); setTimeout(() => popup.remove(), 3500);
}

function recalcItemBuff() {
  let totalBonus = 0; for (const key in myInventory) totalBonus += myInventory[key].bonus * myInventory[key].count;
  itemBuffMultiplier = 1.0 + totalBonus;
  const el = document.getElementById('loot-buff'); if (el) el.innerText = Math.round(totalBonus * 100);
}

function renderInventory() {
  const grid = document.getElementById('inventory-grid'); if (!grid) return; grid.innerHTML = '';
  for (const key in myInventory) {
    const item = myInventory[key]; const div = document.createElement('div'); div.className = 'inv-item rarity-' + item.rarity;
    div.innerHTML = '<span style="font-size:24px">' + item.emoji + '</span><span class="inv-count">' + item.count + '</span><div class="inv-tooltip">' + item.name + '<br>' + item.desc + '</div>';
    grid.appendChild(div);
  }
}

/* ══ SYSTEM INIT & SKILL UNLOCKER ══════════════════════════════════════════ */
const introContainer = document.getElementById('intro-container');

function initSystem() {
  injectStyles();
  injectMinigameHTML(); // Load Minigame screens safely
  
  // Dynamically convert "Coming Soon" slots to active minigames
  const skillSlots = document.querySelectorAll('.skill-slot');
  if(skillSlots.length > 3) {
      skillSlots[1].classList.remove('skill-locked'); skillSlots[1].classList.add('skill-active');
      skillSlots[1].id = 'skill-firewall'; skillSlots[1].querySelector('.skill-level').innerText = 'Lv.1';
      skillSlots[1].title = 'Block boss healing!';
      
      skillSlots[3].classList.remove('skill-locked'); skillSlots[3].classList.add('skill-active');
      skillSlots[3].id = 'skill-encryption'; skillSlots[3].querySelector('.skill-level').innerText = 'Lv.1';
      skillSlots[3].title = 'Break code for 3x DMG!';
  }

  const bImg = document.getElementById('boss-image'); const cImg = document.getElementById('companion-image');
  if (bImg) bImg.src = 'assets/phases/dave/dave_phase1.png';
  if (cImg) cImg.src = 'assets/chars/larry_frame1.png';
  startRichardLoop(); restartCompanionAnim(); renderInventory(); recalcItemBuff();
  if (myAutoDmg > 0) startAutoTimer();
}

/* ══ SKIP BUTTON & INTRO (GLITCH RESTORED + YOUTUBE FIX) ═══════════════════ */
let ytPlayer = null; let introEnded = false;

const endIntro = () => {
  if (introEnded) return; introEnded = true;
  try { if (ytPlayer) { ytPlayer.stopVideo(); ytPlayer.destroy(); ytPlayer = null; } } catch(e) {}
  const ytEl = document.getElementById('yt-player'); if (ytEl) { ytEl.src = ''; ytEl.style.display = 'none'; }
  
  glitchTransition(() => {
    if (introContainer) introContainer.style.display = 'none';
    initSystem(); load();
  });
};

function glitchTransition(callback) {
  const glitch = document.createElement('div');
  glitch.id = 'glitch-overlay';
  glitch.style.cssText = `position:fixed; inset:0; z-index:99998; pointer-events:none; background:#000; opacity:0;`;
  document.body.appendChild(glitch);

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  glitch.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let frame = 0; const totalFrames = 40;
  const glitchColors = ['#ff00ff','#00ffff','#ffffff','#ff0000','#00ff00'];

  function drawGlitch(intensity) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const numSlices = Math.floor(4 + intensity * 12);
    for (let i = 0; i < numSlices; i++) {
      const y = Math.random() * canvas.height; const h = Math.random() * 30 * intensity + 2; const xShift = (Math.random() - 0.5) * 80 * intensity;
      const color = glitchColors[Math.floor(Math.random() * glitchColors.length)];
      ctx.fillStyle = color; ctx.globalAlpha = Math.random() * 0.6 * intensity; ctx.fillRect(xShift, y, canvas.width, h);
    }
    ctx.globalAlpha = 0.15 * intensity; ctx.fillStyle = '#000';
    for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 2);
    ctx.globalAlpha = 1;
  }

  function animate() {
    frame++; const progress = frame / totalFrames;
    if (progress < 0.3) { const intensity = progress / 0.3; glitch.style.opacity = intensity * 0.85; drawGlitch(intensity); } 
    else if (progress < 0.6) { glitch.style.opacity = '1'; glitch.style.background = '#fff'; ctx.clearRect(0, 0, canvas.width, canvas.height); drawGlitch(1); } 
    else if (progress < 0.7) { glitch.style.background = '#000'; glitch.style.opacity = '1'; ctx.clearRect(0, 0, canvas.width, canvas.height); if (frame === Math.floor(totalFrames * 0.6) + 1) callback(); } 
    else { const fadeOut = 1 - ((progress - 0.7) / 0.3); glitch.style.opacity = Math.max(0, fadeOut); drawGlitch(fadeOut); if (progress >= 1) { glitch.remove(); return; } }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// Ensure the skip button can be pressed immediately
(function() { const s = document.getElementById('skip-intro-btn'); if (s) { s.style.display = 'block'; s.onclick = endIntro; } })();

window.onYouTubeIframeAPIReady = function() {
  if (isOBS || !introContainer) return;
  ytPlayer = new YT.Player('yt-player', {
    videoId: 'HeKNgnDyD7I',
    // Added 'host' parameter to fix CORS errors!
    playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, origin: window.location.origin, host: 'https://www.youtube.com' },
    events: {
      onReady: (e) => { 
        const btn = document.getElementById('start-intro-btn'); 
        if (btn) { btn.style.display = 'block'; btn.onclick = () => { btn.style.display = 'none'; document.getElementById('yt-player').style.display = 'block'; e.target.playVideo(); }; } 
      },
      onStateChange: (e) => { if (e.data === 0) endIntro(); }
    }
  });
};

// 12-Second Auto-Failsafe just in case YouTube hangs entirely
if (introContainer && !isOBS) setTimeout(() => { if (!introEnded) endIntro(); }, 12000);

/* ══ BOSS SYNC ══════════════════════════════════════════════════════════════ */
if (bossRef) {
  bossRef.on('value', snap => {
    let b = snap.val(); if (!b) return;
    if (b.health <= 0) return handleDefeat(b);
    const maxHP = 1000000000 * b.level;
    const isDave = (b.level % 2 !== 0);
    currentBossIsDave = isDave; currentBossLevel = b.level; 

    const cName = document.getElementById('companion-name'); const bName = document.getElementById('main-boss-name');
    const armor = Math.round(getBossArmor() * 100);
    if (cName) cName.innerText = isDave ? 'Security Larry' : 'Intern Manny';
    if (bName) bName.innerText = (isDave ? 'VP Dave' : 'DM Rich') + ' · Lv.' + b.level + (armor > 0 ? ' 🛡️' + armor + '%' : '');

    const newComp = isDave ? companions.larry : companions.manny;
    if (newComp !== currentCompanion) {
      currentCompanion = newComp; frameIndex = 0; restartCompanionAnim();
      const cImg = document.getElementById('companion-image'); if (cImg) cImg.src = currentCompanion.frames[0];
    }

    const bImg = document.getElementById('boss-image');
    if (bImg && !isAnimatingHit) {
      const phase = b.health / maxHP; const prefix = isDave ? 'assets/phases/dave/dave_phase' : 'assets/phases/rich/rich_phase';
      bImg.src = prefix + (phase <= 0.25 ? '4' : phase <= 0.50 ? '3' : phase <= 0.75 ? '2' : '1') + '.png';
    }

    const fill = document.getElementById('health-bar-fill'); const txt = document.getElementById('health-text');
    if (fill) fill.style.width = (Math.max(0, b.health / maxHP) * 100) + '%';
    if (txt) txt.innerText = Math.max(0, b.health).toLocaleString() + ' / ' + maxHP.toLocaleString();
  });
}

function handleDefeat(b) {
  let nextLvl = b.level + 1;
  if (nextLvl > 10) {
    nextLvl = 1; const active = (Date.now() - lastManualClick) < 10000; myCoins += active ? 1000000 : 250000;
    const popup = document.createElement('div'); popup.className = 'loot-popup';
    popup.innerText = active ? 'ACTIVE PRESTIGE! +1M COINS' : 'PRESTIGE! +250K COINS';
    popup.style.cssText = 'left:50%;top:50%;--tx:0px;--ty:-80px;--rot:0deg;';
    document.body.appendChild(popup); setTimeout(() => popup.remove(), 3500); updateUI();
  }
  bossRef.set({ level: nextLvl, health: 1000000000 * nextLvl });
}

/* ══ CHARGE & BOSS HEAL LOOP ════════════════════════════════════════════════ */
setInterval(() => {
  frenzy = Math.max(0, frenzy - (rageFuelUnlocked ? 1 : 2));
  multi = frenzy >= 100 ? 5 : frenzy >= 75 ? 3 : frenzy >= 50 ? 2 : 1;
  const fill = document.getElementById('frenzy-bar-fill'); const txt = document.getElementById('frenzy-text');
  if (fill) fill.style.width = frenzy + '%';
  if (txt) txt.innerText = multi > 1 ? 'COMBO ' + multi + 'x' : 'CHARGE METER';
  const md = document.getElementById('shop-multi-display'); if (md) md.innerText = (multi * encryptionMultiplier).toFixed(2);
}, 100);

// Boss passively heals 10k per second unless blocked by Firewall Minigame
setInterval(() => {
  if (bossRef && !firewallBuffActive && !isOBS) {
    bossRef.transaction(b => {
      if (b && b.health > 0 && b.health < (1000000000 * b.level)) { b.health += 10000; }
      return b;
    });
  }
}, 1000);

/* ══ COMBAT ══════════════════════════════════════════════════════════════════ */
function getBossArmor() { if (!bossRef) return 0; return Math.min(0.55, Math.max(0, (currentBossLevel - 1) * 0.065)); }

function attack(e) {
  if (isOBS) return;
  lastManualClick = Date.now(); playClickSound();

  if (!isAnimatingHit) {
    isAnimatingHit = true;
    const bArea = document.getElementById('boss-area'); if (bArea) { bArea.style.filter = 'drop-shadow(0 0 30px rgba(255,0,0,0.4))'; setTimeout(() => bArea.style.filter = 'none', 300); }
    const bImg = document.getElementById('boss-image');
    if (bImg) {
      const old = bImg.src; const frames = currentBossIsDave ? daveHitFrames : richHitFrames;
      bImg.src = frames[Math.floor(Math.random() * frames.length)]; bImg.style.transform = 'scale(1.05)';
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
  // Include encryption 3x multiplier
  const rawDmg = Math.floor(myClickDmg * multi * itemBuffMultiplier * synergyBonus * encryptionMultiplier * (isCrit ? 5 : 1));
  const dmg = Math.floor(rawDmg * (1 - armor));
  if (bossRef) bossRef.transaction(b => { if (b) b.health -= dmg; return b; });

  myCoins += (1 + hustleCoinsPerClick) * multi; frenzy = Math.min(100, frenzy + 8); updateUI(); save();

  const clickX = e.clientX || window.innerWidth / 2; const clickY = e.clientY || window.innerHeight / 2;
  const tx = (Math.random()-0.5)*100, ty = -60 - Math.random()*60, rot = (Math.random()-0.5)*20;
  const p = document.createElement('div'); p.className = isCrit ? 'damage-popup crit-popup' : 'damage-popup';
  p.innerText = '+' + dmg.toLocaleString(); p.style.cssText = 'left:' + clickX + 'px;top:' + clickY + 'px;--tx:' + tx + 'px;--ty:' + ty + 'px;--rot:' + rot + 'deg;';
  document.body.appendChild(p); setTimeout(() => p.remove(), 1200);

  // 15% Chance to roll for loot!
  if (Math.random() < 0.15) rollLoot(clickX, clickY - 80);
}

let autoTimer;
function startAutoTimer() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    if (myAutoDmg > 0 && bossRef) {
      const armor = getBossArmor(); const autoDmgReduced = Math.floor((myAutoDmg * encryptionMultiplier) * (1 - armor));
      bossRef.transaction(b => { if (b) b.health -= autoDmgReduced; return b; });
    }
    if (Math.random() < 0.02) rollLoot(window.innerWidth / 2 + (Math.random()-0.5)*200, window.innerHeight * 0.4);
  }, overtimeUnlocked ? 600 : 1000);
}

/* ══ UTILS, UI & SAVE ══════════════════════════════════════════════════════ */
function showDynamicText(text, color) { const popup = document.createElement('div'); popup.className = 'loot-popup'; popup.innerText = text; popup.style.cssText = `left:50%;top:50%;--tx:0px;--ty:-80px;--rot:0deg;color:${color}; z-index:99999; width: 100vw; text-align: center; pointer-events: none;`; document.body.appendChild(popup); setTimeout(() => popup.remove(), 3500); }

function updateUI() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
  set('coin-count', myCoins.toLocaleString()); set('click-power', myClickDmg.toLocaleString()); set('auto-power', myAutoDmg.toLocaleString());
  set('crit-chance-display', critChance); set('loot-buff', Math.round((itemBuffMultiplier - 1) * 100));

  const bc = document.getElementById('buy-click'); if (bc) bc.innerHTML = '⚔️ Sharpen Blade (+2.5k dmg)<br><span>Cost: ' + clickCost.toLocaleString() + '</span>';
  const ba = document.getElementById('buy-auto'); if (ba) ba.innerHTML = '🪖 Hire Merc (+1k/s)<br><span>Cost: ' + autoCost.toLocaleString() + '</span>';
  const cr = document.getElementById('buy-crit'); if (cr) cr.innerHTML = '🎯 Lucky Shot (+5% crit)<br><span class="cost-tag">Cost: ' + critCost.toLocaleString() + '</span>';
  const bo = document.getElementById('buy-overtime');
  if (bo) { if (overtimeUnlocked) { bo.innerHTML = '⏱️ Overtime<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>'; bo.style.opacity = '0.6'; bo.style.cursor = 'default'; } else { bo.innerHTML = '⏱️ Overtime<br><span class="cost-tag">Cost: 200</span>'; bo.style.opacity = '1'; bo.style.cursor = 'pointer'; } }
  const bs = document.getElementById('buy-synergy'); if (bs) bs.innerHTML = '⚡ Synergy Boost (+10% dmg)<br><span class="cost-tag">Lv.' + synergyLevel + ' · Cost: ' + synergyCost.toLocaleString() + '</span>';
  const br = document.getElementById('buy-rage');
  if (br) { if (rageFuelUnlocked) { br.innerHTML = '🔥 Rage Fuel<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>'; br.style.opacity = '0.6'; br.style.cursor = 'default'; } else { br.innerHTML = '🔥 Rage Fuel<br><span class="cost-tag">Cost: ' + rageCost.toLocaleString() + '</span>'; br.style.opacity = '1'; br.style.cursor = 'pointer'; } }
  const bh = document.getElementById('buy-hustle'); if (bh) bh.innerHTML = '💰 Side Hustle (+2 coins)<br><span class="cost-tag">Cost: ' + hustleCost.toLocaleString() + '</span>';
}

function save() { if (!isOBS) localStorage.setItem('gwm_v16', JSON.stringify({ c: myCoins, cd: myClickDmg, ad: myAutoDmg, ac: autoCost, cc: clickCost, critC: critChance, critCost: critCost, u: myUser, inv: myInventory, ot: overtimeUnlocked, syn: synergyLevel, rf: rageFuelUnlocked, hc: hustleCoinsPerClick, sc: synergyCost, rc: rageCost, hcost: hustleCost })); }
function load() { 
  const s = localStorage.getItem('gwm_v16'); 
  if (s) { const d = JSON.parse(s); myCoins = d.c||0; myClickDmg = d.cd||2500; myAutoDmg = d.ad||0; autoCost = d.ac||50; clickCost = d.cc||10; critChance = d.critC||0; critCost = d.critCost||100; myUser = d.u||''; myInventory = d.inv||{}; overtimeUnlocked = d.ot||false; synergyLevel = d.syn||0; rageFuelUnlocked = d.rf||false; hustleCoinsPerClick = d.hc||0; synergyCost = d.sc||150; rageCost = d.rc||75; hustleCost = d.hcost||30; const u = document.getElementById('username-input'); if (u && myUser) u.value = myUser; recalcItemBuff(); renderInventory(); updateUI(); if (myAutoDmg > 0) startAutoTimer(); } 
}

function startRichardLoop() {
  setTimeout(() => {
    const c = document.getElementById('richard-event-container'); const d = document.getElementById('richard-dialogue'); const img = document.getElementById('richard-image');
    if (!c || !d || !img) { setTimeout(startRichardLoop, 5000); return; }
    const quote = richardQuotes[Math.floor(Math.random() * richardQuotes.length)]; d.innerText = quote;
    img.src = ['assets/yourbossvar/boss-crossing.png', 'assets/yourbossvar/boss-pointing.png'][Math.floor(Math.random() * 2)]; img.style.display = 'block';
    const fromLeft = Math.random() > 0.5; img.style.left = fromLeft ? '10px' : 'auto'; img.style.right = fromLeft ? 'auto' : '10px'; img.style.transform = fromLeft ? 'translateX(-160px)' : 'translateX(160px)';
    d.style.left = fromLeft ? '6vw' : 'auto'; d.style.right = fromLeft ? 'auto' : '6vw';
    void c.offsetWidth; c.classList.add('active'); setTimeout(() => { c.classList.remove('active'); setTimeout(startRichardLoop, 3000); }, 8000);
  }, 30000 + Math.random() * 20000);
}

/* ══ 1. FIREWALL MINIGAME (Bullet Heaven) ══════════════════════════════════ */
function injectMinigameHTML() {
  if (!document.getElementById('firewall-minigame-overlay')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="firewall-minigame-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:200000; flex-direction:column; align-items:center; justify-content:center;">
        <h2 style="color:#00ffcc; font-family:monospace; margin-bottom:10px; font-size:2.5rem; text-shadow: 0 0 10px #00ffcc;">🛡️ FIREWALL DEFENSE</h2>
        <p style="color:#fff; font-family:monospace; margin-bottom:20px; font-size:1.2rem;">Click the viruses before they infect the Mainframe! Survive 15 seconds.</p>
        <div id="firewall-arena" style="width:350px; height:350px; border:4px solid #00ffcc; border-radius:10px; position:relative; overflow:hidden; background:#111; cursor:crosshair; box-shadow: 0 0 20px rgba(0,255,204,0.2);">
            <div id="mainframe-core" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); font-size:60px; z-index:10; user-select:none;">🖥️</div>
        </div>
        <div style="margin-top:20px; color:#fff; font-family:monospace; font-size:1.5rem;"> Integrity: <span id="firewall-hp" style="color:#ff4444; font-weight:bold;">3</span>/3 &nbsp;|&nbsp; Time: <span id="firewall-time" style="color:#00ffcc; font-weight:bold;">15</span>s </div>
        <button id="firewall-close-btn" class="vapor-btn" style="margin-top:30px; background:#ff4444; border-color:white;">ABORT SEQUENCE</button>
      </div>
    `);
  }

  if (!document.getElementById('encryption-minigame-overlay')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="encryption-minigame-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:200000; flex-direction:column; align-items:center; justify-content:center;">
        <h2 style="color:#ff00ff; font-family:monospace; margin-bottom:10px; font-size:2.5rem; text-shadow: 0 0 10px #ff00ff;">🔐 DECRYPT MAINFRAME</h2>
        <p style="color:#fff; font-family:monospace; margin-bottom:30px; font-size:1.2rem;">Repeat the exact sequence before the trace completes!</p>
        
        <div style="background:#111; border:3px solid #ff00ff; padding:20px; border-radius:10px; text-align:center; width: 400px; max-width: 90vw;">
          <h3 style="color:#00ffff; margin-top:0;">TARGET SEQUENCE</h3>
          <div id="enc-target-seq" style="font-size:3.5rem; letter-spacing:15px; margin-bottom:20px;"></div>
          <h3 style="color:#ff00ff;">YOUR INPUT</h3>
          <div id="enc-player-seq" style="font-size:3.5rem; letter-spacing:15px; margin-bottom:20px; min-height:60px;"></div>
          
          <div style="display:flex; justify-content:center; gap:15px; margin-top:20px; flex-wrap: wrap;">
            <button class="enc-btn vapor-btn" data-sym="🔺" style="font-size: 2rem; padding: 10px 20px;">🔺</button>
            <button class="enc-btn vapor-btn" data-sym="🟦" style="font-size: 2rem; padding: 10px 20px;">🟦</button>
            <button class="enc-btn vapor-btn" data-sym="🟡" style="font-size: 2rem; padding: 10px 20px;">🟡</button>
            <button class="enc-btn vapor-btn" data-sym="🟩" style="font-size: 2rem; padding: 10px 20px;">🟩</button>
          </div>
        </div>
        <div style="margin-top:30px; color:#fff; font-family:monospace; font-size:1.5rem;"> Trace Time: <span id="enc-time" style="color:#ff4444; font-weight:bold;">10</span>s </div>
        <button id="encryption-close-btn" class="vapor-btn" style="margin-top:20px; background:#ff4444; border-color:white;">ABORT HACK</button>
      </div>
    `);
  }
}

let firewallActive = false, firewallTimer = null, virusSpawner = null, virusMover = null, mainframeHP = 3, firewallTimeLeft = 15;

function startFirewallGame() {
  if (firewallActive || firewallBuffActive) return;
  firewallActive = true; mainframeHP = 3; firewallTimeLeft = 15;
  document.getElementById('firewall-hp').innerText = mainframeHP; document.getElementById('firewall-time').innerText = firewallTimeLeft;
  document.getElementById('firewall-minigame-overlay').style.display = 'flex';
  const arena = document.getElementById('firewall-arena'); document.querySelectorAll('.virus-icon').forEach(v => v.remove());

  virusSpawner = setInterval(() => {
    if (!firewallActive) return; const virus = document.createElement('div'); virus.className = 'virus-icon'; virus.innerText = '👾';
    virus.style.position = 'absolute'; virus.style.fontSize = '35px'; virus.style.userSelect = 'none';
    const edge = Math.floor(Math.random() * 4); let startX, startY;
    if (edge === 0) { startX = Math.random() * 320; startY = -40; } else if (edge === 1) { startX = 350; startY = Math.random() * 320; }
    else if (edge === 2) { startX = Math.random() * 320; startY = 350; } else { startX = -40; startY = Math.random() * 320; }
    virus.style.left = startX + 'px'; virus.style.top = startY + 'px';
    virus.onpointerdown = (e) => { e.stopPropagation(); virus.remove(); playClickSound(); }; arena.appendChild(virus);
  }, 500);

  virusMover = setInterval(() => {
    document.querySelectorAll('.virus-icon').forEach(v => {
      let x = parseFloat(v.style.left), y = parseFloat(v.style.top), dx = 155 - x, dy = 155 - y, dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 20) {
        v.remove(); mainframeHP--; document.getElementById('firewall-hp').innerText = mainframeHP;
        arena.style.transform = 'translate(5px, 5px)'; setTimeout(() => arena.style.transform = 'translate(0, 0)', 50);
        if (mainframeHP <= 0) endFirewallGame(false);
      } else { v.style.left = (x + (dx / dist) * 1.5) + 'px'; v.style.top = (y + (dy / dist) * 1.5) + 'px'; }
    });
  }, 30);

  firewallTimer = setInterval(() => { firewallTimeLeft--; document.getElementById('firewall-time').innerText = firewallTimeLeft; if (firewallTimeLeft <= 0) endFirewallGame(true); }, 1000);
}

function endFirewallGame(won) {
  firewallActive = false; clearInterval(firewallTimer); clearInterval(virusSpawner); clearInterval(virusMover); document.getElementById('firewall-minigame-overlay').style.display = 'none';
  if (won) {
    showDynamicText("FIREWALL UP! BOSS HEAL BLOCKED FOR 60s!", '#00ffcc');
    firewallBuffActive = true; const bArea = document.getElementById('boss-area'); if(bArea) bArea.style.borderBottom = '5px solid #00ffcc';
    setTimeout(() => { firewallBuffActive = false; if(bArea) bArea.style.borderBottom = 'none'; showDynamicText("FIREWALL DOWN! HEALING RESTORED.", '#ff4444'); }, 60000);
  } else { showDynamicText("BREACH DETECTED! DEFENSE FAILED.", '#ff4444'); }
}

/* ══ 2. ENCRYPTION MINIGAME (Code Breaker) ═════════════════════════════════ */
let encActive = false, encTimer = null, encTimeLeft = 10, encTarget = [], encPlayer = [];
const encSymbols = ['🔺', '🟦', '🟡', '🟩'];

function startEncryptionGame() {
  if (encActive || encryptionMultiplier > 1.0) return;
  encActive = true; encTimeLeft = 10; encPlayer = []; encTarget = [];
  for(let i=0; i<4; i++) encTarget.push(encSymbols[Math.floor(Math.random()*4)]);
  
  document.getElementById('enc-target-seq').innerText = encTarget.join(''); document.getElementById('enc-player-seq').innerText = '....';
  document.getElementById('enc-time').innerText = encTimeLeft; document.getElementById('encryption-minigame-overlay').style.display = 'flex';
  encTimer = setInterval(() => { encTimeLeft--; document.getElementById('enc-time').innerText = encTimeLeft; if(encTimeLeft <= 0) endEncryptionGame(false); }, 1000);
}

function handleEncInput(sym) {
  if(!encActive) return; encPlayer.push(sym); document.getElementById('enc-player-seq').innerText = encPlayer.join('');
  let currentIdx = encPlayer.length - 1;
  if (encPlayer[currentIdx] !== encTarget[currentIdx]) { setTimeout(() => endEncryptionGame(false), 200); } 
  else if (encPlayer.length === 4) { setTimeout(() => endEncryptionGame(true), 200); }
}

function endEncryptionGame(won) {
  encActive = false; clearInterval(encTimer); document.getElementById('encryption-minigame-overlay').style.display = 'none';
  if (won) {
    showDynamicText("MAINFRAME CRACKED! 3x GLOBAL DAMAGE FOR 60s!", '#ff00ff');
    encryptionMultiplier = 3.0; updateUI(); const bArea = document.getElementById('boss-area'); if(bArea) bArea.style.filter = 'drop-shadow(0 0 20px #ff00ff)';
    setTimeout(() => { encryptionMultiplier = 1.0; updateUI(); if(bArea) bArea.style.filter = 'none'; showDynamicText("ENCRYPTION RESTORED. DAMAGE NORMALIZED.", '#ff4444'); }, 60000);
  } else { showDynamicText("TRACE COMPLETE! HACK FAILED.", '#ff4444'); }
}

/* ══ 3. PHISHING MINIGAME ══════════════════════════════════════════════════ */
const phishingEmails = [
  { from: 'it-support@company-secure-login.biz', subject: 'URGENT: Your account will be DELETED!!!', body: 'Dear User,\n\nYour account has been flagged. You MUST verify immediately.\n\nCLICK HERE: http://login.company-secure-login.biz/verify', isPhish: true, tip: 'Fake domain, all-caps urgency, threats, suspicious link.' },
  { from: 'noreply@payroll.yourcompany.com', subject: 'Paystub for this period is ready', body: 'Hi,\n\nYour paystub for the current pay period is now available in the HR portal.\n\nLog in at hr.yourcompany.com to view it.', isPhish: false, tip: 'Correct company domain, no urgency, no suspicious links.' },
  { from: 'ceo-message@corporat3.net', subject: 'Personal request from CEO Richard', body: 'Hello,\n\nThis is Richard. I need you to purchase $500 in Amazon gift cards for a client RIGHT NOW and send me the codes privately.', isPhish: true, tip: 'Gift card scam. Wrong domain, secrecy demands, and "CEO" never legitimately asks for gift cards.' },
  { from: 'calendar@google.com', subject: 'Meeting: Q4 Planning - 3pm Today', body: 'You have been invited to a meeting:\n\nQ4 Budget Planning\nWhen: Today at 3:00 PM\nOrganizer: district.manager@yourcompany.com', isPhish: false, tip: 'Legitimate Google Calendar notification. Real google.com domain.' }
];
function shuffleArray(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

let phishPool = [], phishIndex = 0, phishScore = 0, phishTotal = 4, phishTimer = null, phishTimeLeft = 0, phishAnswered = false;

function setMikitaImg(variant) { document.querySelectorAll('#mikita-char-img').forEach(img => img.src = 'assets/chars/mikita_' + variant + '.png'); }

function openPhishingGame() {
  phishPool = shuffleArray(phishingEmails).slice(0, phishTotal); phishIndex = 0; phishScore = 0; phishAnswered = false;
  const overlay = document.getElementById('phishing-game-overlay'); if (!overlay) return; overlay.style.display = 'flex';
  const el = document.getElementById('phish-score'); if (el) el.innerText = '0 / ' + phishTotal;
  const rs = document.getElementById('phish-result-screen'); if (rs) rs.style.display = 'none';
  const btns = document.getElementById('phish-buttons'); if (btns) btns.style.display = 'flex';
  setMikitaImg('terminal'); loadPhishEmail();
}

function loadPhishEmail() {
  if (phishIndex >= phishPool.length) return endPhishGame();
  const email = phishPool[phishIndex]; phishAnswered = false;
  const emailClient = document.querySelector('.email-client');
  if (emailClient) { emailClient.style.transition = 'opacity 0.25s ease, transform 0.25s ease'; emailClient.style.opacity = '1'; emailClient.style.transform = 'translateY(0)'; }
  const s = document.getElementById('phish-sender'); if (s) s.innerText = email.from;
  const sub = document.getElementById('phish-subject'); if (sub) sub.innerText = email.subject;
  const body = document.getElementById('phish-body'); if (body) { body.innerText = email.body; body.style.opacity = '1'; }
  const btns = document.getElementById('phish-buttons'); if (btns) { btns.style.display = 'flex'; btns.style.pointerEvents = 'auto'; btns.style.opacity = '1'; }
  const tf = document.getElementById('phish-timer-fill'); if (tf) { tf.style.transition = 'none'; tf.style.width = '100%'; tf.style.backgroundColor = '#00ffcc'; void tf.offsetWidth; tf.style.transition = 'width 0.1s linear, background-color 0.3s'; }
  if (phishTimer) clearInterval(phishTimer);
  phishTimeLeft = 80;
  phishTimer = setInterval(() => { phishTimeLeft--; const pct = (phishTimeLeft / 80) * 100; if (tf) { tf.style.width = pct + '%'; tf.style.backgroundColor = pct < 30 ? '#ff4444' : pct < 60 ? '#ff8800' : '#00ffcc'; } if (phishTimeLeft <= 0) { clearInterval(phishTimer); if (!phishAnswered) answerPhish(null); } }, 100);
}

function answerPhish(userSaysPhish) {
  if (phishAnswered) return; phishAnswered = true; if (phishTimer) clearInterval(phishTimer); phishTimer = null;
  const email = phishPool[phishIndex]; const correct = userSaysPhish !== null && (userSaysPhish === email.isPhish);
  if (correct) phishScore++;
  const scoreEl = document.getElementById('phish-score'); if (scoreEl) scoreEl.innerText = phishScore + ' / ' + phishTotal;
  const tf = document.getElementById('phish-timer-fill'); if (tf) { tf.style.transition = 'background-color 0.3s'; tf.style.backgroundColor = correct ? '#00ff88' : '#ff4444'; }
  const btns = document.getElementById('phish-buttons'); if (btns) { btns.style.pointerEvents = 'none'; btns.style.opacity = '0.4'; }
  const emailClient = document.querySelector('.email-client'); if (emailClient) { emailClient.style.transition = 'opacity 0.2s ease, transform 0.2s ease'; emailClient.style.opacity = '0'; emailClient.style.transform = 'translateY(-8px)'; }
  const bodyEl = document.getElementById('phish-body'); const verdict = userSaysPhish === null ? '⏱️ TIMED OUT!' : correct ? '✅ CORRECT!' : '❌ WRONG!';
  const color = correct ? '#00aa55' : '#cc0000'; const answer = email.isPhish ? '🚩 PHISHING' : '✅ LEGITIMATE';
  setTimeout(() => {
    if (emailClient) { emailClient.style.opacity = '1'; emailClient.style.transform = 'translateY(0)'; }
    if (bodyEl) { bodyEl.innerHTML = '<strong style="color:' + color + ';font-size:1.4em;display:block;margin-bottom:8px">' + verdict + '</strong>' + '<span style="color:#ccc;font-size:0.95em">💡 ' + email.tip + '</span><br><br><em style="color:#888;font-size:0.9em">This email was: ' + answer + '</em>'; }
  }, 220);
  setTimeout(() => { if (emailClient) { emailClient.style.transition = 'opacity 0.25s ease, transform 0.25s ease'; emailClient.style.opacity = '0'; emailClient.style.transform = 'translateY(8px)'; } setTimeout(() => { phishIndex++; if (phishIndex >= phishPool.length) endPhishGame(); else loadPhishEmail(); }, 260); }, 2500);
}

function endPhishGame() {
  if (phishTimer) clearInterval(phishTimer);
  const btns = document.getElementById('phish-buttons'); if (btns) btns.style.display = 'none';
  const rs = document.getElementById('phish-result-screen'); if (rs) rs.style.display = 'block';
  const fm = document.getElementById('phish-final-msg');
  const pct = phishScore / phishTotal; let reward = 0, msg = '', mikitaVariant = 'instructor', mikitaLine = '';
  if (pct >= 0.85) { reward = 8000; msg = '🏆 ELITE ANALYST!\n' + phishScore + '/' + phishTotal + ' Correct!\n+' + reward.toLocaleString() + ' COINS!'; mikitaVariant = 'instructor'; mikitaLine = '"Outstanding work. You just saved the company."'; } 
  else if (pct >= 0.67) { reward = 3000; msg = '✅ SOLID WORK!\n' + phishScore + '/' + phishTotal + ' Correct!\n+' + reward.toLocaleString() + ' Coins'; mikitaVariant = 'idle'; mikitaLine = '"Not bad. Keep your guard up out there."'; } 
  else { reward = 0; msg = '❌ PHISHED!\n' + phishScore + '/' + phishTotal + ' Correct\nBetter luck next time...'; mikitaVariant = 'terminal'; mikitaLine = '"...I\\'m putting you on mandatory retraining."'; }
  if (fm) fm.innerText = msg; setMikitaImg(mikitaVariant);
  let reactionEl = document.getElementById('phish-mikita-reaction'); if (!reactionEl) { reactionEl = document.createElement('p'); reactionEl.id = 'phish-mikita-reaction'; reactionEl.style.cssText = 'color:#00ffff;font-size:1.1rem;margin:8px 0 12px;font-style:italic;text-align:center;'; if (fm) fm.parentNode.insertBefore(reactionEl, fm.nextSibling); }
  reactionEl.innerText = mikitaLine; myCoins += reward; updateUI(); save();
}

/* ══ EVENT DELEGATION BINDING ══════════════════════════════════════════════ */
function bindInteractions() {
  // Inject Minigame HTML
  injectMinigameHTML();

  document.addEventListener('click', (e) => {
    // Top Level Handlers
    if (e.target.id === 'skip-intro-btn') endIntro();
    if (e.target.closest('#btn-clock-in')) { const v = document.getElementById('username-input'); if (v && v.value.trim()) { myUser = v.value.trim().toUpperCase(); document.getElementById('login-screen').style.display = 'none'; document.getElementById('game-container').style.display = 'flex'; if (employeesRef) employeesRef.push({ name: myUser, status: '💼' }).onDisconnect().remove(); bgm.play().catch(() => {}); if (myAutoDmg > 0) startAutoTimer(); save(); } }
    
    // Upgrades
    if (e.target.closest('#buy-click')) { if (myCoins >= clickCost) { myCoins -= clickCost; myClickDmg += 2500; clickCost = Math.floor(clickCost * 1.5); updateUI(); save(); } }
    if (e.target.closest('#buy-auto')) { if (myCoins >= autoCost) { myCoins -= autoCost; myAutoDmg += 1000; autoCost = Math.floor(autoCost * 1.5); if (myAutoDmg === 1000) startAutoTimer(); updateUI(); save(); } }
    if (e.target.closest('#buy-crit')) { if (myCoins >= critCost) { myCoins -= critCost; critChance = Math.min(95, critChance + 5); critCost = Math.floor(critCost * 1.8); updateUI(); save(); } }
    if (e.target.closest('#buy-overtime')) { if (myCoins >= 200 && !overtimeUnlocked) { myCoins -= 200; overtimeUnlocked = true; if (myAutoDmg > 0) startAutoTimer(); updateUI(); save(); } }
    if (e.target.closest('#buy-synergy')) { if (myCoins >= synergyCost) { myCoins -= synergyCost; synergyLevel++; synergyCost = Math.floor(synergyCost * 1.8); updateUI(); save(); } }
    if (e.target.closest('#buy-rage')) { if (myCoins >= rageCost && !rageFuelUnlocked) { myCoins -= rageCost; rageFuelUnlocked = true; rageCost = Math.floor(rageCost * 2.0); updateUI(); save(); } }
    if (e.target.closest('#buy-hustle')) { if (myCoins >= hustleCost) { myCoins -= hustleCost; hustleCoinsPerClick += 2; hustleCost = Math.floor(hustleCost * 1.8); updateUI(); save(); } }
    
    // Skill: Phishing
    if (e.target.closest('#skill-phishing')) { const o = document.getElementById('mikita-overlay'); if (o) o.style.display = 'flex'; setMikitaImg('idle'); const r = document.getElementById('phish-mikita-reaction'); if (r) r.innerText = ''; }
    if (e.target.id === 'mikita-close') { const o = document.getElementById('mikita-overlay'); if (o) o.style.display = 'none'; }
    if (e.target.id === 'mikita-start-game-btn') { const o = document.getElementById('mikita-overlay'); if (o) o.style.display = 'none'; openPhishingGame(); }
    if (e.target.id === 'btn-legit') answerPhish(false);
    if (e.target.id === 'btn-phish') answerPhish(true);
    if (e.target.id === 'phish-close-btn') { const o = document.getElementById('phishing-game-overlay'); if (o) o.style.display = 'none'; }
    
    // Skill: Firewall
    if (e.target.closest('#skill-firewall')) startFirewallGame();
    if (e.target.id === 'firewall-close-btn') endFirewallGame(false);

    // Skill: Encryption
    if (e.target.closest('#skill-encryption')) startEncryptionGame();
    if (e.target.id === 'encryption-close-btn') endEncryptionGame(false);
    if (e.target.closest('.enc-btn')) handleEncInput(e.target.closest('.enc-btn').getAttribute('data-sym'));
  });

  document.addEventListener('pointerdown', (e) => { if (e.target.closest('#btn-attack') || e.target.closest('#boss-area')) { attack(e); } });
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', bindInteractions); }
else { bindInteractions(); }
