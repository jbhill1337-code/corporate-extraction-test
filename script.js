console.log('=== CORPORATE TAKEDOWN LOADED ===');

/* ══ FIREBASE ════════════════════════════════════════════════════════════ */
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

/* ══ AUDIO ════════════════════════════════════════════════════════════════ */
const bgm = new Audio('nocturnal-window-lights.mp3');
bgm.loop = true; bgm.volume = 0.15;
const clickSfxFiles = ['sfx pack/Boss hit 1.wav','sfx pack/Bubble 1.wav','sfx pack/Hit damage 1.wav','sfx pack/Select 1.wav'];
const attackSounds = clickSfxFiles.map(f => { const a = new Audio(encodeURI(f)); a.volume = 0.3; return a; });
function playClickSound() {
  try { const s = attackSounds[Math.floor(Math.random()*attackSounds.length)].cloneNode(); s.volume=0.3; s.play().catch(()=>{}); } catch(e){}
}

/* ══ GAME STATE ═══════════════════════════════════════════════════════════ */
let myCoins=0, myClickDmg=2500, myAutoDmg=0, multi=1, frenzy=0;
let clickCost=10, autoCost=50, critChance=0, critCost=100, myUser='', lastManualClick=0;
let myInventory={}, itemBuffMultiplier=1.0, isAnimatingHit=false;
let overtimeUnlocked=false, synergyLevel=0, rageFuelUnlocked=false, hustleCoinsPerClick=0;
let synergyCost=150, rageCost=75, hustleCost=30;
let currentBossIsDave=true, currentBossLevel=1;
let _lastBossLevel=null;

const daveHitFrames=['assets/hit/dave-hit-1.png','assets/hit/dave-hit-2.png'];
const richHitFrames=['assets/phases/rich/rich_hit_a.png','assets/phases/rich/rich_hit_b.png'];

/* ══ RICHARD QUOTES ═══════════════════════════════════════════════════════ */
const richardQuotes=[
  "SYNERGY IS KEY.","LET'S CIRCLE BACK.","LIVIN' THE DREAM.","CHECK THE BACK ROOM.",
  "BANDWIDTH EXCEEDED.","RESULTS SPEAK LOUDEST.","WHO TOUCHED MY STAPLER?",
  "MAXIMIZE YOUR OUTPUT.","LEVERAGE THE PIPELINE.","GROWTH MINDSET, PEOPLE.",
  "FAILURE IS NOT OPTIMAL.","PING ME ON SLACK.","DISRUPT THE DISRUPTION.",
  "WE'RE A FAMILY HERE...","QUARTERLY OR BUST.","DELIVER VALUE, OR ELSE.",
  "THINK OUTSIDE THE BOX.","MY DOOR IS ALWAYS CLOSED.","SCALE IT, NOW."
];
let usedRichardQuotes=[];

/* ══ PLAYER CARD SYSTEM ═══════════════════════════════════════════════════ */
const OFFICE_EMOJIS=['🖥️','📋','☕','📊','💼','📎','🖨️','📌','✏️','📞','🔑','💾','📝','🗂️','⌨️','🖱️'];

function emojiForName(name) {
  let hash=0;
  for(let i=0;i<name.length;i++) hash=(hash*31+name.charCodeAt(i))&0xffff;
  return OFFICE_EMOJIS[hash % OFFICE_EMOJIS.length];
}

const activePlayers={};

function upsertPlayerCard(username) {
  const row=document.getElementById('player-row');
  if(!row) return;
  if(activePlayers[username]) { activePlayers[username].lastSeen=Date.now(); return; }

  const emoji=emojiForName(username);
  const isMe=(username===myUser);
  const card=document.createElement('div');
  card.className='player-card'+(isMe?' is-me':'');
  card.id='pcard-'+username;
  card.innerHTML=`<div class="player-avatar">${emoji}</div><div class="player-nametag">${username}</div>`;
  row.appendChild(card);
  activePlayers[username]={card,lastSeen:Date.now()};
}

function removePlayerCard(username) {
  const d=activePlayers[username];
  if(!d) return;
  d.card.style.transition='opacity 0.35s,transform 0.35s';
  d.card.style.opacity='0';
  d.card.style.transform='scale(0.5) translateY(20px)';
  setTimeout(()=>{ try{d.card.remove();}catch(e){} delete activePlayers[username]; },380);
}

function flashPlayerCard(username) {
  const d=activePlayers[username];
  if(!d) return;
  d.card.classList.add('attacking');
  setTimeout(()=>d.card.classList.remove('attacking'),200);
}

function watchEmployees() {
  if(!employeesRef) return;
  employeesRef.on('value',snap=>{
    const data=snap.val()||{};
    const current=new Set(Object.keys(data));
    for(const name of current) upsertPlayerCard(name);
    for(const name of Object.keys(activePlayers)) { if(!current.has(name)) removePlayerCard(name); }
  });
}

function registerEmployee(username) {
  if(!employeesRef) return;
  const ref=employeesRef.child(username);
  ref.set({online:true,joined:Date.now()});
  ref.onDisconnect().remove();
}

/* ══ LOOT SYSTEM ══════════════════════════════════════════════════════════ */
const lootTable=[
  {name:'Coffee Mug',emoji:'☕',rarity:'common',bonus:0.03,desc:'+3% DMG'},
  {name:'Sticky Note',emoji:'📝',rarity:'common',bonus:0.03,desc:'+3% DMG'},
  {name:'USB Drive',emoji:'💾',rarity:'uncommon',bonus:0.06,desc:'+6% DMG'},
  {name:'Laser Pointer',emoji:'🔴',rarity:'uncommon',bonus:0.06,desc:'+6% DMG'},
  {name:'Energy Drink',emoji:'⚡',rarity:'uncommon',bonus:0.08,desc:'+8% DMG'},
  {name:'Gold Stapler',emoji:'🔩',rarity:'rare',bonus:0.12,desc:'+12% DMG'},
  {name:'VPN Token',emoji:'🔐',rarity:'rare',bonus:0.15,desc:'+15% DMG'},
  {name:'Employee of Month',emoji:'🏆',rarity:'legendary',bonus:0.25,desc:'+25% DMG'},
  {name:'Briefcase of Cash',emoji:'💼',rarity:'legendary',bonus:0.40,desc:'+40% DMG'},
];

function rollLoot(x,y) {
  const roll=Math.random(); let pool;
  if(roll<0.008) pool=lootTable.filter(i=>i.rarity==='legendary');
  else if(roll<0.030) pool=lootTable.filter(i=>i.rarity==='rare');
  else if(roll<0.090) pool=lootTable.filter(i=>i.rarity==='uncommon');
  else if(roll<0.150) pool=lootTable.filter(i=>i.rarity==='common');
  else return;
  const item=pool[Math.floor(Math.random()*pool.length)];
  if(!myInventory[item.name]) myInventory[item.name]={...item,count:0};
  myInventory[item.name].count++;
  recalcItemBuff(); renderInventory(); save();
  const colorMap={legendary:'#FFD700',rare:'#3498db',uncommon:'#2ecc71',common:'#fff'};
  const popup=document.createElement('div'); popup.className='loot-popup';
  popup.innerText=item.emoji+' '+item.name+'!';
  const tx=(Math.random()-0.5)*120,ty=-80-Math.random()*60,rot=(Math.random()-0.5)*20;
  popup.style.cssText=`left:${x}px;top:${y}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:${colorMap[item.rarity]};`;
  document.body.appendChild(popup); setTimeout(()=>popup.remove(),3500);
}

