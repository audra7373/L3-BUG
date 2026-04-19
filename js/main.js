import * as THREE from 'three';
import { AudioEngine } from './audioEngine.js';
import { GameState, sectorPalettes } from './Game.js';
import { updateHex, buildSlices } from './ui.js';
import { BOOT_LINES, scramble } from './boot.js';

// --- INITIALISATION DES INSTANCES ---
const audioEngine = new AudioEngine();
const state = new GameState();

let scene, camera, renderer, player, player2, tunnel, ambientLight;
let lastGlitchLevel = -1;

// Variables pour le Touch Drag fluide
let isDragging = false;
let touchStartX = 0;
let initialLane = 0;

// ============================================================
// INITIALISATION DE LA SCÈNE
// ============================================================
function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000500, 0.02);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0x00ff00, 1.5);
    scene.add(ambientLight);

    const tunnelGeo = new THREE.CylinderGeometry(10, 10, 5000, 8, 1, true);
    const tunnelMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, side: THREE.BackSide });
    tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnel.rotation.x = Math.PI / 2;
    scene.add(tunnel);

    player = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
    scene.add(player);

    player2 = player.clone();
    player2.material = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
    player2.visible = false;
    scene.add(player2);

    // --- CONTRÔLES CLAVIER ---
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && state.targetLane > 0) state.targetLane--;
        if (e.key === 'ArrowRight' && state.targetLane < 2) state.targetLane++;
        if (e.code === 'Space') { state.isFlipped = !state.isFlipped; audioEngine.playFlip(); }
        if (e.key === 'm' || e.key === 'M') toggleMuteUI();
    });

    // --- CONTRÔLES TACTILES (MOBILE FLUIDE) ---
    const el = renderer.domElement;
    el.addEventListener('touchstart', (e) => {
        isDragging = true;
        touchStartX = e.touches[0].clientX;
        initialLane = state.targetLane;
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    el.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const currentX = e.touches[0].clientX;
        const diffX = currentX - touchStartX;
        const sensitivity = 50; 
        const laneOffset = Math.round(diffX / sensitivity);
        state.targetLane = Math.max(0, Math.min(2, initialLane + laneOffset));
        if (e.cancelable) e.preventDefault();
    }, { passive: false });

    el.addEventListener('touchend', () => { isDragging = false; });

    let lastTap = 0;
    el.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            state.isFlipped = !state.isFlipped;
            audioEngine.playFlip();
            if (e.cancelable) e.preventDefault();
        }
        lastTap = currentTime;
    });

    document.getElementById('mute-btn').addEventListener('click', toggleMuteUI);

    animate();
    spawnLoop();
    setInterval(updateHex, 150);
}

function toggleMuteUI() {
    const muted = audioEngine.toggleMute();
    const btn = document.getElementById('mute-btn');
    btn.innerText = muted ? '♪ OFF' : '♪ ON';
    btn.classList.toggle('muted', muted);
}

// ============================================================
// BOUCLE D'ANIMATION
// ============================================================
function animate() {
    if (!state.gameActive) return;
    requestAnimationFrame(animate);

    if (state.speed < state.MAX_SPEED) state.speed += 0.0008;
    player.position.z -= state.speed;

    const speedPct = Math.min(state.speed / state.MAX_SPEED, 1);
    document.getElementById('speed-bar-fill').style.width = (speedPct * 100) + '%';
    document.getElementById('speed-val').innerText = state.speed.toFixed(2) + 'x';

    tunnel.position.z = player.position.z;

    let infectionLevel = (state.bits % 50) / 50;
    audioEngine.update(infectionLevel);

    ambientLight.intensity = 1.5 * (1 - infectionLevel * 0.6);
    scene.fog.density = 0.015 + (infectionLevel * 0.04);
    
    if (infectionLevel > 0.7) {
        document.getElementById('main-panel').classList.add('glitch-active');
        camera.position.x += (Math.random() - 0.5) * 0.12;
        applyScreenGlitch(infectionLevel);
    } else {
        document.getElementById('main-panel').classList.remove('glitch-active');
        document.body.classList.remove('screen-corrupted');
        const sliceDiv = document.getElementById('glitch-slice');
        if (sliceDiv) { sliceDiv.classList.remove('active'); sliceDiv.innerHTML = ''; }
    }

    if (state.bits >= 50) jumpSector();

    player.position.x = THREE.MathUtils.lerp(player.position.x, state.lanes[state.targetLane], 0.2);
    player.position.y = THREE.MathUtils.lerp(player.position.y, state.isFlipped ? 4 : -4, 0.1);
    player.rotation.z += 0.05;

    if (state.isForked) {
        player2.visible = true;
        player2.position.set(state.lanes[(state.targetLane + 1) % 3], player.position.y, player.position.z);
    } else { player2.visible = false; }

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.5, 0.12);
    camera.position.z = player.position.z + 8;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, player.position.y + 2, 0.1);
    camera.lookAt(player.position.x, player.position.y, player.position.z - 10);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, state.isFlipped ? Math.PI : 0, 0.08);

    checkCollisions();
    renderer.render(scene, camera);
}

