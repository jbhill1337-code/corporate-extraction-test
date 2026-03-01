/* Check if bindInteractions is being called */
console.log('=== SCRIPT LOADED ===');

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

const bgm = new Audio('nocturnal-window-lights.mp3');
bgm.loop = true;
bgm.volume = 0.15;

const clickSfxFiles = ['sfx pack/Boss hit 1.wav', 'sfx pack/Bubble 1.wav', 'sfx pack/Hit damage 1.wav', 'sfx pack/Select 1.wav'];
const attackSounds = clickSfxFiles.map(file => { const audio = new Audio(encodeURI(file)); audio.volume = 0.3; return audio; });

function playClickSound() {
  try {
    const randomIdx = Math.floor(Math.random() * attackSounds.length);
    const sound = attackSounds[randomIdx].cloneNode();
    sound.volume = 0.3;
    sound.play().catch(e => {});
  } catch(e) {}
}

function injectStyles() {
  const style = document.createElement('style');
  style.innerHTML = `
    #game-container{max-width:1600px!important;margin:0 auto!important;display:flex!important;flex-direction:column!important;padding:10px!important;align-items:center!important;box-sizing:border-box!important}
    #boss-name{width:100%!important;text-align:center!important}
    #game-wrapper{width:100%!important;display:flex!important;flex-direction:row!important;gap:15px!important;align-items:flex-start!important;justify-content:center!important}
    #center-col{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important}
    .side-col{flex:0 0 240px!important;width:240px!important}
    #boss-area{display:flex!important;align-items:flex-end!important;justify-content:center!important;gap:60px!important;width:100%!important;position:relative!important;overflow:visible!important;cursor:pointer!important;padding-bottom:10px!important;min-height:420px!important;border-radius:4px!important;box-shadow:0 0 0 2px #1a0030,0 0 40px rgba(80,0,180,0.35)!important}
    #office-bg-layer{position:absolute!important;inset:0!important;background-image:url('assets/backgrounds/office_bg.png')!important;background-size:cover!important;background-position:center bottom!important;background-repeat:no-repeat!important;z-index:0!important;pointer-events:none!important;border-radius:4px!important}
    .boss-char-wrapper{display:flex!important;flex-direction:column!important;align-items:center!important;flex-shrink:0!important}
    .boss-char-inner{width:260px!important;height:320px!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;overflow:visible!important;position:relative!important;flex-shrink:0!important}
    #boss-image,#companion-image{position:static!important;display:block!important;width:260px!important;height:320px!important;object-fit:contain!important;object-position:bottom center!important;image-rendering:pixelated!important;image-rendering:crisp-edges!important}
    #boss-hit-layer,#companion-hit-layer{position:absolute!important;bottom:0!important;left:0!important;width:260px!important;height:320px!important;object-fit:contain!important;object-position:bottom center!important;image-rendering:pixelated!important;pointer-events:none!important}
    #richard-event-container{pointer-events:none;position:fixed;bottom:0;left:0;width:100vw;height:100vh;z-index:99999;overflow:hidden}
    #richard-image{position:absolute;bottom:-5px;height:30vh;width:auto;image-rendering:pixelated;opacity:0;transition:opacity 1.2s ease,transform 1.2s ease;transform:translateX(-160px);object-fit:contain;filter:drop-shadow(0 0 15px #00ffff)}
    #richard-event-container.active #richard-image{opacity:0.85;transform:translateX(0)!important}
    #richard-dialogue{position:absolute;bottom:30vh;padding:10px 15px;background-color:rgba(0,0,0,0.92);color:#fff;border:2px solid #00ffff;font-size:1.1rem;max-width:260px;text-align:center;text-transform:uppercase;opacity:0;transform:scale(0.8);transition:opacity 0.5s 1.5s,transform 0.5s 1.5s;box-shadow:4px 4px 0 #ff00ff;font-family:'VT323',monospace;letter-spacing:1px}
    #richard-event-container.active #richard-dialogue{opacity:1;transform:scale(1)}
    @media(max-width:900px){#game-wrapper{flex-direction:column!important;align-items:center!important}.side-col{width:100%!important;max-width:400px!important;flex:none!important}#boss-image,#companion-image{width:180px!important;height:220px!important}.boss-char-inner{width:180px!important;height:220px!important}}
  `;
  document.head.appendChild(style);
}

let myCoins = 0, myClickDmg = 2500, myAutoDmg = 0, multi = 1, frenzy = 0;
let clickCost = 10, autoCost = 50, critChance = 0, critCost = 100, myUser = '', lastManualClick = 0;
let myInventory = {}, itemBuffMultiplier = 1.0, isAnimatingHit = false;
let overtimeUnlocked = false, synergyLevel = 0, rageFuelUnlocked = false, hustleCoinsPerClick = 0;
let synergyCost = 150, rageCost = 75, hustleCost = 30;

const daveHitFrames = ['assets/hit/dave-hit-1.png', 'assets/hit/dave-hit-2.png'];
const richHitFrames = ['assets/phases/rich/rich_hit_a.png', 'assets/phases/rich/rich_hit_b.png'];

const richardQuotes = [
  "SYNERGY IS KEY.","LET'S CIRCLE BACK.","LIVIN' THE DREAM.","CHECK THE BACK ROOM.",
  "BANDWIDTH EXCEEDED.","RESULTS SPEAK LOUDEST.","WHO TOUCHED MY STAPLER?",
  "MAXIMIZE YOUR OUTPUT.","LEVERAGE THE PIPELINE.","GROWTH MINDSET, PEOPLE.",
  "FAILURE IS NOT OPTIMAL.","PING ME ON SLACK.","DISRUPT THE DISRUPTION.",
  "WE'RE A FAMILY HERE...","QUARTERLY OR BUST.","DELIVER VALUE, OR ELSE.",
  "THINK OUTSIDE THE BOX.","MY DOOR IS ALWAYS CLOSED.","SCALE IT, NOW."
];