function recalcItemBuff() {
  let t=0; for(const k in myInventory) t+=myInventory[k].bonus*myInventory[k].count;
  itemBuffMultiplier=1+t;
  const el=document.getElementById('loot-buff'); if(el) el.innerText=Math.round(t*100);
}

function renderInventory() {
  const grid=document.getElementById('inventory-grid'); if(!grid) return;
  grid.innerHTML='';
  for(const k in myInventory) {
    const item=myInventory[k];
    const div=document.createElement('div'); div.className='inv-item rarity-'+item.rarity;
    div.innerHTML=`<span style="font-size:22px">${item.emoji}</span><span class="inv-count">${item.count}</span><div class="inv-tooltip">${item.name}<br>${item.desc}</div>`;
    grid.appendChild(div);
  }
}

/* ══ INIT ═════════════════════════════════════════════════════════════════ */
function initSystem() {
  const bImg=document.getElementById('boss-image');
  if(bImg) { bImg.src='assets/phases/dave/dave_phase1.png'; triggerBossEntrance(); }
  startRichardLoop();
  renderInventory(); recalcItemBuff();
  if(myAutoDmg>0) startAutoTimer();
  watchEmployees();
}

function triggerBossEntrance() {
  const bImg=document.getElementById('boss-image');
  if(!bImg) return;
  bImg.classList.remove('boss-enter');
  void bImg.offsetWidth;
  bImg.classList.add('boss-enter');
  bImg.addEventListener('animationend',()=>bImg.classList.remove('boss-enter'),{once:true});
}

function shakeArena() {
  const arena=document.getElementById('battle-arena');
  if(!arena) return;
  arena.classList.add('shaking');
  setTimeout(()=>arena.classList.remove('shaking'),240);
}

/* ══ INTRO ════════════════════════════════════════════════════════════════ */
const introContainer=document.getElementById('intro-container');
let ytPlayer=null, introEnded=false;

const endIntro=()=>{
  if(introEnded) return; introEnded=true;
  try{if(ytPlayer){ytPlayer.stopVideo();ytPlayer.destroy();ytPlayer=null;}}catch(e){}
  const ytEl=document.getElementById('yt-player');
  if(ytEl){ytEl.src='';ytEl.style.display='none';}
  glitchTransition(()=>{ if(introContainer) introContainer.style.display='none'; initSystem(); load(); });
};

(function(){ const s=document.getElementById('skip-intro-btn'); if(s){s.style.display='block';s.onclick=endIntro;} })();

window.onYouTubeIframeAPIReady=function(){
  if(isOBS||!introContainer) return;
  ytPlayer=new YT.Player('yt-player',{
    videoId:'HeKNgnDyD7I',
    playerVars:{playsinline:1,controls:0,disablekb:1,fs:0,modestbranding:1,rel:0,origin:window.location.origin},
    events:{
      onReady:(e)=>{
        const btn=document.getElementById('start-intro-btn');
        if(btn){btn.style.display='block';btn.onclick=()=>{btn.style.display='none';document.getElementById('yt-player').style.display='block';e.target.playVideo();};}
      },
      onStateChange:(e)=>{ if(e.data===0) endIntro(); }
    }
  });
};