// ============================================================
// LOGIQUE DE JEU (COLLISIONS & SPAWN)
// ============================================================
function spawnLoop() {
    if (!state.gameActive) return;
    const z = player.position.z - 110;
    const lane = state.lanes[Math.floor(Math.random() * 3)];
    const r = Math.random();

    if (r > 0.93) spawnGate(z);
    else if (r > 0.82) spawnEntity(state.obstacles, new THREE.BoxGeometry(2, 2, 2), 0xff0000, z, lane);
    else if (r > 0.79) spawnEntity(state.forks, new THREE.OctahedronGeometry(0.5, 0), 0xff00ff, z, lane);
    else spawnEntity(state.collectibles, new THREE.IcosahedronGeometry(0.4), 0x00ffff, z, lane);

    setTimeout(spawnLoop, Math.max(60, 250 - (state.speed * 25)));
}

function spawnEntity(arr, geo, col, z, lane) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, wireframe: (col !== 0xff0000) }));
    m.position.set(lane, state.isFlipped ? 4 : -4, z);
    scene.add(m);
    arr.push(m);
}

function spawnGate(z) {
    const isNot = Math.random() > 0.5;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshBasicMaterial({ color: isNot ? 0xff00ff : 0x00ff00, transparent: true, opacity: 0.5, side: 2 }));
    const lIdx = Math.floor(Math.random() * 3);
    g.position.set(state.lanes[lIdx], state.isFlipped ? 4 : -4, z);
    g.userData = { type: isNot ? "NOT" : "AND", lane: lIdx };
    scene.add(g);
    state.gates.push(g);
}

function checkCollisions() {
    state.obstacles.forEach((o, i) => {
        // Joueur 1
        if (player.position.distanceTo(o.position) < 1.6) {
            if (!state.isOverclocked) endGame("KERNEL_PANIC");
            else { audioEngine.playDeflect(); scene.remove(o); state.obstacles.splice(i, 1); }
        }
        // Joueur 2 (Fork)
        if (state.isForked && player2.position.distanceTo(o.position) < 1.6) {
            terminateFork();
            audioEngine.playDeflect();
            scene.remove(o);
            state.obstacles.splice(i, 1);
        }
    });

    state.collectibles.forEach((c, i) => {
        if (player.position.distanceTo(c.position) < 1.2 || (state.isForked && player2.position.distanceTo(c.position) < 1.2)) {
            state.bits++;
            audioEngine.playCollect();
            updateStatsUI();
            scene.remove(c);
            state.collectibles.splice(i, 1);
        }
    });

    state.forks.forEach((f, i) => {
        if (player.position.distanceTo(f.position) < 1.2) {
            activateFork();
            audioEngine.playCollect();
            scene.remove(f);
            state.forks.splice(i, 1);
        }
    });

    state.gates.forEach((g, i) => {
        if (Math.abs(player.position.z - g.position.z) < 1.0 && state.targetLane === g.userData.lane) {
            if (g.userData.type === "NOT") { state.isFlipped = !state.isFlipped; audioEngine.playFlip(); }
            else if (g.userData.type === "AND" && state.bits < 5) endGame("AND_GATE_BLOCK");
            scene.remove(g); state.gates.splice(i, 1);
        }
    });
}

function activateFork() {
    if (state.isForked) clearTimeout(state.forkTimeout);
    state.isForked = true;
    player2.visible = true;
    state.forkTimeout = setTimeout(() => { terminateFork(); }, 7000);
}

function terminateFork() {
    state.isForked = false;
    player2.visible = false;
    if (state.forkTimeout) clearTimeout(state.forkTimeout);
}