const companions = {
  larry:{frames:['chars/larry_frame1.png','chars/larry_frame2.png','chars/larry_frame3.png','chars/larry_frame4.png','chars/larry_frame5.png','chars/larry_frame6.png'],speed:380},
  manny:{frames:['chars/manny_frame1.png','chars/manny_frame2.png','chars/manny_frame3.png','chars/manny_frame4.png','chars/manny_frame5.png','chars/manny_frame6.png'],speed:130}
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

const lootTable = [
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

function rollLoot(x,y){
  const roll=Math.random();let pool;
  if(roll<0.008)pool=lootTable.filter(i=>i.rarity==='legendary');
  else if(roll<0.030)pool=lootTable.filter(i=>i.rarity==='rare');
  else if(roll<0.090)pool=lootTable.filter(i=>i.rarity==='uncommon');
  else if(roll<0.150)pool=lootTable.filter(i=>i.rarity==='common');
  else return;
  const item=pool[Math.floor(Math.random()*pool.length)];
  if(!myInventory[item.name])myInventory[item.name]={...item,count:0};
  myInventory[item.name].count++;
  recalcItemBuff();renderInventory();save();
  const colorMap={legendary:'#FFD700',rare:'#3498db',uncommon:'#2ecc71',common:'#fff'};
  const popup=document.createElement('div');popup.className='loot-popup';
  popup.innerText=item.emoji+' '+item.name+'!';
  const tx=(Math.random()-0.5)*120,ty=-80-Math.random()*60,rot=(Math.random()-0.5)*20;
  popup.style.cssText=`left:${x}px;top:${y}px;--tx:${tx}px;--ty:${ty}px;--rot:${rot}deg;color:${colorMap[item.rarity]};`;
  document.body.appendChild(popup);setTimeout(()=>popup.remove(),3500);
}

function recalcItemBuff(){
  let totalBonus=0;
  for(const key in myInventory)totalBonus+=myInventory[key].bonus*myInventory[key].count;
  itemBuffMultiplier=1.0+totalBonus;
  const el=document.getElementById('loot-buff');if(el)el.innerText=Math.round(totalBonus*100);
}

function renderInventory(){
  const grid=document.getElementById('inventory-grid');if(!grid)return;
  grid.innerHTML='';
  for(const key in myInventory){
    const item=myInventory[key];
    const div=document.createElement('div');div.className='inv-item rarity-'+item.rarity;
    div.innerHTML='<span style="font-size:24px">'+item.emoji+'</span><span class="inv-count">'+item.count+'</span><div class="inv-tooltip">'+item.name+'<br>'+item.desc+'</div>';
    grid.appendChild(div);
  }
}

const introContainer=document.getElementById('intro-container');

function initSystem(){
  injectStyles();
  const bImg=document.getElementById('boss-image');const cImg=document.getElementById('companion-image');
  if(bImg)bImg.src='assets/phases/dave/dave_phase1.png';
  if(cImg)cImg.src='chars/larry_frame1.png';
  const bossArea=document.getElementById('boss-area');
  if(bossArea&&!document.getElementById('office-bg-layer')){
    const bgLayer=document.createElement('div');bgLayer.id='office-bg-layer';
    bgLayer.style.cssText='position:absolute;inset:0;background-image:url(\'assets/backgrounds/office_bg.png\');background-size:cover;background-position:center bottom;background-repeat:no-repeat;z-index:0;pointer-events:none;border-radius:4px;';
    bossArea.insertBefore(bgLayer,bossArea.firstChild);bossArea.style.position='relative';
    Array.from(bossArea.children).forEach(child=>{if(child.id!=='office-bg-layer'){child.style.position='relative';child.style.zIndex='1';}});
  }
  startRichardLoop();restartCompanionAnim();renderInventory();recalcItemBuff();
  if(myAutoDmg>0)startAutoTimer();
}

let ytPlayer=null;let introEnded=false;

const endIntro=()=>{
  if(introEnded)return;introEnded=true;
  try{if(ytPlayer){ytPlayer.stopVideo();ytPlayer.destroy();ytPlayer=null;}}catch(e){}
  const ytEl=document.getElementById('yt-player');
  if(ytEl){ytEl.src='';ytEl.style.display='none';}
  glitchTransition(()=>{if(introContainer)introContainer.style.display='none';initSystem();load();});
};

function glitchTransition(callback){
  const glitch=document.createElement('div');glitch.id='glitch-overlay';
  glitch.style.cssText='position:fixed;inset:0;z-index:99998;pointer-events:none;background:#000;opacity:0;';
  document.body.appendChild(glitch);
  const canvas=document.createElement('canvas');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;glitch.appendChild(canvas);
  const ctx=canvas.getContext('2d');let frame=0;const totalFrames=40;
  const glitchColors=['#ff00ff','#00ffff','#ffffff','#ff0000','#00ff00'];
  function drawGlitch(intensity){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const numSlices=Math.floor(4+intensity*12);
    for(let i=0;i<numSlices;i++){
      ctx.fillStyle=glitchColors[Math.floor(Math.random()*glitchColors.length)];
      ctx.globalAlpha=Math.random()*0.6*intensity;
      ctx.fillRect((Math.random()-0.5)*80*intensity,Math.random()*canvas.height,canvas.width,Math.random()*30*intensity+2);
    }
    ctx.globalAlpha=0.15*intensity;ctx.fillStyle='#000';
    for(let y=0;y<canvas.height;y+=4)ctx.fillRect(0,y,canvas.width,2);ctx.globalAlpha=1;
  }
  function animate(){
    frame++;const progress=frame/totalFrames;
    if(progress<0.3){glitch.style.opacity=progress/0.3*0.85;drawGlitch(progress/0.3);}
    else if(progress<0.6){glitch.style.opacity='1';glitch.style.background='#fff';ctx.clearRect(0,0,canvas.width,canvas.height);drawGlitch(1);}
    else if(progress<0.7){glitch.style.background='#000';glitch.style.opacity='1';ctx.clearRect(0,0,canvas.width,canvas.height);if(frame===Math.floor(totalFrames*0.6)+1)callback();}
    else{const f=1-((progress-0.7)/0.3);glitch.style.opacity=Math.max(0,f);drawGlitch(f);if(progress>=1){glitch.remove();return;}}
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

(function(){const s=document.getElementById('skip-intro-btn');if(s){s.style.display='block';s.onclick=endIntro;}})();

window.onYouTubeIframeAPIReady=function(){
  if(isOBS||!introContainer)return;
  ytPlayer=new YT.Player('yt-player',{
    videoId:'HeKNgnDyD7I',
    playerVars:{playsinline:1,controls:0,disablekb:1,fs:0,modestbranding:1,rel:0,origin:window.location.origin},
    events:{
      onReady:(e)=>{const btn=document.getElementById('start-intro-btn');if(btn){btn.style.display='block';btn.onclick=()=>{btn.style.display='none';document.getElementById('yt-player').style.display='block';e.target.playVideo();};}},
      onStateChange:(e)=>{if(e.data===0)endIntro();}
    }
  });
};

let currentBossLevel=1;

if(bossRef){
  bossRef.on('value',snap=>{
    let b=snap.val();if(!b)return;if(b.health<=0)return handleDefeat(b);
    const maxHP=1000000000*b.level;const isDave=(b.level%2!==0);
    currentBossIsDave=isDave;currentBossLevel=b.level;
    const cName=document.getElementById('companion-name');const bName=document.getElementById('main-boss-name');
    const armor=Math.round(getBossArmor()*100);
    if(cName)cName.innerText=isDave?'Security Larry':'Intern Manny';
    if(bName)bName.innerText=(isDave?'VP Dave':'DM Rich')+' · Lv.'+b.level+(armor>0?' 🛡️'+armor+'%':'');
    const newComp=isDave?companions.larry:companions.manny;
    if(newComp!==currentCompanion){currentCompanion=newComp;frameIndex=0;restartCompanionAnim();const cImg=document.getElementById('companion-image');if(cImg)cImg.src=currentCompanion.frames[0];}
    const bImg=document.getElementById('boss-image');
    if(bImg&&!isAnimatingHit){const phase=b.health/maxHP;const prefix=isDave?'assets/phases/dave/dave_phase':'assets/phases/rich/rich_phase';bImg.src=prefix+(phase<=0.25?'4':phase<=0.50?'3':phase<=0.75?'2':'1')+'.png';}
    const fill=document.getElementById('health-bar-fill');const txt=document.getElementById('health-text');
    if(fill)fill.style.width=(Math.max(0,b.health/maxHP)*100)+'%';
    if(txt)txt.innerText=Math.max(0,b.health).toLocaleString()+' / '+maxHP.toLocaleString();
  });
}

function handleDefeat(b){
  let nextLvl=b.level+1;
  if(nextLvl>10){
    nextLvl=1;const active=(Date.now()-lastManualClick)<10000;myCoins+=active?1000000:250000;
    const popup=document.createElement('div');popup.className='loot-popup';
    popup.innerText=active?'ACTIVE PRESTIGE! +1M COINS':'PRESTIGE! +250K COINS';
    popup.style.cssText='left:50%;top:50%;--tx:0px;--ty:-80px;--rot:0deg;';
    document.body.appendChild(popup);setTimeout(()=>popup.remove(),3500);updateUI();
  }
  bossRef.set({level:nextLvl,health:1000000000*nextLvl});
}

setInterval(()=>{
  frenzy=Math.max(0,frenzy-(rageFuelUnlocked?1:2));
  multi=frenzy>=100?5:frenzy>=75?3:frenzy>=50?2:1;
  const fill=document.getElementById('frenzy-bar-fill');const txt=document.getElementById('frenzy-text');
  if(fill)fill.style.width=frenzy+'%';if(txt)txt.innerText=multi>1?'COMBO '+multi+'x':'CHARGE METER';
  const md=document.getElementById('shop-multi-display');if(md)md.innerText=multi.toFixed(2);
},100);

function getBossArmor(){if(!bossRef)return 0;return Math.min(0.55,Math.max(0,(currentBossLevel-1)*0.065));}

function attack(e){
  if(isOBS)return;lastManualClick=Date.now();playClickSound();
  if(!isAnimatingHit){
    isAnimatingHit=true;
    const bArea=document.getElementById('boss-area');
    if(bArea){bArea.style.filter='drop-shadow(0 0 30px rgba(255,0,0,0.4))';setTimeout(()=>bArea.style.filter='none',300);}
    const bImg=document.getElementById('boss-image');
    if(bImg){const old=bImg.src;const frames=currentBossIsDave?daveHitFrames:richHitFrames;bImg.src=frames[Math.floor(Math.random()*frames.length)];bImg.style.transform='scale(1.05)';setTimeout(()=>{bImg.src=old;bImg.style.transform='scale(1)';},200);}
    setTimeout(()=>{const cImg=document.getElementById('companion-image');if(cImg){cImg.style.transform='scale(1.05)';setTimeout(()=>{cImg.style.transform='scale(1)';isAnimatingHit=false;},200);}},100);
  }
  const isCrit=(Math.random()*100)<critChance;const synergyBonus=1+(synergyLevel*0.10);const armor=getBossArmor();
  const rawDmg=Math.floor(myClickDmg*multi*itemBuffMultiplier*synergyBonus*(isCrit?5:1));const dmg=Math.floor(rawDmg*(1-armor));
  if(bossRef)bossRef.transaction(b=>{if(b)b.health-=dmg;return b;});
  myCoins+=(1+hustleCoinsPerClick)*multi;frenzy=Math.min(100,frenzy+8);updateUI();save();
  const clickX=e.clientX||window.innerWidth/2;const clickY=e.clientY||window.innerHeight/2;
  const tx=(Math.random()-0.5)*100,ty=-60-Math.random()*60,rot=(Math.random()-0.5)*20;
  const p=document.createElement('div');p.className=isCrit?'damage-popup crit-popup':'damage-popup';
  p.innerText='+'+dmg.toLocaleString();p.style.cssText='left:'+clickX+'px;top:'+clickY+'px;--tx:'+tx+'px;--ty:'+ty+'px;--rot:'+rot+'deg;';
  document.body.appendChild(p);setTimeout(()=>p.remove(),1200);
  if(Math.random()<0.02)rollLoot(clickX,clickY-80);
}

let autoTimer;
function startAutoTimer(){
  if(autoTimer)clearInterval(autoTimer);
  autoTimer=setInterval(()=>{
    if(myAutoDmg>0&&bossRef){const armor=getBossArmor();const autoDmgReduced=Math.floor(myAutoDmg*(1-armor));bossRef.transaction(b=>{if(b)b.health-=autoDmgReduced;return b;});}
    if(Math.random()<0.005)rollLoot(window.innerWidth/2+(Math.random()-0.5)*200,window.innerHeight*0.4);
  },overtimeUnlocked?600:1000);
}

function updateUI(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.innerText=v;};
  set('coin-count',myCoins.toLocaleString());set('click-power',myClickDmg.toLocaleString());
  set('auto-power',myAutoDmg.toLocaleString());set('crit-chance-display',critChance);
  set('loot-buff',Math.round((itemBuffMultiplier-1)*100));
  const bc=document.getElementById('buy-click');if(bc)bc.innerHTML='⚔️ Sharpen Blade (+2.5k dmg)<br><span>Cost: '+clickCost.toLocaleString()+'</span>';
  const ba=document.getElementById('buy-auto');if(ba)ba.innerHTML='🪖 Hire Merc (+1k/s)<br><span>Cost: '+autoCost.toLocaleString()+'</span>';
  const cr=document.getElementById('buy-crit');if(cr)cr.innerHTML='🎯 Lucky Shot (+5% crit)<br><span class="cost-tag">Cost: '+critCost.toLocaleString()+'</span>';
  const bo=document.getElementById('buy-overtime');
  if(bo){if(overtimeUnlocked){bo.innerHTML='⏱️ Overtime (faster auto)<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';bo.style.opacity='0.6';bo.style.cursor='default';}else{bo.innerHTML='⏱️ Overtime (faster auto)<br><span class="cost-tag">Cost: 200</span>';bo.style.opacity='1';bo.style.cursor='pointer';}}
  const bs=document.getElementById('buy-synergy');if(bs)bs.innerHTML='⚡ Synergy Boost (+10% dmg)<br><span class="cost-tag">Lv.'+synergyLevel+' · Cost: '+synergyCost.toLocaleString()+'</span>';
  const br=document.getElementById('buy-rage');
  if(br){if(rageFuelUnlocked){br.innerHTML='🔥 Rage Fuel (slower decay)<br><span class="cost-tag" style="color:#00ff88">✅ ACTIVE</span>';br.style.opacity='0.6';br.style.cursor='default';}else{br.innerHTML='🔥 Rage Fuel (slower decay)<br><span class="cost-tag">Cost: '+rageCost.toLocaleString()+'</span>';br.style.opacity='1';br.style.cursor='pointer';}}
  const bh=document.getElementById('buy-hustle');if(bh)bh.innerHTML='💰 Side Hustle (+2 coins/click)<br><span class="cost-tag">Cost: '+hustleCost.toLocaleString()+'</span>';
}

function save(){
  if(!isOBS)localStorage.setItem('gwm_v13',JSON.stringify({c:myCoins,cd:myClickDmg,ad:myAutoDmg,ac:autoCost,cc:clickCost,critC:critChance,critCost:critCost,u:myUser,inv:myInventory,ot:overtimeUnlocked,syn:synergyLevel,rf:rageFuelUnlocked,hc:hustleCoinsPerClick,sc:synergyCost,rc:rageCost,hcost:hustleCost}));
}

function load(){
  const s=localStorage.getItem('gwm_v13');if(!s)return;
  const d=JSON.parse(s);
  myCoins=d.c||0;myClickDmg=d.cd||2500;myAutoDmg=d.ad||0;autoCost=d.ac||50;clickCost=d.cc||10;
  critChance=d.critC||0;critCost=d.critCost||100;myUser=d.u||'';myInventory=d.inv||{};
  overtimeUnlocked=d.ot||false;synergyLevel=d.syn||0;rageFuelUnlocked=d.rf||false;
  hustleCoinsPerClick=d.hc||0;synergyCost=d.sc||150;rageCost=d.rc||75;hustleCost=d.hcost||30;
  const u=document.getElementById('username-input');if(u&&myUser)u.value=myUser;
  recalcItemBuff();renderInventory();updateUI();if(myAutoDmg>0)startAutoTimer();
}

let usedRichardQuotes=[];
function startRichardLoop(){
  setTimeout(()=>{
    const c=document.getElementById('richard-event-container');const d=document.getElementById('richard-dialogue');const img=document.getElementById('richard-image');
    if(!c||!d||!img){setTimeout(startRichardLoop,5000);return;}
    if(usedRichardQuotes.length>=richardQuotes.length)usedRichardQuotes=[];
    const available=richardQuotes.filter(q=>!usedRichardQuotes.includes(q));
    const quote=available[Math.floor(Math.random()*available.length)];usedRichardQuotes.push(quote);d.innerText=quote;
    const imgs=['yourbossvar/boss-crossing.png','yourbossvar/boss-pointing.png'];
    img.src=imgs[Math.floor(Math.random()*imgs.length)];img.style.display='block';
    const fromLeft=Math.random()>0.5;
    img.style.left=fromLeft?'10px':'auto';img.style.right=fromLeft?'auto':'10px';
    img.style.transform=fromLeft?'translateX(-160px)':'translateX(160px)';
    d.style.left=fromLeft?'6vw':'auto';d.style.right=fromLeft?'auto':'6vw';
    void c.offsetWidth;c.classList.add('active');
    setTimeout(()=>{c.classList.remove('active');setTimeout(startRichardLoop,3000);},8000);
  },30000+Math.random()*20000);
}

/* ══════════════════════════════════════════════════════════════════════════
   PHISHING MINIGAME
═══════════════════════════════════════════════════════════════════════════ */
const phishingEmails=[
  {from:'it-support@company-secure-login.biz',subject:'URGENT: Your account will be DELETED!!!',body:'Dear User,\n\nYour account has been flagged. You MUST verify immediately or face permanent termination.\n\nCLICK HERE: http://login.company-secure-login.biz/verify\n\n- IT Department',isPhish:true,tip:'Fake domain, all-caps urgency, threats, suspicious link.'},
  {from:'noreply@payroll.yourcompany.com',subject:'Paystub for this period is ready',body:'Hi,\n\nYour paystub for the current pay period is now available in the HR portal.\n\nLog in at hr.yourcompany.com to view it.\n\n- Payroll Team',isPhish:false,tip:'Correct company domain, no urgency, no suspicious links.'},
  {from:'ceo-message@corporat3.net',subject:'Personal request from CEO Richard',body:'Hello,\n\nThis is Richard. I need you to purchase $500 in Amazon gift cards for a client RIGHT NOW and send me the codes privately. Do not tell anyone.\n\n- Richard',isPhish:true,tip:'Gift card scam. Wrong domain, secrecy demands, and "CEO" never legitimately asks for gift cards.'},
  {from:'calendar@google.com',subject:'Meeting: Q4 Planning - 3pm Today',body:'You have been invited to a meeting:\n\nQ4 Budget Planning\nWhen: Today at 3:00 PM\nOrganizer: district.manager@yourcompany.com\n\nThis is a Google Calendar notification.',isPhish:false,tip:'Legitimate Google Calendar notification. Real google.com domain.'},
  {from:'security@your-company.support',subject:'Multi-Factor Authentication Required',body:'Your MFA token has expired. To maintain access:\n\nhttp://mfa-portal.your-company.support/enroll\n\nFailure to act within 24 hours will suspend your access.\n\n- Security Operations',isPhish:true,tip:'Unofficial hyphened support domain, urgency pressure tactic.'},
  {from:'helpdesk@yourcompany.com',subject:'Password Expiry Notice - 5 Days Remaining',body:'Your domain password will expire in 5 days.\n\nPlease update it at the IT Self-Service portal: https://helpdesk.yourcompany.com/password\n\n- IT Help Desk',isPhish:false,tip:'Correct company domain, portal link matches, reasonable timeframe.'},
];

function shuffleArray(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

let phishPool=[],phishIndex=0,phishScore=0,phishTotal=6;
let phishTimer=null,phishTimeLeft=0,phishAnswered=false;

function setMikitaImg(variant){const src='assets/chars/mikita_'+variant+'.png';document.querySelectorAll('#mikita-char-img').forEach(img=>img.src=src);}

function openPhishingGame(){
  phishPool=shuffleArray(phishingEmails).slice(0,phishTotal);phishIndex=0;phishScore=0;phishAnswered=false;
  const overlay=document.getElementById('phishing-game-overlay');if(!overlay)return;overlay.style.display='flex';
  const el=document.getElementById('phish-score');if(el)el.innerText='0 / '+phishTotal;
  const rs=document.getElementById('phish-result-screen');if(rs)rs.style.display='none';
  const btns=document.getElementById('phish-buttons');if(btns)btns.style.display='flex';
  setMikitaImg('terminal');loadPhishEmail();
}

function loadPhishEmail(){
  if(phishIndex>=phishPool.length)return endPhishGame();
  const email=phishPool[phishIndex];phishAnswered=false;
  const emailClient=document.querySelector('.email-client');
  if(emailClient){emailClient.style.transition='opacity 0.25s ease,transform 0.25s ease';emailClient.style.opacity='1';emailClient.style.transform='translateY(0)';}
  const s=document.getElementById('phish-sender');if(s)s.innerText=email.from;
  const sub=document.getElementById('phish-subject');if(sub)sub.innerText=email.subject;
  const body=document.getElementById('phish-body');if(body){body.innerText=email.body;body.style.opacity='1';}
  const btns=document.getElementById('phish-buttons');if(btns){btns.style.display='flex';btns.style.pointerEvents='auto';btns.style.opacity='1';}
  const tf=document.getElementById('phish-timer-fill');
  if(tf){tf.style.transition='none';tf.style.width='100%';tf.style.backgroundColor='#00ffcc';void tf.offsetWidth;tf.style.transition='width 0.1s linear,background-color 0.3s';}
  if(phishTimer)clearInterval(phishTimer);phishTimeLeft=80;
  phishTimer=setInterval(()=>{
    phishTimeLeft--;const pct=(phishTimeLeft/80)*100;
    if(tf){tf.style.width=pct+'%';tf.style.backgroundColor=pct<30?'#ff4444':pct<60?'#ff8800':'#00ffcc';}
    if(phishTimeLeft<=0){clearInterval(phishTimer);if(!phishAnswered)answerPhish(null);}
  },100);
}

function answerPhish(userSaysPhish){
  if(phishAnswered)return;phishAnswered=true;
  if(phishTimer)clearInterval(phishTimer);phishTimer=null;
  const email=phishPool[phishIndex];const correct=userSaysPhish!==null&&(userSaysPhish===email.isPhish);
  if(correct)phishScore++;
  const scoreEl=document.getElementById('phish-score');if(scoreEl)scoreEl.innerText=phishScore+' / '+phishTotal;
  const tf=document.getElementById('phish-timer-fill');if(tf){tf.style.transition='background-color 0.3s';tf.style.backgroundColor=correct?'#00ff88':'#ff4444';}
  const btns=document.getElementById('phish-buttons');if(btns){btns.style.pointerEvents='none';btns.style.opacity='0.4';}
  const emailClient=document.querySelector('.email-client');if(emailClient){emailClient.style.transition='opacity 0.2s ease,transform 0.2s ease';emailClient.style.opacity='0';emailClient.style.transform='translateY(-8px)';}
  const bodyEl=document.getElementById('phish-body');
  const verdict=userSaysPhish===null?'⏱️ TIMED OUT!':correct?'✅ CORRECT!':'❌ WRONG!';
  const color=correct?'#00aa55':'#cc0000';const answer=email.isPhish?'🚩 PHISHING':'✅ LEGITIMATE';
  setTimeout(()=>{
    if(emailClient){emailClient.style.opacity='1';emailClient.style.transform='translateY(0)';}
    if(bodyEl)bodyEl.innerHTML='<strong style="color:'+color+';font-size:1.4em;display:block;margin-bottom:8px">'+verdict+'</strong><span style="color:#ccc;font-size:0.95em">💡 '+email.tip+'</span><br><br><em style="color:#888;font-size:0.9em">This email was: '+answer+'</em>';
  },220);
  setTimeout(()=>{
    if(emailClient){emailClient.style.transition='opacity 0.25s ease,transform 0.25s ease';emailClient.style.opacity='0';emailClient.style.transform='translateY(8px)';}
    setTimeout(()=>{phishIndex++;if(phishIndex>=phishPool.length)endPhishGame();else loadPhishEmail();},260);
  },2500);
}

function endPhishGame(){
  if(phishTimer)clearInterval(phishTimer);
  const btns=document.getElementById('phish-buttons');if(btns)btns.style.display='none';
  const rs=document.getElementById('phish-result-screen');if(rs)rs.style.display='block';
  const fm=document.getElementById('phish-final-msg');
  const pct=phishScore/phishTotal;let reward=0,msg='',mikitaVariant='instructor',mikitaLine='';
  if(pct>=0.85){reward=8000;msg='🏆 ELITE ANALYST!\n'+phishScore+'/'+phishTotal+' Correct!\n+'+reward.toLocaleString()+' COINS!';mikitaVariant='instructor';mikitaLine='"Outstanding work. You just saved the company."';}
  else if(pct>=0.67){reward=3000;msg='✅ SOLID WORK!\n'+phishScore+'/'+phishTotal+' Correct!\n+'+reward.toLocaleString()+' Coins';mikitaVariant='idle';mikitaLine='"Not bad. Keep your guard up out there."';}
  else if(pct>=0.50){reward=800;msg='⚠️ NEEDS TRAINING\n'+phishScore+'/'+phishTotal+' Correct\n+'+reward+' Coins';mikitaVariant='terminal';mikitaLine='"We need to review the basics. Come back soon."';}
  else{reward=0;msg='❌ PHISHED!\n'+phishScore+'/'+phishTotal+' Correct\nBetter luck next time...';mikitaVariant='terminal';mikitaLine='"...I\'m putting you on mandatory retraining."';}
  if(fm)fm.innerText=msg;setMikitaImg(mikitaVariant);
  let reactionEl=document.getElementById('phish-mikita-reaction');
  if(!reactionEl){reactionEl=document.createElement('p');reactionEl.id='phish-mikita-reaction';reactionEl.style.cssText='color:#00ffff;font-size:1.1rem;margin:8px 0 12px;font-style:italic;text-align:center;';if(fm)fm.parentNode.insertBefore(reactionEl,fm.nextSibling);}
  reactionEl.innerText=mikitaLine;myCoins+=reward;updateUI();save();
}

/* ══════════════════════════════════════════════════════════════════════════
   ⚡ CORPORATE DASH — GEOMETRY DASH STYLE AUTO-RUNNER
   Controls: Click / Space / Tap = Jump (double jump available)
   One hit = death, restart from beginning
   Survive 60 seconds = WIN
   1000 coins per second survived
   Difficulty ramps brutally — good luck getting past 30s
═══════════════════════════════════════════════════════════════════════════ */

let gdGame = null;

function openFirewallGame() {
  const overlay = document.getElementById('firewall-game-overlay');
  if (!overlay) return;

  // Nuke and rebuild overlay contents fresh
  overlay.innerHTML = '';
  overlay.style.cssText = [
    'display:flex', 'position:fixed', 'inset:0', 'background:#000',
    'z-index:200010', 'flex-direction:column', 'align-items:center',
    'justify-content:center', 'font-family:VT323,monospace', 'user-select:none'
  ].join(';');

  // Stats bar
  const statsBar = document.createElement('div');
  statsBar.style.cssText = 'display:flex;gap:50px;margin-bottom:14px;font-size:1.3rem;letter-spacing:2px;color:#00ffcc;';
  statsBar.innerHTML = `
    <span>⏱ <strong id="gd-time" style="color:#fff;font-size:1.5rem">0</strong>s <span style="color:#555">/ 60</span></span>
    <span style="color:#ff00ff;font-size:1.5rem;text-shadow:0 0 12px #ff00ff;">⚡ CORPORATE DASH</span>
    <span>💰 <strong id="gd-coins" style="color:#f1c40f;font-size:1.5rem">0</strong></span>
  `;
  overlay.appendChild(statsBar);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'gd-canvas';
  canvas.width = 800;
  canvas.height = 300;
  canvas.style.cssText = 'border:3px solid #00ffcc;box-shadow:0 0 40px rgba(0,255,204,0.5),0 0 80px rgba(0,255,204,0.15);max-width:96vw;display:block;cursor:pointer;';
  overlay.appendChild(canvas);

  // Hint
  const hint = document.createElement('div');
  hint.style.cssText = 'margin-top:12px;color:#666;font-size:1.05rem;letter-spacing:1px;';
  hint.innerText = 'CLICK · SPACE · TAP = JUMP     DOUBLE JUMP AVAILABLE     ONE HIT = DEATH';
  overlay.appendChild(hint);

  // Quit button
  const quitBtn = document.createElement('button');
  quitBtn.innerText = '✕ QUIT';
  quitBtn.style.cssText = 'margin-top:14px;padding:6px 28px;background:transparent;border:2px solid #444;color:#666;font-family:VT323,monospace;font-size:1.1rem;cursor:pointer;letter-spacing:1px;transition:border-color 0.2s,color 0.2s;';
  quitBtn.onmouseenter = () => { quitBtn.style.borderColor='#ff4444'; quitBtn.style.color='#ff4444'; };
  quitBtn.onmouseleave = () => { quitBtn.style.borderColor='#444'; quitBtn.style.color='#666'; };
  quitBtn.onclick = () => { if(gdGame){gdGame.destroy();gdGame=null;} overlay.style.display='none'; };
  overlay.appendChild(quitBtn);

  if (gdGame) { gdGame.destroy(); gdGame = null; }
  gdGame = new GDGame(canvas);
  gdGame.start();
}

/* ── GDGame: self-contained canvas game ─────────────────────────────── */
class GDGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.raf = null;
    this.running = false;
    this._keyFn = (e) => { if (e.code === 'Space') { e.preventDefault(); this.jump(); } };
    this._clickFn = () => this.jump();
    this._touchFn = (e) => { e.preventDefault(); this.jump(); };
    window.addEventListener('keydown', this._keyFn);
    canvas.addEventListener('click', this._clickFn);
    canvas.addEventListener('touchstart', this._touchFn, { passive: false });
    this._initState();
  }

  destroy() {
    this.running = false;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
    window.removeEventListener('keydown', this._keyFn);
    try { this.canvas.removeEventListener('click', this._clickFn); } catch(e) {}
    try { this.canvas.removeEventListener('touchstart', this._touchFn); } catch(e) {}
  }

  _initState() {
    this.t = 0;               // seconds elapsed
    this.worldX = 0;          // total world scroll distance
    this.dead = false;
    this.won = false;
    this.resultShown = false;
    this.lastFrameTime = null;

    // Ground y (top of ground surface)
    this.GY = this.H - 55;

    // Player
    this.p = { x: 110, y: this.GY - 36, w: 34, h: 34, vy: 0, grounded: true, jumps: 2, rot: 0 };

    // Obstacles: array of { kind, x, ... }
    this.obs = [];
    this.nextObsX = this.W + 250;

    // Death particles
    this.parts = [];

    // Stars (static)
    this.stars = Array.from({length:55},()=>({
      sx: Math.random() * this.W,
      sy: Math.random() * (this.GY * 0.75),
      r: Math.random() * 1.6 + 0.3,
      phase: Math.random() * Math.PI * 2
    }));

    // Seed initial (forgiving) obstacles
    this._seedStart();
  }

  _seedStart() {
    // First 3 obstacles are simple single spikes, spread out
    const xs = [620, 950, 1280];
    for (const x of xs) {
      this.obs.push({ kind: 'spike', x, w: 30, h: 38, y: this.GY - 38 });
    }
    this.nextObsX = 1280;
  }

  start() {
    this.running = true;
    this.lastFrameTime = performance.now();
    this._tick(performance.now());
  }

  jump() {
    if (!this.running || this.dead || this.won) return;
    if (this.p.jumps > 0) {
      this.p.vy = this._jumpV();
      this.p.grounded = false;
      this.p.jumps--;
    }
  }

  // Jump velocity scales slightly with speed so you can always clear obstacles
  _jumpV() {
    return -(500 + this._speed() * 0.12);
  }

  _speed() {
    // Brutal ramp: starts at 260, hits ~620 by second 50
    const t = this.t;
    if (t < 8)  return 260;
    if (t < 20) return 260 + (t - 8) * 16;
    if (t < 35) return 452 + (t - 20) * 8;
    if (t < 50) return 572 + (t - 35) * 5;
    return 647 + (t - 50) * 3;
  }

  _gravity() {
    // Gravity also increases so the game feels heavier at speed
    return 1350 + this.t * 4;
  }

  _minGap() {
    const t = this.t;
    if (t < 10) return 400;
    if (t < 20) return 320;
    if (t < 35) return 240;
    if (t < 50) return 185;
    return 155;
  }

  // Obstacle factory — harder types unlock over time
  _makeObs(x) {
    const t = this.t;
    const G = this.GY;
    const r = Math.random();

    // Early: only spikes (single and double)
    if (t < 12) {
      if (r < 0.7) return { kind: 'spike', x, w: 30, h: 38, y: G - 38 };
      return { kind: 'spike2', x, spikes: [
        { w: 30, h: 38, y: G - 38, dx: 0 },
        { w: 30, h: 44, y: G - 44, dx: 36 }
      ]};
    }

    // Mid: add tall walls and ceiling bars
    if (t < 28) {
      if (r < 0.35) return { kind: 'spike', x, w: 30, h: 38, y: G - 38 };
      if (r < 0.60) return { kind: 'spike2', x, spikes: [
        { w: 30, h: 38, y: G - 38, dx: 0 },
        { w: 30, h: 44, y: G - 44, dx: 36 }
      ]};
      if (r < 0.80) {
        const h = 75 + Math.random() * 35;
        return { kind: 'wall', x, w: 22, h, y: G - h };
      }
      // Ceiling bar
      return { kind: 'ceil', x, w: 200, h: 18, y: 55 };
    }

    // Late: everything + triple spike + spike on wall
    if (t < 45) {
      if (r < 0.20) return { kind: 'spike', x, w: 30, h: 38, y: G - 38 };
      if (r < 0.38) return { kind: 'spike2', x, spikes: [
        { w: 30, h: 38, y: G - 38, dx: 0 },
        { w: 30, h: 44, y: G - 44, dx: 36 }
      ]};
      if (r < 0.52) return { kind: 'spike3', x, spikes: [
        { w: 28, h: 36, y: G - 36, dx: 0 },
        { w: 28, h: 44, y: G - 44, dx: 32 },
        { w: 28, h: 36, y: G - 36, dx: 64 }
      ]};
      if (r < 0.72) {
        const h = 80 + Math.random() * 40;
        return { kind: 'wall', x, w: 22, h, y: G - h };
      }
      return { kind: 'ceil', x, w: 180 + Math.random() * 80, h: 20, y: 48 + Math.random() * 20 };
    }

    // BRUTAL final stretch: narrow gaps, ceilings + floor spikes simultaneously
    if (r < 0.18) return { kind: 'spike', x, w: 30, h: 38, y: G - 38 };
    if (r < 0.34) return { kind: 'spike3', x, spikes: [
      { w: 28, h: 36, y: G - 36, dx: 0 },
      { w: 28, h: 44, y: G - 44, dx: 32 },
      { w: 28, h: 36, y: G - 36, dx: 64 }
    ]};
    if (r < 0.55) {
      const h = 85 + Math.random() * 45;
      return { kind: 'wall', x, w: 24, h, y: G - h };
    }
    if (r < 0.75) return { kind: 'ceil', x, w: 160 + Math.random() * 100, h: 22, y: 45 + Math.random() * 15 };
    // Combined: ceiling + spike below it
    return { kind: 'combo', x,
      ceil: { w: 170, h: 20, y: 50 },
      spike: { w: 30, h: 38, y: G - 38, dx: 70 }
    };
  }

  _tick(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;
    if (!this.dead && !this.won) this._update(dt);
    this._draw();
    this.raf = requestAnimationFrame(t => this._tick(t));
  }

  _update(dt) {
    const spd = this._speed();
    const grav = this._gravity();
    this.t += dt;
    this.worldX += spd * dt;

    // Update HUD
    const gdTime = document.getElementById('gd-time');
    const gdCoins = document.getElementById('gd-coins');
    if (gdTime) gdTime.innerText = Math.floor(this.t);
    if (gdCoins) gdCoins.innerText = (Math.floor(this.t) * 1000).toLocaleString();

    // Win check
    if (this.t >= 60) { this._win(); return; }

    const p = this.p;

    // Physics
    p.vy += grav * dt;
    p.y += p.vy * dt;

    // Ground
    if (p.y >= this.GY - p.h) {
      p.y = this.GY - p.h;
      p.vy = 0;
      p.grounded = true;
      p.jumps = 2;
    } else {
      p.grounded = false;
    }

    // Ceiling clamp
    if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy) * 0.3; }

    // Rotation
    p.rot = p.grounded ? 0 : p.rot + 360 * dt;

    // Spawn obstacles
    while (this.nextObsX < this.worldX + this.W + 500) {
      const gap = this._minGap() + Math.random() * 160;
      this.nextObsX += gap;
      this.obs.push(this._makeObs(this.nextObsX));
    }

    // Cull far-left obstacles
    this.obs = this.obs.filter(o => o.x - this.worldX > -300);

    // Collision
    for (const o of this.obs) {
      if (this._hits(p, o)) { this._die(); return; }
    }

    // Particles
    this.parts = this.parts.filter(pt => pt.life > 0);
    for (const pt of this.parts) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vy += 500 * dt; pt.life -= dt;
    }
  }

  _screenX(worldObsX) {
    return worldObsX - this.worldX;
  }

  _hits(p, o) {
    const M = 5; // hitbox margin
    const px1 = p.x + M, px2 = p.x + p.w - M;
    const py1 = p.y + M, py2 = p.y + p.h - M;
    const over = (ax1,ay1,ax2,ay2,bx1,by1,bx2,by2) => ax1<bx2&&ax2>bx1&&ay1<by2&&ay2>by1;
    const sx = this._screenX(o.x);

    if (o.kind === 'spike' || o.kind === 'wall') {
      return over(px1,py1,px2,py2, sx,o.y, sx+o.w,o.y+o.h);
    }
    if (o.kind === 'ceil') {
      return over(px1,py1,px2,py2, sx,o.y, sx+o.w,o.y+o.h);
    }
    if (o.kind === 'spike2' || o.kind === 'spike3') {
      for (const sp of o.spikes) {
        if (over(px1,py1,px2,py2, sx+(sp.dx||0),sp.y, sx+(sp.dx||0)+sp.w,sp.y+sp.h)) return true;
      }
    }
    if (o.kind === 'combo') {
      const c = o.ceil, sp = o.spike;
      if (over(px1,py1,px2,py2, sx,c.y, sx+c.w,c.y+c.h)) return true;
      if (over(px1,py1,px2,py2, sx+(sp.dx||0),sp.y, sx+(sp.dx||0)+sp.w,sp.y+sp.h)) return true;
    }
    return false;
  }

  _die() {
    this.dead = true;
    const coinsEarned = Math.floor(this.t) * 1000;
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      this.parts.push({ x: this.p.x+this.p.w/2, y: this.p.y+this.p.h/2, vx: Math.cos(a)*(80+Math.random()*220), vy: Math.sin(a)*(80+Math.random()*220)-80, life: 0.9+Math.random()*0.4, color: ['#ff00ff','#00ffff','#ff3366','#f1c40f','#ffffff'][i%5] });
    }
    myCoins += coinsEarned; updateUI(); save();
    setTimeout(() => this._showDeath(coinsEarned), 600);
  }

  _win() {
    this.won = true;
    myCoins += 60000; updateUI(); save();
    setTimeout(() => this._showWin(), 300);
  }

  _showDeath(coins) {
    if (this.resultShown) return;
    this.resultShown = true;
    const overlay = document.getElementById('firewall-game-overlay');
    if (!overlay) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.87);z-index:20;text-align:center;font-family:VT323,monospace;';
    div.innerHTML = `
      <div style="font-size:3.8rem;color:#ff3366;text-shadow:0 0 25px #ff3366;margin-bottom:10px;">💀 YOU DIED 💀</div>
      <div style="font-size:1.7rem;color:#fff;margin-bottom:6px;">Survived <strong style="color:#f1c40f">${Math.floor(this.t)}s</strong> / 60s</div>
      <div style="font-size:1.3rem;color:#aaa;margin-bottom:28px;">+${coins.toLocaleString()} vapor coins earned</div>
      <div style="display:flex;gap:22px;">
        <button id="gd-retry" style="padding:10px 38px;background:linear-gradient(90deg,#ff00ff,#00ffff);border:3px solid #fff;color:#fff;font-family:VT323,monospace;font-size:1.7rem;cursor:pointer;letter-spacing:1px;">▶ TRY AGAIN</button>
        <button id="gd-quit" style="padding:10px 38px;background:transparent;border:2px solid #ff4444;color:#ff4444;font-family:VT323,monospace;font-size:1.7rem;cursor:pointer;letter-spacing:1px;">✕ QUIT</button>
      </div>
    `;
    overlay.appendChild(div);
    document.getElementById('gd-retry').onclick = () => {
      div.remove();
      this._initState();
      this.lastFrameTime = performance.now();
    };
    document.getElementById('gd-quit').onclick = () => {
      this.destroy(); gdGame = null;
      overlay.style.display = 'none';
    };
  }

  _showWin() {
    if (this.resultShown) return;
    this.resultShown = true;
    const overlay = document.getElementById('firewall-game-overlay');
    if (!overlay) return;
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.9);z-index:20;text-align:center;font-family:VT323,monospace;';
    div.innerHTML = `
      <div style="font-size:3.5rem;color:#00ff88;text-shadow:0 0 30px #00ff88;margin-bottom:10px;">🏆 FIREWALL CLEARED! 🏆</div>
      <div style="font-size:1.8rem;color:#fff;margin-bottom:8px;">Survived all 60 seconds!</div>
      <div style="font-size:2.2rem;color:#f1c40f;text-shadow:0 0 15px #f1c40f;margin-bottom:28px;">+60,000 VAPOR COINS</div>
      <button id="gd-done" style="padding:12px 52px;background:linear-gradient(90deg,#00ffcc,#00ff88);border:3px solid #fff;color:#000;font-family:VT323,monospace;font-size:1.9rem;cursor:pointer;letter-spacing:1px;">BACK TO WORK</button>
    `;
    overlay.appendChild(div);
    document.getElementById('gd-done').onclick = () => {
      this.destroy(); gdGame = null;
      overlay.style.display = 'none';
    };
  }

  /* ── RENDER ──────────────────────────────────────────────────────────── */
  _draw() {
    const ctx = this.ctx, W = this.W, H = this.H, GY = this.GY;

    // Sky
    const skyGrad = ctx.createLinearGradient(0,0,0,GY);
    skyGrad.addColorStop(0,'#03000f');
    skyGrad.addColorStop(1,'#0a0025');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,W,H);

    // Scrolling perspective grid
    const gridOff = this.worldX % 100;
    ctx.strokeStyle = 'rgba(0,255,204,0.06)';
    ctx.lineWidth = 1;
    for (let x = -gridOff; x < W; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x + 30, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, GY); ctx.lineTo(x - 10, H); ctx.stroke();
    }

    // Stars
    const now = performance.now() * 0.001;
    for (const s of this.stars) {
      ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(now + s.phase));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.sx, s.sy, s.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ground
    ctx.shadowBlur = 15; ctx.shadowColor = '#00ffcc';
    ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0,GY); ctx.lineTo(W,GY); ctx.stroke();
    ctx.shadowBlur = 0;

    const groundGrad = ctx.createLinearGradient(0,GY,0,H);
    groundGrad.addColorStop(0,'rgba(0,255,204,0.25)');
    groundGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0,GY,W,H-GY);

    // Obstacles
    for (const o of this.obs) {
      const sx = this._screenX(o.x);
      if (sx > W+200 || sx < -400) continue;
      this._drawObs(ctx, o, sx);
    }

    // Player (skip drawing body if dead, show particles instead)
    if (!this.dead) {
      const p = this.p;
      ctx.save();
      ctx.translate(p.x + p.w/2, p.y + p.h/2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.shadowBlur = 18; ctx.shadowColor = '#ff00ff';

      // Outer square
      ctx.fillStyle = '#dd00cc';
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);

      // Inner
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(-p.w/2+5, -p.h/2+5, p.w-10, p.h-10);

      // Eye
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(3, -5, 7, 7);

      ctx.shadowBlur = 0;
      ctx.restore();

      // Double jump indicator dot above player
      if (!p.grounded && p.jumps === 1) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath(); ctx.arc(p.x+p.w/2, p.y-10, 5, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Particles
    for (const pt of this.parts) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.shadowBlur = 8; ctx.shadowColor = pt.color;
      ctx.fillRect(pt.x-4, pt.y-4, 8, 8);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // Progress bar (top of canvas)
    const prog = Math.min(this.t / 60, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 7);
    const barGrad = ctx.createLinearGradient(0,0,W,0);
    barGrad.addColorStop(0,'#ff00ff');
    barGrad.addColorStop(0.4,'#00ffcc');
    barGrad.addColorStop(1,'#00ff88');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W*prog, 7);

    // Danger red tint in last 15 seconds
    if (this.t > 45 && !this.dead && !this.won) {
      const intensity = Math.abs(Math.sin(now * 3)) * 0.07;
      ctx.fillStyle = `rgba(255,0,0,${intensity})`;
      ctx.fillRect(0,0,W,H);
    }

    // Speed readout
    if (!this.dead && !this.won) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '16px VT323, monospace';
      ctx.fillText('SPD ' + Math.round(this._speed()), W - 90, H - 8);
    }
  }

  _drawObs(ctx, o, sx) {
    const drawSpike = (x, y, w, h, color) => {
      ctx.shadowBlur = 12; ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y+h);
      ctx.lineTo(x+w/2, y);
      ctx.lineTo(x+w, y+h);
      ctx.closePath();
      ctx.fill();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(x+4, y+h-2);
      ctx.lineTo(x+w/2-1, y+4);
      ctx.lineTo(x+w/2+2, y+4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    if (o.kind === 'spike') {
      drawSpike(sx, o.y, o.w, o.h, '#ff3366');
    }
    else if (o.kind === 'spike2' || o.kind === 'spike3') {
      for (const sp of o.spikes) drawSpike(sx+(sp.dx||0), sp.y, sp.w, sp.h, '#ff3366');
    }
    else if (o.kind === 'wall') {
      ctx.shadowBlur = 14; ctx.shadowColor = '#ff00ff';
      const g = ctx.createLinearGradient(sx,0,sx+o.w,0);
      g.addColorStop(0,'#cc00aa'); g.addColorStop(1,'#880066');
      ctx.fillStyle = g;
      ctx.fillRect(sx, o.y, o.w, o.h);
      // Warning stripes
      ctx.fillStyle = 'rgba(255,255,0,0.12)';
      for (let wy = o.y; wy < o.y+o.h; wy += 18) ctx.fillRect(sx, wy, o.w, 9);
      ctx.strokeStyle = '#ff66ff'; ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, o.y, o.w, o.h);
      ctx.shadowBlur = 0;
    }
    else if (o.kind === 'ceil') {
      ctx.shadowBlur = 14; ctx.shadowColor = '#00ffcc';
      const g = ctx.createLinearGradient(0,o.y,0,o.y+o.h);
      g.addColorStop(0,'#004433'); g.addColorStop(1,'#00ffcc');
      ctx.fillStyle = g;
      ctx.fillRect(sx, o.y, o.w, o.h);
      ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, o.y, o.w, o.h);
      // Hanging spikes
      ctx.fillStyle = '#00ffcc';
      for (let tx = sx+10; tx < sx+o.w-10; tx += 26) {
        ctx.beginPath();
        ctx.moveTo(tx, o.y+o.h);
        ctx.lineTo(tx+8, o.y+o.h+16);
        ctx.lineTo(tx+16, o.y+o.h);
        ctx.closePath(); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
    else if (o.kind === 'combo') {
      // Draw ceiling part
      const c = o.ceil, sp = o.spike;
      ctx.shadowBlur = 12; ctx.shadowColor = '#00ffcc';
      ctx.fillStyle = '#00aa88';
      ctx.fillRect(sx, c.y, c.w, c.h);
      ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 1;
      ctx.strokeRect(sx, c.y, c.w, c.h);
      ctx.shadowBlur = 0;
      // Floor spike offset
      drawSpike(sx+(sp.dx||0), sp.y, sp.w, sp.h, '#ff3366');
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BIND ALL INTERACTIONS
═══════════════════════════════════════════════════════════════════════════ */
function bindInteractions() {
  console.log('=== bindInteractions called ===');

  const btnClockIn = document.getElementById('btn-clock-in');
  if (btnClockIn) {
    btnClockIn.addEventListener('click', () => {
      const input = document.getElementById('username-input');
      const name = input ? input.value.trim() : '';
      if (!name) { alert('Enter your Employee ID first!'); return; }
      myUser = name; save();
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('game-container').style.display = 'block';
      bgm.play().catch(() => {});
      updateUI();
    });
  }

  const btnAttack = document.getElementById('btn-attack');
  if (btnAttack) btnAttack.addEventListener('click', attack);
  const bossArea = document.getElementById('boss-area');
  if (bossArea) bossArea.addEventListener('click', attack);

  const buyClick = document.getElementById('buy-click');
  if (buyClick) buyClick.addEventListener('click', () => { if (myCoins >= clickCost) { myCoins -= clickCost; myClickDmg += 2500; clickCost = Math.ceil(clickCost * 1.6); updateUI(); save(); } });
  const buyAuto = document.getElementById('buy-auto');
  if (buyAuto) buyAuto.addEventListener('click', () => { if (myCoins >= autoCost) { myCoins -= autoCost; myAutoDmg += 1000; autoCost = Math.ceil(autoCost * 1.6); if (myAutoDmg === 1000) startAutoTimer(); updateUI(); save(); } });
  const buyCrit = document.getElementById('buy-crit');
  if (buyCrit) buyCrit.addEventListener('click', () => { if (myCoins >= critCost) { myCoins -= critCost; critChance += 5; critCost = Math.ceil(critCost * 1.8); updateUI(); save(); } });
  const buyOvertime = document.getElementById('buy-overtime');
  if (buyOvertime) buyOvertime.addEventListener('click', () => { if (!overtimeUnlocked && myCoins >= 200) { myCoins -= 200; overtimeUnlocked = true; if (myAutoDmg > 0) startAutoTimer(); updateUI(); save(); } });
  const buySynergy = document.getElementById('buy-synergy');
  if (buySynergy) buySynergy.addEventListener('click', () => { if (myCoins >= synergyCost) { myCoins -= synergyCost; synergyLevel++; synergyCost = Math.ceil(synergyCost * 1.8); updateUI(); save(); } });
  const buyRage = document.getElementById('buy-rage');
  if (buyRage) buyRage.addEventListener('click', () => { if (!rageFuelUnlocked && myCoins >= rageCost) { myCoins -= rageCost; rageFuelUnlocked = true; updateUI(); save(); } });
  const buyHustle = document.getElementById('buy-hustle');
  if (buyHustle) buyHustle.addEventListener('click', () => { if (myCoins >= hustleCost) { myCoins -= hustleCost; hustleCoinsPerClick += 2; hustleCost = Math.ceil(hustleCost * 1.5); updateUI(); save(); } });

  const skillPhishing = document.getElementById('skill-phishing');
  if (skillPhishing) skillPhishing.addEventListener('click', () => { const o = document.getElementById('mikita-overlay'); if (o) o.style.display = 'flex'; });
  const skillFirewall = document.getElementById('skill-firewall');
  if (skillFirewall) skillFirewall.addEventListener('click', openFirewallGame);

  const mikitaClose = document.getElementById('mikita-close');
  if (mikitaClose) mikitaClose.addEventListener('click', () => { document.getElementById('mikita-overlay').style.display = 'none'; });
  const mikitaStart = document.getElementById('mikita-start-game-btn');
  if (mikitaStart) mikitaStart.addEventListener('click', () => { document.getElementById('mikita-overlay').style.display = 'none'; openPhishingGame(); });

  const btnLegit = document.getElementById('btn-legit');
  if (btnLegit) btnLegit.addEventListener('click', () => answerPhish(false));
  const btnPhish = document.getElementById('btn-phish');
  if (btnPhish) btnPhish.addEventListener('click', () => answerPhish(true));
  const phishClose = document.getElementById('phish-close-btn');
  if (phishClose) phishClose.addEventListener('click', () => { document.getElementById('phishing-game-overlay').style.display = 'none'; });

  console.log('=== bindInteractions complete ===');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindInteractions);
} else {
  bindInteractions();
}

console.log('✅ Corporate Dash loaded!');