function glitchTransition(callback) {
  const glitch=document.createElement('div');
  glitch.style.cssText='position:fixed;inset:0;z-index:99998;pointer-events:none;background:#000;opacity:0;';
  document.body.appendChild(glitch);
  const canvas=document.createElement('canvas'); canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
  canvas.width=window.innerWidth; canvas.height=window.innerHeight; glitch.appendChild(canvas);
  const ctx=canvas.getContext('2d'); let frame=0; const total=40;
  const colors=['#ff00ff','#00ffff','#ffffff','#ff0000','#00ff00'];
  function drawGlitch(intensity){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<Math.floor(4+intensity*12);i++){
      ctx.fillStyle=colors[Math.floor(Math.random()*colors.length)];
      ctx.globalAlpha=Math.random()*0.6*intensity;
      ctx.fillRect((Math.random()-0.5)*80*intensity,Math.random()*canvas.height,canvas.width,Math.random()*30*intensity+2);
    }
    ctx.globalAlpha=0.15*intensity; ctx.fillStyle='#000';
    for(let y=0;y<canvas.height;y+=4) ctx.fillRect(0,y,canvas.width,2);
    ctx.globalAlpha=1;
  }
  function animate(){
    frame++; const p=frame/total;
    if(p<0.3){glitch.style.opacity=p/0.3*0.85;drawGlitch(p/0.3);}
    else if(p<0.6){glitch.style.opacity='1';glitch.style.background='#fff';ctx.clearRect(0,0,canvas.width,canvas.height);drawGlitch(1);}
    else if(p<0.7){glitch.style.background='#000';glitch.style.opacity='1';ctx.clearRect(0,0,canvas.width,canvas.height);if(frame===Math.floor(total*0.6)+1)callback();}
    else{const f=1-((p-0.7)/0.3);glitch.style.opacity=Math.max(0,f);drawGlitch(f);if(p>=1){glitch.remove();return;}}
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

/* ══ FIREBASE BOSS LISTENER ═══════════════════════════════════════════════ */
if(bossRef) {
  bossRef.on('value', snap=>{
    const b=snap.val(); if(!b) return;
    if(b.health<=0) return handleDefeat(b);
    const maxHP=1000000000*b.level;
    const isDave=(b.level%2!==0);
    currentBossIsDave=isDave; currentBossLevel=b.level;

    // Nameplate
    const bName=document.getElementById('main-boss-name');
    const bLevel=document.getElementById('boss-level-badge');
    const armorBadge=document.getElementById('boss-armor-badge');
    const armorPct=document.getElementById('boss-armor-pct');
    const armor=Math.round(getBossArmor()*100);
    if(bName) bName.innerText=isDave?'VP Dave':'DM Rich';
    if(bLevel) bLevel.innerText='LV.'+b.level;
    if(armorBadge) armorBadge.style.display=armor>0?'inline-flex':'none';
    if(armorPct) armorPct.innerText=armor;

    // Boss title in header
    const bossNameH1=document.getElementById('boss-name');
    if(bossNameH1) bossNameH1.innerText=(isDave?'⚔ VP DAVE':'⚔ DM RICH')+' — LEVEL '+b.level;

    // Boss sprite
    const bImg=document.getElementById('boss-image');
    if(bImg) {
      const phase=b.health/maxHP;
      const prefix=isDave?'assets/phases/dave/dave_phase':'assets/phases/rich/rich_phase';
      const phaseSrc=prefix+(phase<=0.25?'4':phase<=0.50?'3':phase<=0.75?'2':'1')+'.png';

      if(b.level!==_lastBossLevel) {
        // New boss spawned — entrance animation + shake
        bImg.src=prefix+'1.png';
        triggerBossEntrance();
        shakeArena();
        _lastBossLevel=b.level;
      } else if(!isAnimatingHit) {
        bImg.src=phaseSrc;
      }
    }

    // HP bar
    const fill=document.getElementById('health-bar-fill');
    const txt=document.getElementById('health-text');
    if(fill) fill.style.width=(Math.max(0,b.health/maxHP)*100)+'%';
    if(txt) txt.innerText=Math.max(0,b.health).toLocaleString()+' / '+maxHP.toLocaleString();
  });
}

function handleDefeat(b) {
  let nextLvl=b.level+1;
  if(nextLvl>10) {
    nextLvl=1;
    const active=(Date.now()-lastManualClick)<10000;
    myCoins+=active?1000000:250000;
    const popup=document.createElement('div'); popup.className='loot-popup';
    popup.innerText=active?'ACTIVE PRESTIGE! +1M 💰':'PRESTIGE! +250K 💰';
    popup.style.cssText='left:50%;top:40%;--tx:0px;--ty:-80px;--rot:0deg;';
    document.body.appendChild(popup); setTimeout(()=>popup.remove(),3500);
    updateUI();
  }
  bossRef.set({level:nextLvl,health:1000000000*nextLvl});
}

/* ══ FRENZY METER TICK ════════════════════════════════════════════════════ */
setInterval(()=>{
  frenzy=Math.max(0,frenzy-(rageFuelUnlocked?1:2));
  multi=frenzy>=100?5:frenzy>=75?3:frenzy>=50?2:1;
  const fill=document.getElementById('frenzy-bar-fill');
  const txt=document.getElementById('frenzy-text');
  const md=document.getElementById('shop-multi-display');
  if(fill) fill.style.width=frenzy+'%';
  if(txt) txt.innerText=multi>1?'COMBO '+multi+'x':'CHARGE METER';
  if(md) md.innerText=multi.toFixed(2);
},100);

function getBossArmor() {
  if(!bossRef) return 0;
  return Math.min(0.55,Math.max(0,(currentBossLevel-1)*0.065));
}

/* ══ ATTACK ════════════════════════════════════════════════════════════════ */
function attack(e) {
  if(isOBS) return;
  lastManualClick=Date.now();
  playClickSound();
  if(myUser) flashPlayerCard(myUser);

  if(!isAnimatingHit) {
    isAnimatingHit=true;
    shakeArena();

    const hitFlash=document.getElementById('boss-hit-flash');
    if(hitFlash) { hitFlash.classList.add('flashing'); setTimeout(()=>hitFlash.classList.remove('flashing'),120); }

    const bImg=document.getElementById('boss-image');
    if(bImg) {
      const old=bImg.src;
      const frames=currentBossIsDave?daveHitFrames:richHitFrames;
      bImg.src=frames[Math.floor(Math.random()*frames.length)];
      bImg.style.transform='scale(1.07)';
      setTimeout(()=>{ bImg.src=old; bImg.style.transform='scale(1)'; isAnimatingHit=false; },180);
    } else { setTimeout(()=>isAnimatingHit=false,180); }
  }

  const isCrit=(Math.random()*100)<critChance;
  const synergyBonus=1+(synergyLevel*0.10);
  const armor=getBossArmor();
  const rawDmg=Math.floor(myClickDmg*multi*itemBuffMultiplier*synergyBonus*(isCrit?5:1));
  const dmg=Math.floor(rawDmg*(1-armor));

  if(bossRef) bossRef.transaction(b=>{ if(b) b.health-=dmg; return b; });

  myCoins+=(1+hustleCoinsPerClick)*multi;
  frenzy=Math.min(100,frenzy+8);
  updateUI(); save();

  const clickX=e.clientX||window.innerWidth/2;
  const clickY=e.clientY||window.innerHeight/2;
  const tx=(Math.random()-0.5)*100, ty=-55-Math.random()*55, rot=(Math.random()-0.5)*20;
  const p=document.createElement('div');
  p.className=isCrit?'damage-popup crit-popup':'damage-popup';
  p.innerText='+'+dmg.toLocaleString();
  p.style.cssText=`left:${clickX}px;top:${clickY}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;`;
  document.body.appendChild(p); setTimeout(()=>p.remove(),1200);

  if(Math.random()<0.02) rollLoot(clickX,clickY-80);
}

/* ══ AUTO DAMAGE ══════════════════════════════════════════════════════════ */
let autoTimer;
function startAutoTimer() {
  if(autoTimer) clearInterval(autoTimer);
  autoTimer=setInterval(()=>{
    if(myAutoDmg>0&&bossRef) {
      const reduced=Math.floor(myAutoDmg*(1-getBossArmor()));
      bossRef.transaction(b=>{ if(b) b.health-=reduced; return b; });
    }
    if(Math.random()<0.005) rollLoot(window.innerWidth/2+(Math.random()-0.5)*200,window.innerHeight*0.4);
  },overtimeUnlocked?600:1000);
}

/* ══ UI UPDATE ════════════════════════════════════════════════════════════ */
function updateUI() {
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.innerText=v; };
  set('coin-count',myCoins.toLocaleString());
  set('click-power',myClickDmg.toLocaleString());
  set('auto-power',myAutoDmg.toLocaleString());
  set('crit-chance-display',critChance);
  set('loot-buff',Math.round((itemBuffMultiplier-1)*100));

  const bc=document.getElementById('buy-click'); if(bc) bc.innerHTML='⚔️ Sharpen Blade (+2.5k)<br><span>Cost: '+clickCost.toLocaleString()+'</span>';
  const ba=document.getElementById('buy-auto'); if(ba) ba.innerHTML='🪖 Hire Merc (+1k/s)<br><span>Cost: '+autoCost.toLocaleString()+'</span>';
  const cr=document.getElementById('buy-crit'); if(cr) cr.innerHTML='🎯 Lucky Shot (+5% crit)<br><span class="cost-tag">Cost: '+critCost.toLocaleString()+'</span>';
  const bo=document.getElementById('buy-overtime');
  if(bo) { if(overtimeUnlocked){bo.innerHTML='⏱️ Overtime<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';bo.style.opacity='0.6';}else{bo.innerHTML='⏱️ Overtime (faster auto)<br><span class="cost-tag">Cost: 200</span>';bo.style.opacity='1';} }
  const bs=document.getElementById('buy-synergy'); if(bs) bs.innerHTML='⚡ Synergy Boost (+10%)<br><span class="cost-tag">Lv.'+synergyLevel+' Cost: '+synergyCost.toLocaleString()+'</span>';
  const br=document.getElementById('buy-rage');
  if(br) { if(rageFuelUnlocked){br.innerHTML='🔥 Rage Fuel<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';br.style.opacity='0.6';}else{br.innerHTML='🔥 Rage Fuel (slower decay)<br><span class="cost-tag">Cost: '+rageCost.toLocaleString()+'</span>';br.style.opacity='1';} }
  const bh=document.getElementById('buy-hustle'); if(bh) bh.innerHTML='💰 Side Hustle (+2 coins)<br><span class="cost-tag">Cost: '+hustleCost.toLocaleString()+'</span>';
}

