const BASE_HEALTH = 1000000000;
let currentMaxHealth = BASE_HEALTH;
let previousHealth = BASE_HEALTH;

let currentPhase = 1;
let baseDaveImg = "assets/phases/dave/dave_phase1.png";
let lastLevel = 0;
const davePhaseImgs = [
  'assets/phases/dave/dave_phase1.png',
  'assets/phases/dave/dave_phase2.png',
  'assets/phases/dave/dave_phase3.png',
  'assets/phases/dave/dave_phase4.png'
]; 

const bossImageEl = document.getElementById('boss-image');
const healthFill = document.getElementById('health-bar-fill');
const healthText = document.getElementById('health-text');
const bossNameEl = document.getElementById('boss-name');

const firebaseConfig = {
  apiKey: "AIzaSyBvx5u1OGwS6YAvmVhBF9bstiUn-Vp6TVY",
  authDomain: "corporate-extraction.firebaseapp.com",
  databaseURL: "https://corporate-extraction-default-rtdb.firebaseio.com",
  projectId: "corporate-extraction",
  storageBucket: "corporate-extraction.firebasestorage.app",
  messagingSenderId: "184892788723",
  appId: "1:184892788723:web:93959fe24c883a27088c86"
};

if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}
const db = firebase.database();
const bossRef = db.ref('frank_corporate_data');
const activeEmployeesRef = db.ref('active_employees');

let flashTimeout;

// 1. UPDATE BOSS HEALTH, PHASES & VICTORY
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
  let newPhase = 1;
  let newTitle = "FRANK LV." + currentLevel;

  // Fixed folder paths for phases!
  if (hpPercent <= 0.25) {
      newPhase = 4;
      newTitle = "VP DAVE (CORPORATE DEVIL)";
      baseDaveImg = davePhaseImgs[3];
  } else if (hpPercent <= 0.50) {
      newPhase = 3;
      newTitle = "VP DAVE (FURIOUS)";
      baseDaveImg = davePhaseImgs[2];
  } else if (hpPercent <= 0.75) {
      newPhase = 2;
      newTitle = "VP DAVE (GETTING SERIOUS)";
      baseDaveImg = davePhaseImgs[1];
  } else {
      newPhase = 1;
      newTitle = "VP DAVE LV." + currentLevel;
      baseDaveImg = davePhaseImgs[0];
  }

  if (currentPhase !== newPhase) {
      currentPhase = newPhase;
      if (bossImageEl) bossImageEl.src = baseDaveImg;
  }

  const percentage = Math.max(0, (currentHealth / currentMaxHealth) * 100);
  healthFill.style.width = percentage + '%';
  healthText.innerText = `${Math.floor(currentHealth).toLocaleString()} / ${currentMaxHealth.toLocaleString()}`;
  bossNameEl.innerText = newTitle;

  if (currentHealth < previousHealth && currentHealth > 0) {
    triggerHitAnimation();
  }
  previousHealth = currentHealth;
});

function triggerVictoryScreen(newLevel) {
    const vScreen = document.createElement('div');
    vScreen.style.position = 'fixed';
    vScreen.style.top = '0'; vScreen.style.left = '0';
    vScreen.style.width = '100vw'; vScreen.style.height = '100vh';
    vScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    vScreen.style.display = 'flex'; vScreen.style.flexDirection = 'column';
    vScreen.style.justifyContent = 'center'; vScreen.style.alignItems = 'center';
    vScreen.style.zIndex = '9999'; vScreen.style.fontFamily = 'monospace';
    vScreen.style.textAlign = 'center'; vScreen.style.textShadow = '3px 3px 0px #00ffff';

    vScreen.innerHTML = `
        <h1 style="font-size: 5rem; color: #ff00ff; margin: 0; text-transform: uppercase;">PROMOTED!</h1>
        <h2 style="font-size: 2rem; color: #fff; text-shadow: none;">DAVE & RICH RETREATED... FOR NOW.</h2>
        <p style="font-size: 1.5rem; color: #00ffff; text-shadow: none; margin-top: 20px;">PREPARE FOR LEVEL ${newLevel}</p>
    `;
    document.body.appendChild(vScreen);

    if(bossImageEl) bossImageEl.style.opacity = '0';

    setTimeout(() => {
        vScreen.style.transition = 'opacity 1s';
        vScreen.style.opacity = '0';
        if(bossImageEl) bossImageEl.style.opacity = '1'; 
        setTimeout(() => vScreen.remove(), 1000);
    }, 4000);
}

// 2. LISTEN FOR VIEWER CLICKS
activeEmployeesRef.on('child_changed', (snapshot) => { 
  const data = snapshot.val();
  if (data) spawnEmojiPopUp(data.emoji, data.name, data.damage);
});

activeEmployeesRef.on('child_added', (snapshot) => { 
  const data = snapshot.val();
  if (data && (Date.now() - data.timestamp < 30000)) {
    spawnEmojiPopUp(data.emoji, data.name, data.damage);
  }
});

// 3. ANIMATIONS
function triggerHitAnimation() {
  if (!bossImageEl) return;
  clearTimeout(flashTimeout);
  
  bossImageEl.classList.add('boss-shake'); 
  bossImageEl.style.filter = 'brightness(1.5) sepia(1) hue-rotate(-50deg) saturate(5)'; 
  
  flashTimeout = setTimeout(() => {
      bossImageEl.classList.remove('boss-shake');
      bossImageEl.style.filter = 'none'; 
  }, 150);
}

function spawnEmojiPopUp(emoji, name, damage) {
  // ---> PASTE YOUR ORIGINAL EMOJI LOGIC HERE <---
  const el = document.createElement('div');
}