function updateStatsUI() {
    document.getElementById('bit-count').innerText = state.bits;
    document.getElementById('bar-fill').style.width = (state.bits * 2) + '%';
    document.getElementById('bar-pct').innerText = (state.bits * 2) + '%';
}

function jumpSector() {
    state.bits = 0; state.sector++;
    audioEngine.playSectorJump();
    const p = sectorPalettes[state.sector % sectorPalettes.length];
    updateSectorUI(p);
    tunnel.material.color.setHex(p.tunnel);
    ambientLight.color.setHex(p.light);
    scene.fog.color.setHex(p.fog);
}

function updateSectorUI(p) {
    document.getElementById('sector-txt').innerText = 'SECTOR_0x0' + state.sector;
    const notif = document.getElementById('sector-notif');
    document.getElementById('notif-title').innerText = '>> SECTOR_0x0' + state.sector + ' UNLOCKED <<';
    notif.style.display = 'block';
    const cssColor = '#' + p.light.toString(16).padStart(6, '0');
    document.documentElement.style.setProperty('--neon', cssColor);
    requestAnimationFrame(() => notif.classList.add('show'));
    setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => { notif.style.display = 'none'; }, 300);
    }, 2200);
}

function applyScreenGlitch(level) {
    const sliceDiv = document.getElementById('glitch-slice');
    document.body.classList.add('screen-corrupted');
    sliceDiv.classList.add('active');
    if (Math.abs(level - lastGlitchLevel) > 0.05 || Math.random() < 0.03) {
        lastGlitchLevel = level;
        buildSlices(sliceDiv, level, sectorPalettes[state.sector % sectorPalettes.length]);
    }
}

function endGame(m) {
    state.gameActive = false;
    audioEngine.playGameOver();
    document.getElementById('notif-title').innerText = '>> ' + m;
    document.getElementById('notif-sub').innerText = 'SYSTEM REBOOT IN 2s...';
    const notif = document.getElementById('sector-notif');
    notif.style.display = 'block';
    notif.classList.add('show');
    setTimeout(() => location.reload(), 2200);
}

// ============================================================
// LOGIQUE DE BOOT
// ============================================================
let bootDone = false;

function runBoot() {
    const container = document.getElementById('boot-lines');
    const progBar   = document.getElementById('boot-progress-bar');
    const progPct   = document.getElementById('boot-pct');
    let i = 0;

    function nextLine() {
        if (i >= BOOT_LINES.length) {
            bootDone = true;
            document.getElementById('boot-prompt').classList.add('visible');
            return;
        }
        const l = BOOT_LINES[i++];
        const pct = Math.round((i / BOOT_LINES.length) * 100);
        const div = document.createElement('div');
        div.className = 'line ' + (l.cls || '');

        if (l.corrupted) {
            div.innerText = scramble(l.text);
            container.appendChild(div);
            let ticks = 0;
            const decode = setInterval(() => {
                ticks++;
                if (ticks >= 6) { div.innerText = l.text; clearInterval(decode); }
                else { div.innerText = l.text.slice(0, ticks * 5) + scramble(l.text.slice(ticks * 5)); }
            }, 60);
        } else {
            div.innerText = l.text;
            container.appendChild(div);
        }

        const delay = l.corrupted ? 500 : (100 + Math.random() * 100);
        setTimeout(() => {
            progBar.style.width = pct + '%';
            progPct.innerText = pct + '%';
        }, delay / 2);
        setTimeout(nextLine, delay);
    }
    nextLine();
}

function closeBoot() {
    if (!bootDone) return;
    audioEngine.start();
    const bs = document.getElementById('boot-screen');
    bs.classList.add('fade-out');
    setTimeout(() => { bs.style.display = 'none'; init(); }, 650);
}

// ============================================================
// GESTION DU LANCEMENT HYBRIDE (PC & MOBILE)
// ============================================================

// Variable de contrôle pour éviter les lancements multiples
let gameStarted = false;

function handleStart(e) {
    if (bootDone && !gameStarted) {
        gameStarted = true; // Verrouille le lancement
        
        // Nettoyage immédiat des écouteurs
        window.removeEventListener('keydown', handleStart);
        window.removeEventListener('touchstart', handleStart);
        
        closeBoot();
    }
}

// On écoute sur window pour capturer l'entrée utilisateur n'importe où
window.addEventListener('keydown', handleStart);
window.addEventListener('touchstart', handleStart, { passive: false });

runBoot();