/* ══ SAVE / LOAD ══════════════════════════════════════════════════════════ */
function save() {
  if(!isOBS) localStorage.setItem('gwm_v13',JSON.stringify({
    c:myCoins,cd:myClickDmg,ad:myAutoDmg,ac:autoCost,cc:clickCost,critC:critChance,
    critCost:critCost,u:myUser,inv:myInventory,ot:overtimeUnlocked,syn:synergyLevel,
    rf:rageFuelUnlocked,hc:hustleCoinsPerClick,sc:synergyCost,rc:rageCost,hcost:hustleCost
  }));
}
function load() {
  const s=localStorage.getItem('gwm_v13'); if(!s) return;
  const d=JSON.parse(s);
  myCoins=d.c||0; myClickDmg=d.cd||2500; myAutoDmg=d.ad||0; autoCost=d.ac||50;
  clickCost=d.cc||10; critChance=d.critC||0; critCost=d.critCost||100; myUser=d.u||'';
  myInventory=d.inv||{}; overtimeUnlocked=d.ot||false; synergyLevel=d.syn||0;
  rageFuelUnlocked=d.rf||false; hustleCoinsPerClick=d.hc||0; synergyCost=d.sc||150;
  rageCost=d.rc||75; hustleCost=d.hcost||30;
  const u=document.getElementById('username-input'); if(u&&myUser) u.value=myUser;
  recalcItemBuff(); renderInventory(); updateUI();
  if(myAutoDmg>0) startAutoTimer();
}

/* ══ RICHARD CAMEOS ═══════════════════════════════════════════════════════ */
function startRichardLoop() {
  setTimeout(()=>{
    const c=document.getElementById('richard-event-container');
    const d=document.getElementById('richard-dialogue');
    const img=document.getElementById('richard-image');
    if(!c||!d||!img) { setTimeout(startRichardLoop,5000); return; }

    if(usedRichardQuotes.length>=richardQuotes.length) usedRichardQuotes=[];
    const available=richardQuotes.filter(q=>!usedRichardQuotes.includes(q));
    const quote=available[Math.floor(Math.random()*available.length)];
    usedRichardQuotes.push(quote); d.innerText=quote;

    const imgs=['yourbossvar/boss-crossing.png','yourbossvar/boss-pointing.png'];
    img.src=imgs[Math.floor(Math.random()*imgs.length)]; img.style.display='block';

    const fromLeft=Math.random()>0.5;
    img.style.left=fromLeft?'10px':'auto'; img.style.right=fromLeft?'auto':'10px';
    img.style.transform=fromLeft?'translateX(-160px)':'translateX(160px)';
    d.style.left=fromLeft?'6vw':'auto'; d.style.right=fromLeft?'auto':'6vw';

    setTimeout(()=>{
      img.style.transition='opacity 1.2s ease, transform 1.5s ease';
      img.style.opacity='0.85';
      img.style.transform='translateX(0)';
      d.style.transition='opacity 0.5s 1.5s, transform 0.5s 1.5s';
      d.style.opacity='1'; d.style.transform='scale(1)';
    },100);

    setTimeout(()=>{
      img.style.opacity='0';
      img.style.transform=fromLeft?'translateX(-160px)':'translateX(160px)';
      d.style.opacity='0'; d.style.transform='scale(0.8)';
      setTimeout(startRichardLoop,3000);
    },8000);
  },30000+Math.random()*20000);
}

/* ══════════════════════════════════════════════════════════════════════════
   PHISHING MINIGAME
═══════════════════════════════════════════════════════════════════════════ */
const phishingEmails=[
  {from:'it-support@company-secure-login.biz',subject:'URGENT: Your account will be DELETED!!!',body:'Dear User,\n\nYour account has been flagged. You MUST verify immediately or face permanent termination.\n\nCLICK HERE: http://login.company-secure-login.biz/verify\n\n- IT Department',isPhish:true,tip:'Fake domain, all-caps urgency, threats, suspicious link.'},
  {from:'noreply@payroll.yourcompany.com',subject:'Paystub for this period is ready',body:'Hi,\n\nYour paystub for the current pay period is now available in the HR portal.\n\nLog in at hr.yourcompany.com to view it.\n\n- Payroll Team',isPhish:false,tip:'Correct company domain, no urgency, no suspicious links.'},
  {from:'ceo-message@corporat3.net',subject:'Personal request from CEO Richard',body:'Hello,\n\nThis is Richard. I need you to purchase $500 in Amazon gift cards for a client RIGHT NOW and send me the codes privately. Do not tell anyone.\n\n- Richard',isPhish:true,tip:'Gift card scam. Wrong domain, secrecy demands, CEO gift card requests are always scams.'},
  {from:'calendar@google.com',subject:'Meeting: Q4 Planning - 3pm Today',body:'You have been invited to a meeting:\n\nQ4 Budget Planning\nWhen: Today at 3:00 PM\nOrganizer: district.manager@yourcompany.com\n\nThis is a Google Calendar notification.',isPhish:false,tip:'Legitimate Google Calendar notification. Real google.com domain.'},
  {from:'security@your-company.support',subject:'Multi-Factor Authentication Required',body:'Your MFA token has expired. To maintain access:\n\nhttp://mfa-portal.your-company.support/enroll\n\nFailure to act within 24 hours will suspend your access.\n\n- Security Operations',isPhish:true,tip:'Unofficial hyphened support domain, urgency pressure tactic.'},
  {from:'helpdesk@yourcompany.com',subject:'Password Expiry Notice - 5 Days Remaining',body:'Your domain password will expire in 5 days.\n\nPlease update it at the IT Self-Service portal: https://helpdesk.yourcompany.com/password\n\n- IT Help Desk',isPhish:false,tip:'Correct company domain, portal link matches, reasonable timeframe.'},
];

function shuffleArray(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

let phishPool=[],phishIndex=0,phishScore=0,phishTotal=6,phishTimerInterval=null,phishTimeLeft=0,phishAnswered=false;

function setMikitaImg(v){
  const el=document.getElementById('mikita-game-img');
  if(el) el.src='assets/chars/mikita_'+v+'.png';
}

function openPhishingGame(){
  phishPool=shuffleArray(phishingEmails).slice(0,phishTotal);
  phishIndex=0;phishScore=0;phishAnswered=false;
  const overlay=document.getElementById('phishing-game-overlay');if(!overlay)return;
  overlay.style.display='flex';
  const el=document.getElementById('phish-score');if(el)el.innerText='0 / '+phishTotal;
  const rs=document.getElementById('phish-result-screen');if(rs)rs.style.display='none';
  const btns=document.getElementById('phish-buttons');if(btns)btns.style.display='flex';
  setMikitaImg('terminal');loadPhishEmail();
}

function loadPhishEmail(){
  if(phishIndex>=phishPool.length){endPhishGame();return;}
  const email=phishPool[phishIndex];phishAnswered=false;
  const s=document.getElementById('phish-sender');if(s)s.innerText=email.from;
  const sub=document.getElementById('phish-subject');if(sub)sub.innerText=email.subject;
  const body=document.getElementById('phish-body');if(body)body.innerText=email.body;
  const btns=document.getElementById('phish-buttons');if(btns){btns.style.display='flex';btns.style.pointerEvents='auto';btns.style.opacity='1';}
  const tf=document.getElementById('phish-timer-fill');
  if(tf){tf.style.transition='none';tf.style.width='100%';tf.style.backgroundColor='#00ffcc';void tf.offsetWidth;tf.style.transition='width 0.1s linear,background-color 0.3s';}
  if(phishTimerInterval)clearInterval(phishTimerInterval);
  phishTimeLeft=80;
  phishTimerInterval=setInterval(()=>{
    phishTimeLeft--;
    const pct=(phishTimeLeft/80)*100;
    if(tf){tf.style.width=pct+'%';tf.style.backgroundColor=pct<30?'#ff4444':pct<60?'#ff8800':'#00ffcc';}
    if(phishTimeLeft<=0){clearInterval(phishTimerInterval);if(!phishAnswered)answerPhish(null);}
  },100);
}

function answerPhish(userSaysPhish){
  if(phishAnswered)return;phishAnswered=true;
  if(phishTimerInterval)clearInterval(phishTimerInterval);phishTimerInterval=null;
  const email=phishPool[phishIndex];
  const correct=userSaysPhish!==null&&(userSaysPhish===email.isPhish);
  if(correct)phishScore++;
  const scoreEl=document.getElementById('phish-score');if(scoreEl)scoreEl.innerText=phishScore+' / '+phishTotal;
  const tf=document.getElementById('phish-timer-fill');if(tf)tf.style.backgroundColor=correct?'#00ff88':'#ff4444';
  const btns=document.getElementById('phish-buttons');if(btns){btns.style.pointerEvents='none';btns.style.opacity='0.4';}
  const bodyEl=document.getElementById('phish-body');
  const verdict=userSaysPhish===null?'⏱️ TIMED OUT!':correct?'✅ CORRECT!':'❌ WRONG!';
  const color=correct?'#00aa55':'#cc0000';
  const answer=email.isPhish?'🚩 PHISHING':'✅ LEGITIMATE';
  if(bodyEl)bodyEl.innerHTML=`<strong style="color:${color};font-size:1.4em;display:block;margin-bottom:8px">${verdict}</strong><span style="color:#666;font-size:0.9em">💡 ${email.tip}</span><br><br><em style="color:#888;font-size:0.85em">This email was: ${answer}</em>`;
  setTimeout(()=>{phishIndex++;if(phishIndex>=phishTotal)endPhishGame();else loadPhishEmail();},2500);
}

function endPhishGame(){
  if(phishTimerInterval)clearInterval(phishTimerInterval);
  const btns=document.getElementById('phish-buttons');if(btns)btns.style.display='none';
  const rs=document.getElementById('phish-result-screen');if(rs)rs.style.display='block';
  const fm=document.getElementById('phish-final-msg');
  const pct=phishScore/phishTotal;
  let reward=0,msg='',variant='instructor';
  if(pct>=0.85){reward=8000;msg='🏆 ELITE ANALYST!\n'+phishScore+'/'+phishTotal+' Correct\n+'+reward.toLocaleString()+' COINS!';variant='instructor';}
  else if(pct>=0.67){reward=3000;msg='✅ SOLID WORK!\n'+phishScore+'/'+phishTotal+' Correct\n+'+reward.toLocaleString()+' Coins';variant='idle';}
  else if(pct>=0.50){reward=800;msg='⚠️ NEEDS TRAINING\n'+phishScore+'/'+phishTotal+' Correct\n+'+reward+' Coins';variant='terminal';}
  else{reward=0;msg='❌ PHISHED!\n'+phishScore+'/'+phishTotal+' Correct\nMandatory retraining scheduled.';variant='terminal';}
  if(fm)fm.innerText=msg;setMikitaImg(variant);
  myCoins+=reward;updateUI();save();
}

/* ══════════════════════════════════════════════════════════════════════════
   ⚡ CORPORATE DASH — GEOMETRY DASH STYLE AUTO-RUNNER
   Click/Space/Tap = jump. Double jump available.
   One hit = death. Survive 60s = 60,000 coins.
   1,000 coins per second survived.
═══════════════════════════════════════════════════════════════════════════ */
let gdGame=null;

function openFirewallGame(){
  const overlay=document.getElementById('firewall-game-overlay');
  if(!overlay) return;
  overlay.innerHTML='';
  overlay.style.cssText='display:flex;position:fixed;inset:0;background:#000;z-index:200010;flex-direction:column;align-items:center;justify-content:center;font-family:VT323,monospace;user-select:none;';

  const statsBar=document.createElement('div');
  statsBar.style.cssText='display:flex;gap:50px;margin-bottom:14px;font-size:1.3rem;letter-spacing:2px;color:#00ffcc;';
  statsBar.innerHTML=`
    <span>⏱ <strong id="gd-time" style="color:#fff;font-size:1.5rem">0</strong>s <span style="color:#444">/ 60</span></span>
    <span style="color:#ff00ff;font-size:1.5rem;text-shadow:0 0 12px #ff00ff;">⚡ CORPORATE DASH</span>
    <span>💰 <strong id="gd-coins" style="color:#f1c40f;font-size:1.5rem">0</strong></span>
  `;
  overlay.appendChild(statsBar);

  const canvas=document.createElement('canvas');
  canvas.id='gd-canvas'; canvas.width=800; canvas.height=300;
  canvas.style.cssText='border:3px solid #00ffcc;box-shadow:0 0 40px rgba(0,255,204,0.5),0 0 80px rgba(0,255,204,0.15);max-width:96vw;display:block;cursor:pointer;';
  overlay.appendChild(canvas);

  const hint=document.createElement('div');
  hint.style.cssText='margin-top:12px;color:#555;font-size:1rem;letter-spacing:1px;';
  hint.innerText='CLICK · SPACE · TAP = JUMP     DOUBLE JUMP AVAILABLE     ONE HIT = DEATH';
  overlay.appendChild(hint);

  const quitBtn=document.createElement('button');
  quitBtn.innerText='✕ QUIT';
  quitBtn.style.cssText='margin-top:14px;padding:6px 28px;background:transparent;border:2px solid #333;color:#555;font-family:VT323,monospace;font-size:1.1rem;cursor:pointer;letter-spacing:1px;transition:all 0.2s;';
  quitBtn.onmouseenter=()=>{quitBtn.style.borderColor='#ff4444';quitBtn.style.color='#ff4444';};
  quitBtn.onmouseleave=()=>{quitBtn.style.borderColor='#333';quitBtn.style.color='#555';};
  quitBtn.onclick=()=>{ if(gdGame){gdGame.destroy();gdGame=null;} overlay.style.display='none'; };
  overlay.appendChild(quitBtn);

  if(gdGame){gdGame.destroy();gdGame=null;}
  gdGame=new GDGame(canvas);
  gdGame.start();
}

class GDGame {
  constructor(canvas){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.W=canvas.width; this.H=canvas.height;
    this.raf=null; this.running=false;
    this._keyFn=(e)=>{ if(e.code==='Space'){e.preventDefault();this.jump();} };
    this._clickFn=()=>this.jump();
    this._touchFn=(e)=>{e.preventDefault();this.jump();};
    window.addEventListener('keydown',this._keyFn);
    canvas.addEventListener('click',this._clickFn);
    canvas.addEventListener('touchstart',this._touchFn,{passive:false});
    this._initState();
  }

  destroy(){
    this.running=false;
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=null;}
    window.removeEventListener('keydown',this._keyFn);
    try{this.canvas.removeEventListener('click',this._clickFn);}catch(e){}
    try{this.canvas.removeEventListener('touchstart',this._touchFn);}catch(e){}
  }

  _initState(){
    this.t=0; this.worldX=0; this.dead=false; this.won=false;
    this.resultShown=false; this.lastFrameTime=null;
    this.GY=this.H-55;
    this.p={x:110,y:this.GY-36,w:34,h:34,vy:0,grounded:true,jumps:2,rot:0};
    this.obs=[]; this.nextObsX=this.W+250;
    this.parts=[];
    this.stars=Array.from({length:55},()=>({sx:Math.random()*this.W,sy:Math.random()*(this.GY*0.75),r:Math.random()*1.6+0.3,phase:Math.random()*Math.PI*2}));
    this._seedStart();
  }

  _seedStart(){
    for(const x of [620,960,1300]) this.obs.push({kind:'spike',x,w:30,h:38,y:this.GY-38});
    this.nextObsX=1300;
  }

  start(){
    this.running=true; this.lastFrameTime=performance.now();
    this.startTime=performance.now(); this._tick(performance.now());
  }

  jump(){
    if(!this.running||this.dead||this.won) return;
    if(this.p.jumps>0){ this.p.vy=-(500+this._speed()*0.12); this.p.grounded=false; this.p.jumps--; }
  }

  _speed(){
    const t=this.t;
    if(t<8)  return 260;
    if(t<20) return 260+(t-8)*16;
    if(t<35) return 452+(t-20)*8;
    if(t<50) return 572+(t-35)*5;
    return 647+(t-50)*3;
  }
  _gravity(){ return 1350+this.t*4; }
  _minGap(){
    const t=this.t;
    if(t<10) return 400; if(t<20) return 320;
    if(t<35) return 240; if(t<50) return 185;
    return 155;
  }

  _makeObs(x){
    const t=this.t,G=this.GY,r=Math.random();
    if(t<12){
      if(r<0.7) return {kind:'spike',x,w:30,h:38,y:G-38};
      return {kind:'spike2',x,spikes:[{w:30,h:38,y:G-38,dx:0},{w:30,h:44,y:G-44,dx:36}]};
    }
    if(t<28){
      if(r<0.35) return {kind:'spike',x,w:30,h:38,y:G-38};
      if(r<0.60) return {kind:'spike2',x,spikes:[{w:30,h:38,y:G-38,dx:0},{w:30,h:44,y:G-44,dx:36}]};
      if(r<0.80){const h=75+Math.random()*35;return {kind:'wall',x,w:22,h,y:G-h};}
      return {kind:'ceil',x,w:200,h:18,y:55};
    }
    if(t<45){
      if(r<0.20) return {kind:'spike',x,w:30,h:38,y:G-38};
      if(r<0.38) return {kind:'spike2',x,spikes:[{w:30,h:38,y:G-38,dx:0},{w:30,h:44,y:G-44,dx:36}]};
      if(r<0.52) return {kind:'spike3',x,spikes:[{w:28,h:36,y:G-36,dx:0},{w:28,h:44,y:G-44,dx:32},{w:28,h:36,y:G-36,dx:64}]};
      if(r<0.72){const h=80+Math.random()*40;return {kind:'wall',x,w:22,h,y:G-h};}
      return {kind:'ceil',x,w:180+Math.random()*80,h:20,y:48+Math.random()*20};
    }
    if(r<0.18) return {kind:'spike',x,w:30,h:38,y:G-38};
    if(r<0.34) return {kind:'spike3',x,spikes:[{w:28,h:36,y:G-36,dx:0},{w:28,h:44,y:G-44,dx:32},{w:28,h:36,y:G-36,dx:64}]};
    if(r<0.55){const h=85+Math.random()*45;return {kind:'wall',x,w:24,h,y:G-h};}
    if(r<0.75) return {kind:'ceil',x,w:160+Math.random()*100,h:22,y:45+Math.random()*15};
    return {kind:'combo',x,ceil:{w:170,h:20,y:50},spike:{w:30,h:38,y:G-38,dx:70}};
  }

  _tick(now){
    if(!this.running) return;
    const dt=Math.min((now-this.lastFrameTime)/1000,0.05);
    this.lastFrameTime=now;
    if(!this.dead&&!this.won) this._update(dt);
    this._draw();
    this.raf=requestAnimationFrame(t=>this._tick(t));
  }

  _update(dt){
    this.t+=dt; this.worldX+=this._speed()*dt;
    const gdTime=document.getElementById('gd-time');
    const gdCoins=document.getElementById('gd-coins');
    if(gdTime) gdTime.innerText=Math.floor(this.t);
    if(gdCoins) gdCoins.innerText=(Math.floor(this.t)*1000).toLocaleString();
    if(this.t>=60){this._win();return;}
    const p=this.p;
    p.vy+=this._gravity()*dt; p.y+=p.vy*dt;
    if(p.y>=this.GY-p.h){p.y=this.GY-p.h;p.vy=0;p.grounded=true;p.jumps=2;}
    else p.grounded=false;
    if(p.y<0){p.y=0;p.vy=Math.abs(p.vy)*0.3;}
    p.rot=p.grounded?0:p.rot+360*dt;
    while(this.nextObsX<this.worldX+this.W+500){
      this.nextObsX+=this._minGap()+Math.random()*160;
      this.obs.push(this._makeObs(this.nextObsX));
    }
    this.obs=this.obs.filter(o=>o.x-this.worldX>-300);
    for(const o of this.obs){ if(this._hits(p,o)){this._die();return;} }
    this.parts=this.parts.filter(pt=>pt.life>0);
    for(const pt of this.parts){pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.vy+=500*dt;pt.life-=dt;}
  }

  _sx(wx){return wx-this.worldX;}

  _hits(p,o){
    const M=5,px1=p.x+M,px2=p.x+p.w-M,py1=p.y+M,py2=p.y+p.h-M;
    const ov=(ax1,ay1,ax2,ay2,bx1,by1,bx2,by2)=>ax1<bx2&&ax2>bx1&&ay1<by2&&ay2>by1;
    const sx=this._sx(o.x);
    if(o.kind==='spike'||o.kind==='wall') return ov(px1,py1,px2,py2,sx,o.y,sx+o.w,o.y+o.h);
    if(o.kind==='ceil') return ov(px1,py1,px2,py2,sx,o.y,sx+o.w,o.y+o.h);
    if(o.kind==='spike2'||o.kind==='spike3'){for(const sp of o.spikes)if(ov(px1,py1,px2,py2,sx+(sp.dx||0),sp.y,sx+(sp.dx||0)+sp.w,sp.y+sp.h))return true;}
    if(o.kind==='combo'){const c=o.ceil,sp=o.spike;if(ov(px1,py1,px2,py2,sx,c.y,sx+c.w,c.y+c.h))return true;if(ov(px1,py1,px2,py2,sx+(sp.dx||0),sp.y,sx+(sp.dx||0)+sp.w,sp.y+sp.h))return true;}
    return false;
  }

  _die(){
    this.dead=true;
    const coins=Math.floor(this.t)*1000;
    for(let i=0;i<22;i++){const a=(i/22)*Math.PI*2;this.parts.push({x:this.p.x+this.p.w/2,y:this.p.y+this.p.h/2,vx:Math.cos(a)*(80+Math.random()*220),vy:Math.sin(a)*(80+Math.random()*220)-80,life:0.9+Math.random()*0.4,color:['#ff00ff','#00ffff','#ff3366','#f1c40f','#fff'][i%5]});}
    myCoins+=coins; updateUI(); save();
    setTimeout(()=>this._showDeath(coins),600);
  }

  _win(){
    this.won=true; myCoins+=60000; updateUI(); save();
    setTimeout(()=>this._showWin(),300);
  }

  _showDeath(coins){
    if(this.resultShown)return; this.resultShown=true;
    const overlay=document.getElementById('firewall-game-overlay'); if(!overlay)return;
    const div=document.createElement('div');
    div.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.87);z-index:20;text-align:center;font-family:VT323,monospace;';
    div.innerHTML=`
      <div style="font-size:3.8rem;color:#ff3366;text-shadow:0 0 25px #ff3366;margin-bottom:10px;">💀 YOU DIED 💀</div>
      <div style="font-size:1.7rem;color:#fff;margin-bottom:6px;">Survived <strong style="color:#f1c40f">${Math.floor(this.t)}s</strong> / 60s</div>
      <div style="font-size:1.3rem;color:#aaa;margin-bottom:28px;">+${coins.toLocaleString()} vapor coins earned</div>
      <div style="display:flex;gap:22px;">
        <button id="gd-retry" style="padding:10px 38px;background:linear-gradient(90deg,#ff00ff,#00ffff);border:3px solid #fff;color:#fff;font-family:VT323,monospace;font-size:1.7rem;cursor:pointer;letter-spacing:1px;">▶ TRY AGAIN</button>
        <button id="gd-quit" style="padding:10px 38px;background:transparent;border:2px solid #ff4444;color:#ff4444;font-family:VT323,monospace;font-size:1.7rem;cursor:pointer;letter-spacing:1px;">✕ QUIT</button>
      </div>`;
    overlay.appendChild(div);
    document.getElementById('gd-retry').onclick=()=>{ div.remove(); this._initState(); this.lastFrameTime=performance.now(); this.startTime=performance.now(); };
    document.getElementById('gd-quit').onclick=()=>{ this.destroy();gdGame=null;overlay.style.display='none'; };
  }

  _showWin(){
    if(this.resultShown)return; this.resultShown=true;
    const overlay=document.getElementById('firewall-game-overlay'); if(!overlay)return;
    const div=document.createElement('div');
    div.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.9);z-index:20;text-align:center;font-family:VT323,monospace;';
    div.innerHTML=`
      <div style="font-size:3.5rem;color:#00ff88;text-shadow:0 0 30px #00ff88;margin-bottom:10px;">🏆 FIREWALL CLEARED! 🏆</div>
      <div style="font-size:1.8rem;color:#fff;margin-bottom:8px;">You survived all 60 seconds!</div>
      <div style="font-size:2.2rem;color:#f1c40f;text-shadow:0 0 15px #f1c40f;margin-bottom:28px;">+60,000 VAPOR COINS</div>
      <button id="gd-done" style="padding:12px 52px;background:linear-gradient(90deg,#00ffcc,#00ff88);border:3px solid #fff;color:#000;font-family:VT323,monospace;font-size:1.9rem;cursor:pointer;letter-spacing:1px;">BACK TO WORK</button>`;
    overlay.appendChild(div);
    document.getElementById('gd-done').onclick=()=>{ this.destroy();gdGame=null;overlay.style.display='none'; };
  }

  _draw(){
    const ctx=this.ctx,W=this.W,H=this.H,GY=this.GY;
    const skyGrad=ctx.createLinearGradient(0,0,0,GY);
    skyGrad.addColorStop(0,'#03000f'); skyGrad.addColorStop(1,'#0a0025');
    ctx.fillStyle=skyGrad; ctx.fillRect(0,0,W,H);
    const gridOff=this.worldX%100;
    ctx.strokeStyle='rgba(0,255,204,0.06)'; ctx.lineWidth=1;
    for(let x=-gridOff;x<W;x+=100){ctx.beginPath();ctx.moveTo(x,GY);ctx.lineTo(x+30,H);ctx.stroke();}
    const now=performance.now()*0.001;
    for(const s of this.stars){ctx.globalAlpha=0.4+0.5*Math.abs(Math.sin(now+s.phase));ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.sx,s.sy,s.r,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    ctx.shadowBlur=14;ctx.shadowColor='#00ffcc';ctx.strokeStyle='#00ffcc';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,GY);ctx.lineTo(W,GY);ctx.stroke();ctx.shadowBlur=0;
    const groundGrad=ctx.createLinearGradient(0,GY,0,H);
    groundGrad.addColorStop(0,'rgba(0,255,204,0.22)');groundGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=groundGrad;ctx.fillRect(0,GY,W,H-GY);
    for(const o of this.obs){const sx=this._sx(o.x);if(sx>W+200||sx<-400)continue;this._drawObs(ctx,o,sx);}
    if(!this.dead){
      const p=this.p;
      ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h/2);ctx.rotate(p.rot*Math.PI/180);
      ctx.shadowBlur=18;ctx.shadowColor='#ff00ff';
      ctx.fillStyle='#dd00cc';ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.fillStyle='#00ffff';ctx.fillRect(-p.w/2+5,-p.h/2+5,p.w-10,p.h-10);
      ctx.fillStyle='#ff00ff';ctx.fillRect(3,-5,7,7);
      ctx.shadowBlur=0;ctx.restore();
      if(!p.grounded&&p.jumps===1){ctx.globalAlpha=0.85;ctx.fillStyle='#f1c40f';ctx.beginPath();ctx.arc(p.x+p.w/2,p.y-10,5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    }
    for(const pt of this.parts){ctx.globalAlpha=Math.max(0,pt.life);ctx.fillStyle=pt.color;ctx.shadowBlur=8;ctx.shadowColor=pt.color;ctx.fillRect(pt.x-4,pt.y-4,8,8);}
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    const prog=Math.min(this.t/60,1);
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,7);
    const barGrad=ctx.createLinearGradient(0,0,W,0);
    barGrad.addColorStop(0,'#ff00ff');barGrad.addColorStop(0.4,'#00ffcc');barGrad.addColorStop(1,'#00ff88');
    ctx.fillStyle=barGrad;ctx.fillRect(0,0,W*prog,7);
    if(this.t>45&&!this.dead&&!this.won){ctx.fillStyle=`rgba(255,0,0,${Math.abs(Math.sin(now*3))*0.07})`;ctx.fillRect(0,0,W,H);}
    if(!this.dead&&!this.won){ctx.fillStyle='rgba(255,255,255,0.18)';ctx.font='16px VT323,monospace';ctx.fillText('SPD '+Math.round(this._speed()),W-88,H-8);}
  }

  _drawObs(ctx,o,sx){
    const spike=(x,y,w,h,color)=>{
      ctx.shadowBlur=12;ctx.shadowColor=color;ctx.fillStyle=color;
      ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.22)';ctx.beginPath();ctx.moveTo(x+4,y+h-2);ctx.lineTo(x+w/2-1,y+4);ctx.lineTo(x+w/2+2,y+4);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;
    };
    if(o.kind==='spike') spike(sx,o.y,o.w,o.h,'#ff3366');
    else if(o.kind==='spike2'||o.kind==='spike3'){for(const sp of o.spikes)spike(sx+(sp.dx||0),sp.y,sp.w,sp.h,'#ff3366');}
    else if(o.kind==='wall'){
      ctx.shadowBlur=14;ctx.shadowColor='#ff00ff';
      const g=ctx.createLinearGradient(sx,0,sx+o.w,0);g.addColorStop(0,'#cc00aa');g.addColorStop(1,'#880066');
      ctx.fillStyle=g;ctx.fillRect(sx,o.y,o.w,o.h);
      ctx.fillStyle='rgba(255,255,0,0.1)';for(let wy=o.y;wy<o.y+o.h;wy+=18)ctx.fillRect(sx,wy,o.w,9);
      ctx.strokeStyle='#ff66ff';ctx.lineWidth=1.5;ctx.strokeRect(sx,o.y,o.w,o.h);ctx.shadowBlur=0;
    }
    else if(o.kind==='ceil'){
      ctx.shadowBlur=14;ctx.shadowColor='#00ffcc';
      const g=ctx.createLinearGradient(0,o.y,0,o.y+o.h);g.addColorStop(0,'#004433');g.addColorStop(1,'#00ffcc');
      ctx.fillStyle=g;ctx.fillRect(sx,o.y,o.w,o.h);
      ctx.strokeStyle='#00ffcc';ctx.lineWidth=1.5;ctx.strokeRect(sx,o.y,o.w,o.h);
      ctx.fillStyle='#00ffcc';for(let tx=sx+10;tx<sx+o.w-10;tx+=26){ctx.beginPath();ctx.moveTo(tx,o.y+o.h);ctx.lineTo(tx+8,o.y+o.h+16);ctx.lineTo(tx+16,o.y+o.h);ctx.closePath();ctx.fill();}
      ctx.shadowBlur=0;
    }
    else if(o.kind==='combo'){
      const c=o.ceil,sp=o.spike;
      ctx.shadowBlur=12;ctx.shadowColor='#00ffcc';ctx.fillStyle='#00aa88';
      ctx.fillRect(sx,c.y,c.w,c.h);ctx.strokeStyle='#00ffcc';ctx.lineWidth=1;ctx.strokeRect(sx,c.y,c.w,c.h);ctx.shadowBlur=0;
      spike(sx+(sp.dx||0),sp.y,sp.w,sp.h,'#ff3366');
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BIND ALL INTERACTIONS
═══════════════════════════════════════════════════════════════════════════ */
function bindInteractions(){
  console.log('=== bindInteractions called ===');

  // Clock In
  const btnClockIn=document.getElementById('btn-clock-in');
  if(btnClockIn){
    btnClockIn.addEventListener('click',()=>{
      const input=document.getElementById('username-input');
      const name=input?input.value.trim():'';
      if(!name){alert('Enter your Employee ID first!');return;}
      myUser=name; save();
      document.getElementById('login-screen').style.display='none';
      document.getElementById('game-container').style.display='block';
      bgm.play().catch(()=>{});
      // Add own card to player row
      upsertPlayerCard(myUser);
      // Register in Firebase for multiplayer
      registerEmployee(myUser);
      updateUI();
    });
  }

  // Battle arena & attack button both trigger attack
  const btnAttack=document.getElementById('btn-attack');
  if(btnAttack) btnAttack.addEventListener('click',attack);
  const arena=document.getElementById('battle-arena');
  if(arena) arena.addEventListener('click',(e)=>{
    // Don't fire attack if clicking a skill slot or frenzy bar
    if(e.target.closest('#skill-panel')||e.target.closest('.action-buttons')) return;
    attack(e);
  });

  // Shop
  const buyClick=document.getElementById('buy-click');
  if(buyClick) buyClick.addEventListener('click',()=>{if(myCoins>=clickCost){myCoins-=clickCost;myClickDmg+=2500;clickCost=Math.ceil(clickCost*1.6);updateUI();save();}});
  const buyAuto=document.getElementById('buy-auto');
  if(buyAuto) buyAuto.addEventListener('click',()=>{if(myCoins>=autoCost){myCoins-=autoCost;myAutoDmg+=1000;autoCost=Math.ceil(autoCost*1.6);if(myAutoDmg===1000)startAutoTimer();updateUI();save();}});
  const buyCrit=document.getElementById('buy-crit');
  if(buyCrit) buyCrit.addEventListener('click',()=>{if(myCoins>=critCost){myCoins-=critCost;critChance+=5;critCost=Math.ceil(critCost*1.8);updateUI();save();}});
  const buyOvertime=document.getElementById('buy-overtime');
  if(buyOvertime) buyOvertime.addEventListener('click',()=>{if(!overtimeUnlocked&&myCoins>=200){myCoins-=200;overtimeUnlocked=true;if(myAutoDmg>0)startAutoTimer();updateUI();save();}});
  const buySynergy=document.getElementById('buy-synergy');
  if(buySynergy) buySynergy.addEventListener('click',()=>{if(myCoins>=synergyCost){myCoins-=synergyCost;synergyLevel++;synergyCost=Math.ceil(synergyCost*1.8);updateUI();save();}});
  const buyRage=document.getElementById('buy-rage');
  if(buyRage) buyRage.addEventListener('click',()=>{if(!rageFuelUnlocked&&myCoins>=rageCost){myCoins-=rageCost;rageFuelUnlocked=true;updateUI();save();}});
  const buyHustle=document.getElementById('buy-hustle');
  if(buyHustle) buyHustle.addEventListener('click',()=>{if(myCoins>=hustleCost){myCoins-=hustleCost;hustleCoinsPerClick+=2;hustleCost=Math.ceil(hustleCost*1.5);updateUI();save();}});

  // Skills
  const skillPhishing=document.getElementById('skill-phishing');
  if(skillPhishing) skillPhishing.addEventListener('click',()=>{const o=document.getElementById('mikita-overlay');if(o)o.style.display='flex';});
  const skillFirewall=document.getElementById('skill-firewall');
  if(skillFirewall) skillFirewall.addEventListener('click',openFirewallGame);

  // Mikita overlay
  const mikitaClose=document.getElementById('mikita-close');
  if(mikitaClose) mikitaClose.addEventListener('click',()=>{document.getElementById('mikita-overlay').style.display='none';});
  const mikitaStart=document.getElementById('mikita-start-game-btn');
  if(mikitaStart) mikitaStart.addEventListener('click',()=>{document.getElementById('mikita-overlay').style.display='none';openPhishingGame();});

  // Phishing game
  const btnLegit=document.getElementById('btn-legit');
  if(btnLegit) btnLegit.addEventListener('click',()=>answerPhish(false));
  const btnPhish=document.getElementById('btn-phish');
  if(btnPhish) btnPhish.addEventListener('click',()=>answerPhish(true));
  const phishClose=document.getElementById('phish-close-btn');
  if(phishClose) phishClose.addEventListener('click',()=>{document.getElementById('phishing-game-overlay').style.display='none';});

  console.log('=== bindInteractions complete ===');
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',bindInteractions);
} else {
  bindInteractions();
}

console.log('✅ Corporate Takedown ready!');
