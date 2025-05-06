const canvas = document.getElementById('artCanvas');
const ctx = canvas.getContext('2d');

let gameOver = false;

// Fix: define difficultyLevel globally so it's always available
let difficultyLevel = 0;

// Audio Context für alle Sounds
let audioContext = null;
let heartbeatInterval = null;
let lastHeartbeatTime = 0;
const BASE_HEARTBEAT_INTERVAL = 1000; // 1 Sekunde Basis-Intervall

// Sound-Effekte
const SOUNDS = {
    collision: {
        type: 'sawtooth',
        frequency: 200,
        duration: 0.1,
        volume: 0.2
    },
    bomb: {
        type: 'square',
        frequency: 100,
        duration: 0.3,
        volume: 0.4
    },
    levelUp: {
        type: 'sine',
        frequency: [400, 600, 800],
        duration: 0.2,
        volume: 0.3
    },
    gameOver: {
        type: 'sine',
        frequency: [300, 200, 100],
        duration: 0.3,
        volume: 0.4
    },
    interaction: {
        type: 'sine',
        frequency: 300,
        duration: 0.05,
        volume: 0.1
    }
};

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(soundType) {
    if (!audioContext) return;
    
    const sound = SOUNDS[soundType];
    if (!sound) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = sound.type;
    
    if (Array.isArray(sound.frequency)) {
        // Für Sounds mit mehreren Frequenzen (Level Up, Game Over)
        const startTime = audioContext.currentTime;
        sound.frequency.forEach((freq, index) => {
            oscillator.frequency.setValueAtTime(freq, startTime + (index * sound.duration / sound.frequency.length));
        });
    } else {
        // Für einfache Sounds
        oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime);
    }
    
    gainNode.gain.setValueAtTime(sound.volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + sound.duration);
}

function playHeartbeat() {
    if (!audioContext) return;
    
    const now = performance.now();
    if (now - lastHeartbeatTime < 100) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
    
    lastHeartbeatTime = now;
}

function updateHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    // Berechne Intervall basierend auf Level
    const interval = Math.max(200, BASE_HEARTBEAT_INTERVAL - (difficultyLevel * 50));
    heartbeatInterval = setInterval(playHeartbeat, interval);
}

// Setze Canvas-Größe auf Fenstergröße
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let currentCanvasScale = 1;
function resizeCanvasWithLevel(smooth = true) {
    // Zielgröße pro Level - Reduzierte Skalierung von 0.05 auf 0.02 pro Level
    let targetScale = Math.max(1 - difficultyLevel * 0.02, MIN_CANVAS_SCALE);
    if (smooth) {
        // Sanft interpolieren
        currentCanvasScale += (targetScale - currentCanvasScale) * 0.08; // 0.08 = Glättungsfaktor
    } else {
        currentCanvasScale = targetScale;
    }
    let w = Math.floor(window.innerWidth * currentCanvasScale);
    let h = Math.floor(window.innerHeight * currentCanvasScale);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = `calc(50% - ${w/2}px)`;
    canvas.style.top = `calc(50% - ${h/2}px)`;
}
window.addEventListener('resize', () => resizeCanvasWithLevel(false));

// Steuerelemente
const processesControl = document.getElementById('processes');
const restartButton = document.createElement('button');
restartButton.textContent = 'Restart';
restartButton.style.position = 'fixed';
restartButton.style.top = '10px';
restartButton.style.right = '10px';
restartButton.style.padding = '10px 20px';
restartButton.style.fontSize = '16px';
restartButton.style.cursor = 'pointer';
restartButton.style.background = '#4caf50';
restartButton.style.color = '#fff';
restartButton.style.border = 'none';
restartButton.style.borderRadius = '8px';
restartButton.classList.add('neon-restart-btn');
document.body.appendChild(restartButton);

// Bomb Button
const bombButton = document.createElement('button');
bombButton.textContent = '💣';
bombButton.style.position = 'fixed';
bombButton.style.top = '50%';
bombButton.style.right = '24px';
bombButton.style.width = '20px';
bombButton.style.height = '20px';
bombButton.style.padding = '0';
bombButton.style.fontSize = '16px';
bombButton.style.lineHeight = '20px';
bombButton.style.textAlign = 'center';
bombButton.style.background = '#ff4444';
bombButton.style.color = '#fff';
bombButton.style.border = 'none';
bombButton.style.borderRadius = '50%';
bombButton.style.display = 'none'; // Initially hidden
bombButton.style.transition = 'all 0.3s ease';
bombButton.style.overflow = 'hidden';
bombButton.style.zIndex = '3000';
bombButton.style.transform = 'translateY(-50%)';
document.body.appendChild(bombButton);

let bombCooldown = false;
let bombCooldownTime = 30000; // 30 seconds cooldown
let lastBombTime = 0;

restartButton.addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'flex';
    gameOver = true;
    bombButton.style.display = 'none';
    resetBombBtnPosition();
});

bombButton.addEventListener('click', () => {
    if (bombCooldown) return;
    
    // Spiel Bomb-Sound
    playSound('bomb');
    
    // Clear all elements
    randomImages = [];
    randomWordsOnCanvas = [];
    filledPolygons = [];
    globalLines = [];
    processes = [createProcess()];
    
    // Start cooldown
    bombCooldown = true;
    lastBombTime = performance.now();
    bombButton.style.opacity = '0.5';
    bombButton.style.cursor = 'not-allowed';
    
    // Reset cooldown after time
    setTimeout(() => {
        bombCooldown = false;
        bombButton.style.opacity = '1';
        bombButton.style.cursor = 'pointer';
    }, bombCooldownTime);
});

function updateValueDisplay(element, value, suffix = '') {
    element.nextElementSibling.textContent = value + suffix;
}

processesControl.addEventListener('input', (e) => updateValueDisplay(e.target, e.target.value));

const patternNames = [
    'spiral', 'wave', 'triangle', 'lissajous', 'rose', 'epicycloid', 'polygon', 'zigzag', 'lemniscate', 'hypotrochoid', 'superellipse', 'randomwalk', 'star', 'heart', 'butterfly', 'figure8', 'sinecircle', 'sawtooth', 'squarewave', 'perlinlike'
];

// Nach der Canvas-Definition, vor den Steuerelementen
let mousePosition = { x: 0, y: 0 };
let mouseActive = false;
let mouseTrail = []; // Array für die Mausspur
const maxTrailLength = 20; // Maximale Länge der Spur

// === Anti-Camping-Mechanik ===
const CAMP_TIME_WINDOW = 1000; // ms
const CAMP_MIN_DIST = 10; // px
let mouseHistory = [];
let lastPenaltyTime = 0;

let lastMousePosition = { x: 0, y: 0 };
let lastMouseMoveTime = performance.now();
const SPEED_THRESHOLD = 800; // Erhöht von 300 auf 800 Pixel pro Sekunde
const REWARD_FACTOR = 0.2; // Reduziert von 0.5 auf 0.2 für subtilere Belohnung

// Verbesserte Maus-Tracking-Funktion
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const now = performance.now();
    const dt = (now - lastMouseMoveTime) / 1000; // Zeit in Sekunden
    
    // Berechne Geschwindigkeit
    const dx = (e.clientX - rect.left) * scaleX - lastMousePosition.x;
    const dy = (e.clientY - rect.top) * scaleY - lastMousePosition.y;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt; // Pixel pro Sekunde
    
    // Wenn Geschwindigkeit über Schwellenwert, reduziere penaltyTime
    if (speed > SPEED_THRESHOLD) {
        // Exponentieller Bonus für sehr schnelle Bewegungen
        const speedBonus = Math.pow((speed - SPEED_THRESHOLD) / SPEED_THRESHOLD, 1.5);
        penaltyTime = Math.max(0, penaltyTime - speedBonus * REWARD_FACTOR * dt);
    }
    
    // Aktualisiere letzte Position und Zeit
    lastMousePosition.x = (e.clientX - rect.left) * scaleX;
    lastMousePosition.y = (e.clientY - rect.top) * scaleY;
    lastMouseMoveTime = now;
    
    mousePosition.x = lastMousePosition.x;
    mousePosition.y = lastMousePosition.y;
    mouseActive = true;
    
    // Füge neue Position zur Spur hinzu
    mouseTrail.push({ x: mousePosition.x, y: mousePosition.y });
    if (mouseTrail.length > maxTrailLength) {
        mouseTrail.shift(); // Entferne ältesten Punkt
    }
    // Mausbewegung für Anti-Camping speichern
    mouseHistory.push({ x: mousePosition.x, y: mousePosition.y, t: performance.now() });
    // Nur die letzten 1s behalten
    const cutoff = performance.now() - CAMP_TIME_WINDOW;
    while (mouseHistory.length > 2 && mouseHistory[0].t < cutoff) mouseHistory.shift();
});

canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
    mouseTrail = [];
    mouseHistory = [];
});

function createProcess() {
    const now = performance.now();
    const lifetime = 2000 + Math.random() * 58000;
    
    // Deutlich stärkere Reaktion auf Maus
    const mouseReaction = {
        type: Math.random() < 0.33 ? 'attract' : (Math.random() < 0.5 ? 'repel' : 'orbit'),
        strength: 0.8 + Math.random() * 0.2, // Erhöht: 0.8 bis 1.0
        radius: 200 + Math.random() * 300 // Erhöht: 200 bis 500 Pixel
    };

    return {
        pattern: patternNames[Math.floor(Math.random() * patternNames.length)],
        origin: {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height
        },
        direction: {
            x: Math.random() < 0.5 ? 1 : -1,
            y: Math.random() < 0.5 ? 1 : -1
        },
        rotation: Math.random() * Math.PI * 2,
        time: 0,
        points: [],
        speed: 0.2 + Math.random() * 1, // Reduziert: 0.2 bis 1.2
        lineWidth: 1 + Math.random() * 7,
        alpha: 0.2 + Math.random() * 0.8,
        created: now,
        lifetime: lifetime,
        fading: false,
        fadeStart: null,
        fadeDuration: 1500 + Math.random() * 2000,
        mouseReaction: mouseReaction
    };
}

let processes = [createProcess()];
let processCount = 1;

processesControl.addEventListener('input', (e) => {
    processCount = Number(e.target.value);
    while (processes.length < processCount) {
        processes.push(createProcess());
    }
    while (processes.length > processCount) {
        processes.pop();
    }
});

const patterns = {
    spiral: (proc, t) => {
        const size = 30;
        const radius = size * (t / 50);
        const angle = t/10 + proc.rotation;
        return {
            x: proc.origin.x + proc.direction.x * radius * Math.cos(angle),
            y: proc.origin.y + proc.direction.y * radius * Math.sin(angle)
        };
    },
    wave: (proc, t) => {
        const size = 30;
        return {
            x: (proc.origin.x + proc.direction.x * t) % canvas.width,
            y: proc.origin.y + proc.direction.y * Math.sin(t/20 + proc.rotation) * size * 5
        };
    },
    triangle: (proc, t) => {
        const size = 30;
        const angle = t/20 + proc.rotation;
        return {
            x: proc.origin.x + proc.direction.x * Math.cos(angle) * size * 10,
            y: proc.origin.y + proc.direction.y * Math.sin(angle) * size * 10
        };
    },
    lissajous: (proc, t) => {
        const size = 30;
        return {
            x: proc.origin.x + Math.sin(t/30 + proc.rotation) * size * 10,
            y: proc.origin.y + Math.sin(t/20 + Math.PI/2 + proc.rotation) * size * 10
        };
    },
    rose: (proc, t) => {
        const size = 30;
        const k = 5;
        const r = size * 5 * Math.cos(k * t / 100);
        const angle = t/20 + proc.rotation;
        return {
            x: proc.origin.x + r * Math.cos(angle),
            y: proc.origin.y + r * Math.sin(angle)
        };
    },
    epicycloid: (proc, t) => {
        const size = 30;
        const R = size * 3, r = size, d = size * 2;
        const angle = t/30 + proc.rotation;
        return {
            x: proc.origin.x + (R + r) * Math.cos(angle) - d * Math.cos(((R + r) / r) * angle),
            y: proc.origin.y + (R + r) * Math.sin(angle) - d * Math.sin(((R + r) / r) * angle)
        };
    },
    polygon: (proc, t) => {
        const size = 30;
        const sides = 6;
        const angle = ((t/30) % (2 * Math.PI)) + proc.rotation;
        const radius = size * 10;
        return {
            x: proc.origin.x + radius * Math.cos(Math.floor(angle * sides / (2 * Math.PI)) * 2 * Math.PI / sides),
            y: proc.origin.y + radius * Math.sin(Math.floor(angle * sides / (2 * Math.PI)) * 2 * Math.PI / sides)
        };
    },
    zigzag: (proc, t) => {
        const size = 30;
        const period = 40;
        return {
            x: proc.origin.x + ((t % period) < period/2 ? 1 : -1) * size * 10 * Math.cos(proc.rotation),
            y: proc.origin.y + (t % (size*10)) * Math.sin(proc.rotation)
        };
    },
    lemniscate: (proc, t) => {
        const size = 30;
        const a = size * 8;
        const angle = t/30 + proc.rotation;
        return {
            x: proc.origin.x + (a * Math.cos(angle)) / (1 + Math.sin(angle) * Math.sin(angle)),
            y: proc.origin.y + (a * Math.cos(angle) * Math.sin(angle)) / (1 + Math.sin(angle) * Math.sin(angle))
        };
    },
    hypotrochoid: (proc, t) => {
        const size = 30;
        const R = size * 4, r = size * 2, d = size * 2;
        const angle = t/30 + proc.rotation;
        return {
            x: proc.origin.x + (R - r) * Math.cos(angle) + d * Math.cos(((R - r) / r) * angle),
            y: proc.origin.y + (R - r) * Math.sin(angle) - d * Math.sin(((R - r) / r) * angle)
        };
    },
    superellipse: (proc, t) => {
        const size = 30;
        const n = 2.5;
        const a = size * 10, b = size * 10;
        const angle = t/30 + proc.rotation;
        return {
            x: proc.origin.x + Math.sign(Math.cos(angle)) * Math.pow(Math.abs(Math.cos(angle)), 2/n) * a,
            y: proc.origin.y + Math.sign(Math.sin(angle)) * Math.pow(Math.abs(Math.sin(angle)), 2/n) * b
        };
    },
    randomwalk: (proc, t) => {
        const size = 30;
        if (!proc._rw) proc._rw = {x: proc.origin.x, y: proc.origin.y};
        proc._rw.x += (Math.random() - 0.5) * size * Math.cos(proc.rotation);
        proc._rw.y += (Math.random() - 0.5) * size * Math.sin(proc.rotation);
        return {x: proc._rw.x, y: proc._rw.y};
    },
    star: (proc, t) => {
        const size = 30;
        const spikes = 5;
        const outer = size * 10, inner = size * 5;
        const rot = t/20 + proc.rotation;
        const idx = Math.floor((rot % (2 * Math.PI)) * spikes / (2 * Math.PI));
        const r = idx % 2 === 0 ? outer : inner;
        return {
            x: proc.origin.x + r * Math.cos(rot),
            y: proc.origin.y + r * Math.sin(rot)
        };
    },
    heart: (proc, t) => {
        const size = 30;
        const angle = t/30 + proc.rotation;
        const r = size * 8;
        return {
            x: proc.origin.x + r * 16 * Math.pow(Math.sin(angle), 3),
            y: proc.origin.y - r * (13 * Math.cos(angle) - 5 * Math.cos(2*angle) - 2 * Math.cos(3*angle) - Math.cos(4*angle))
        };
    },
    butterfly: (proc, t) => {
        const size = 30;
        const angle = t/30 + proc.rotation;
        const r = Math.exp(Math.cos(angle)) - 2 * Math.cos(4*angle) - Math.pow(Math.sin(angle/12), 5);
        return {
            x: proc.origin.x + size * 20 * Math.sin(angle) * r,
            y: proc.origin.y + size * 20 * Math.cos(angle) * r
        };
    },
    figure8: (proc, t) => {
        const size = 30;
        const a = size * 10;
        const angle = t/30 + proc.rotation;
        return {
            x: proc.origin.x + a * Math.sin(angle),
            y: proc.origin.y + a * Math.sin(angle) * Math.cos(angle)
        };
    },
    sinecircle: (proc, t) => {
        const size = 30;
        const r = size * 10 + Math.sin(t/10 + proc.rotation) * size * 5;
        const angle = t/30 + proc.rotation;
        return {
            x: proc.origin.x + r * Math.cos(angle),
            y: proc.origin.y + r * Math.sin(angle)
        };
    },
    sawtooth: (proc, t) => {
        const size = 30;
        const period = 100;
        return {
            x: proc.origin.x + ((t % period) / period) * size * 20 * Math.cos(proc.rotation),
            y: proc.origin.y + ((t % period) / period) * size * 20 * Math.sin(proc.rotation)
        };
    },
    squarewave: (proc, t) => {
        const size = 30;
        const period = 80;
        return {
            x: proc.origin.x + ((Math.floor(t/period) % 2 === 0) ? size * 10 : -size * 10) * Math.cos(proc.rotation),
            y: proc.origin.y + ((t % period) / period) * size * 20 * Math.sin(proc.rotation)
        };
    },
    perlinlike: (proc, t) => {
        const size = 30;
        let x = proc.origin.x, y = proc.origin.y;
        for (let i = 1; i < 5; i++) {
            x += Math.sin(t/(10*i) + proc.rotation) * size * 2;
            y += Math.cos(t/(15*i) + proc.rotation) * size * 2;
        }
        return {x, y};
    },
    doubleSpiral: (proc, t) => {
        const size = 30;
        const radius = size * (t / 50);
        const angle = t/10 + proc.rotation;
        const offset = Math.sin(t/20) * size * 2;
        return {
            x: proc.origin.x + proc.direction.x * (radius + offset) * Math.cos(angle),
            y: proc.origin.y + proc.direction.y * (radius - offset) * Math.sin(angle)
        };
    },
    bouncingWave: (proc, t) => {
        const size = 30;
        const bounce = Math.abs(Math.sin(t/30)) * size * 5;
        return {
            x: (proc.origin.x + proc.direction.x * t) % canvas.width,
            y: proc.origin.y + proc.direction.y * Math.sin(t/20 + proc.rotation) * size * 5 + bounce
        };
    },
    flower: (proc, t) => {
        const size = 30;
        const petals = 8;
        const r = size * 5 * (1 + Math.sin(petals * t/50) * 0.5);
        const angle = t/20 + proc.rotation;
        return {
            x: proc.origin.x + r * Math.cos(angle),
            y: proc.origin.y + r * Math.sin(angle)
        };
    },
    chaos: (proc, t) => {
        const size = 30;
        if (!proc._chaos) proc._chaos = {x: 0, y: 0};
        proc._chaos.x += Math.sin(t/10) * size * 0.5;
        proc._chaos.y += Math.cos(t/15) * size * 0.5;
        return {
            x: proc.origin.x + proc._chaos.x,
            y: proc.origin.y + proc._chaos.y
        };
    },
    pulse: (proc, t) => {
        const size = 30;
        const pulse = Math.sin(t/20) * size * 3;
        const angle = t/30 + proc.rotation;
        return {
            x: proc.origin.x + (size * 5 + pulse) * Math.cos(angle),
            y: proc.origin.y + (size * 5 + pulse) * Math.sin(angle)
        };
    }
};

function switchPattern(proc) {
    const now = performance.now();
    const lifetime = 2000 + Math.random() * 58000; // 2-60 Sekunden
    proc.pattern = patternNames[Math.floor(Math.random() * patternNames.length)];
    proc.origin = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height
    };
    proc.direction = {
        x: Math.random() < 0.5 ? 1 : -1,
        y: Math.random() < 0.5 ? 1 : -1
    };
    proc.rotation = Math.random() * Math.PI * 2;
    proc.time = 0;
    proc.points.length = 0;
    proc.speed = 0.5 + Math.random() * 3;
    proc.lineWidth = 1 + Math.random() * 7;
    proc.alpha = 0.2 + Math.random() * 0.8;
    proc.created = now;
    proc.lifetime = lifetime;
    proc.fading = false;
    proc.fadeStart = null;
    proc.fadeDuration = 1500 + Math.random() * 2000;
}

processes.forEach((proc, idx) => {
    setInterval(() => switchPattern(proc), 5000 + Math.random() * 5000);
});

// Bildkategorien
const imageCategories = [
    'cat', 'dog', 'bird', 'fish', 'tiger', 'lion', 'elephant', 'giraffe',
    'mountain', 'beach', 'forest', 'desert', 'city',
    'flower', 'tree', 'garden', 'sunset', 'night'
];

// Verschiedene Formen für die Bilder
const shapeMasks = {
    circle: (ctx, x, y, width, height) => {
        ctx.beginPath();
        ctx.arc(x + width/2, y + height/2, Math.min(width, height)/2, 0, Math.PI * 2);
        ctx.closePath();
    },
    heart: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + size/2);
        ctx.bezierCurveTo(
            centerX, centerY + size,
            centerX - size, centerY + size,
            centerX - size, centerY
        );
        ctx.bezierCurveTo(
            centerX - size, centerY - size/2,
            centerX, centerY - size,
            centerX, centerY - size/2
        );
        ctx.bezierCurveTo(
            centerX, centerY - size,
            centerX + size, centerY - size/2,
            centerX + size, centerY
        );
        ctx.bezierCurveTo(
            centerX + size, centerY + size,
            centerX, centerY + size,
            centerX, centerY + size/2
        );
        ctx.closePath();
    },
    star: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size * 0.4;
        
        ctx.beginPath();
        for(let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / spikes;
            const pointX = centerX + Math.cos(angle) * radius;
            const pointY = centerY + Math.sin(angle) * radius;
            if(i === 0) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
    },
    hexagon: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        
        ctx.beginPath();
        for(let i = 0; i < 6; i++) {
            const angle = (Math.PI * i) / 3;
            const pointX = centerX + Math.cos(angle) * size;
            const pointY = centerY + Math.sin(angle) * size;
            if(i === 0) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
    },
    cloud: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        
        ctx.beginPath();
        ctx.arc(centerX - size/2, centerY, size/2, 0, Math.PI * 2);
        ctx.arc(centerX + size/2, centerY, size/2, 0, Math.PI * 2);
        ctx.arc(centerX, centerY - size/2, size/2, 0, Math.PI * 2);
        ctx.arc(centerX, centerY + size/2, size/2, 0, Math.PI * 2);
        ctx.closePath();
    },
    // Neue Formen
    diamond: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - size);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size);
        ctx.lineTo(centerX - size, centerY);
        ctx.closePath();
    },
    infinity: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY);
        ctx.bezierCurveTo(
            centerX - size, centerY - size,
            centerX, centerY - size,
            centerX, centerY
        );
        ctx.bezierCurveTo(
            centerX, centerY + size,
            centerX + size, centerY + size,
            centerX + size, centerY
        );
        ctx.bezierCurveTo(
            centerX + size, centerY - size,
            centerX, centerY - size,
            centerX, centerY
        );
        ctx.bezierCurveTo(
            centerX, centerY + size,
            centerX - size, centerY + size,
            centerX - size, centerY
        );
        ctx.closePath();
    },
    gear: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        const teeth = 12;
        
        ctx.beginPath();
        for(let i = 0; i < teeth * 2; i++) {
            const radius = i % 2 === 0 ? size : size * 0.7;
            const angle = (Math.PI * i) / teeth;
            const pointX = centerX + Math.cos(angle) * radius;
            const pointY = centerY + Math.sin(angle) * radius;
            if(i === 0) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
    },
    spiral: (ctx, x, y, width, height) => {
        const centerX = x + width/2;
        const centerY = y + height/2;
        const size = Math.min(width, height)/2;
        const turns = 3;
        
        ctx.beginPath();
        for(let i = 0; i <= turns * 360; i += 5) {
            const angle = (i * Math.PI) / 180;
            const radius = (size * i) / (turns * 360);
            const pointX = centerX + Math.cos(angle) * radius;
            const pointY = centerY + Math.sin(angle) * radius;
            if(i === 0) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
    }
};

// Neue Funktion für zufällige Bilder
function createRandomImage() {
    const width = 100 + Math.random() * 300; // 100-400px breit
    const height = 100 + Math.random() * 300; // 100-400px hoch
    const shapeKeys = Object.keys(shapeMasks);
    const shape = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
    
    const image = new Image();
    // picsum.photos mit random seed für verschiedene Bilder
    const randomSeed = Math.floor(Math.random() * 1e9);
    image.src = `https://picsum.photos/seed/${randomSeed}/${Math.floor(width)}/${Math.floor(height)}`;

    // Zufälligen Filter auswählen
    const filters = [
        'none',
        'sepia',
        'invert',
        'grayscale',
        'blur',
        'saturate',
        'hue-rotate',
        'contrast'
    ];
    const selectedFilter = filters[Math.floor(Math.random() * filters.length)];
    
    // Filter-Parameter
    let filterValue = '';
    switch(selectedFilter) {
        case 'blur':
            filterValue = `${Math.random() * 3}px`;
            break;
        case 'saturate':
            filterValue = `${Math.random() * 200}%`;
            break;
        case 'hue-rotate':
            filterValue = `${Math.random() * 360}deg`;
            break;
        case 'contrast':
            filterValue = `${Math.random() * 200}%`;
            break;
        case 'sepia':
            filterValue = `${Math.random() * 100}%`;
            break;
        case 'invert':
            filterValue = `${Math.random() * 100}%`;
            break;
        case 'grayscale':
            filterValue = `${Math.random() * 100}%`;
            break;
    }

    return {
        image: image,
        x: Math.random() * (canvas.width - width),
        y: Math.random() * (canvas.height - height),
        width: width,
        height: height,
        created: performance.now(),
        lifetime: 5000 + Math.random() * 10000, // 5-15 Sekunden
        alpha: 1,
        shape: shape,
        filter: selectedFilter,
        filterValue: filterValue,
        velocity: { x: 0, y: 0 },
        rotationVelocity: 0,
        rotation: 0,
        lastMouseInteraction: null,
        reactionStrength: 0.05 + Math.random() * 0.25 // Zufällige Reaktionsstärke zwischen 0.05 und 0.3
    };
}

let randomImages = [];
let lastImageCreation = 0;
const imageCreationInterval = 3000; // Neue Bilder alle 3 Sekunden

const randomWords = [
    "apple", "brave", "candle", "dance", "eagle", "forest", "glide", "honest", "island", "jungle",
    "kite", "lemon", "mirror", "night", "ocean", "paint", "quiet", "river", "sunset", "tree",
    "umbrella", "valley", "whisper", "xenon", "yellow", "zebra", "anchor", "breeze", "crystal", "drift",
    "ember", "feather", "grape", "harvest", "ignite", "jewel", "kingdom", "lantern", "meadow", "nest",
    "opal", "pulse", "quest", "ripple", "saddle", "tunnel", "unity", "violet", "wander", "yearn",
    "cosmic", "nebula", "quantum", "stellar", "galaxy", "phoenix", "dragon", "unicorn", "mystic", "ethereal",
    "aurora", "zenith", "celestial", "lunar", "solar", "cosmic", "stellar", "nebula", "quantum", "galaxy",
    "serenity", "tranquility", "harmony", "balance", "peace", "calm", "zen", "meditation", "mindful", "spirit",
    "cascade", "whirlpool", "vortex", "spiral", "swirl", "flow", "stream", "current", "wave", "tide",
    "crystal", "gem", "diamond", "ruby", "sapphire", "emerald", "pearl", "opal", "jade", "onyx"
];

function createRandomWord() {
    const word = randomWords[Math.floor(Math.random() * randomWords.length)];
    const fontSize = 20 + Math.random() * 60; // 20-80px
    const fontWeights = ["normal", "bold", "bolder", "lighter", 400, 600, 800];
    const fontWeight = fontWeights[Math.floor(Math.random() * fontWeights.length)];
    const cases = [w => w.toUpperCase(), w => w.toLowerCase(), w => w[0].toUpperCase() + w.slice(1).toLowerCase()];
    const wordCase = cases[Math.floor(Math.random() * cases.length)];
    const rotation = (Math.random() - 0.5) * Math.PI; // -90° bis +90°
    const x = Math.random() * (canvas.width - fontSize * word.length * 0.6);
    const y = fontSize + Math.random() * (canvas.height - fontSize);
    return {
        word: wordCase(word),
        fontSize,
        fontWeight,
        x,
        y,
        rotation,
        created: performance.now(),
        lifetime: 2000 + Math.random() * 8000, // 2-10 Sekunden
        alpha: 1,
        velocity: { x: 0, y: 0 },
        rotationVelocity: 0,
        lastMouseInteraction: null,
        reactionStrength: 0.05 + Math.random() * 0.25 // Zufällige Reaktionsstärke zwischen 0.05 und 0.3
    };
}

let randomWordsOnCanvas = [];
let lastWordCreation = 0;
const wordCreationInterval = 2200; // alle 2.2 Sekunden ein neues Wort (langsamer)
const maxWordsOnCanvas = 6; // Maximal 6 Wörter gleichzeitig

// Globale Linien, die über den Canvas gehen und an den Seiten invertieren
function createGlobalLine() {
    // Startpunkt an einer zufälligen Seite
    const sides = ['top', 'bottom', 'left', 'right'];
    const startSide = sides[Math.floor(Math.random() * sides.length)];
    let x, y, dx, dy;
    const speed = 2 + Math.random() * 3;
    if (startSide === 'top') {
        x = Math.random() * canvas.width;
        y = 0;
        dx = (Math.random() - 0.5) * speed;
        dy = speed;
    } else if (startSide === 'bottom') {
        x = Math.random() * canvas.width;
        y = canvas.height;
        dx = (Math.random() - 0.5) * speed;
        dy = -speed;
    } else if (startSide === 'left') {
        x = 0;
        y = Math.random() * canvas.height;
        dx = speed;
        dy = (Math.random() - 0.5) * speed;
    } else {
        x = canvas.width;
        y = Math.random() * canvas.height;
        dx = -speed;
        dy = (Math.random() - 0.5) * speed;
    }
    const color = `hsl(${Math.floor(Math.random()*360)}, 80%, 60%)`;
    return { x, y, dx, dy, color };
}

let globalLines = [];
const maxGlobalLines = 4;
let lastGlobalLineCreation = 0;
const globalLineInterval = 4000;

// Feste Polygone mit stabiler Farbe und langer Lebensdauer
function createFilledPolygon() {
    const numPoints = 3 + Math.floor(Math.random() * 3);
    const points = [];
    const centerX = 100 + Math.random() * (canvas.width - 200);
    const centerY = 100 + Math.random() * (canvas.height - 200);
    const radius = 120 + Math.random() * 180;
    const angleOffset = Math.random() * Math.PI * 2;
    for (let i = 0; i < numPoints; i++) {
        const angle = angleOffset + i * 2 * Math.PI / numPoints;
        points.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }
    const color = `hsl(${Math.floor(Math.random()*360)}, 70%, 50%)`;
    const created = performance.now();
    const lifetime = 30000 + Math.random() * 30000;
    return { 
        points, 
        color, 
        created, 
        lifetime,
        velocity: { x: 0, y: 0 },
        rotationVelocity: 0,
        rotation: 0,
        lastMouseInteraction: null,
        reactionStrength: 0.05 + Math.random() * 0.25 // Zufällige Reaktionsstärke zwischen 0.05 und 0.3
    };
}

let filledPolygons = [];
const maxPolygons = 5;
let lastPolygonCreation = 0;
const polygonInterval = 6000;

// Hilfsfunktion für Maus-Einfluss auf beliebige Position
function applyGeneralMouseInfluence(pos, strength = 0.15, radius = 180, type = 'repel', element = null) {
    if (!mouseActive || !element) return pos;
    const dx = mousePosition.x - pos.x;
    const dy = mousePosition.y - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > radius) return pos;
    const influence = Math.pow(1 - distance / radius, 2) * strength;
    let newPos = { ...pos };
    
    // Berechne die Geschwindigkeit basierend auf der Mausinteraktion
    if (element && element.lastMouseInteraction !== performance.now()) {
        const pushStrength = 0.15 * element.reactionStrength;
        element.velocity.x = -dx * pushStrength;
        element.velocity.y = -dy * pushStrength;
        element.rotationVelocity = (Math.random() - 0.5) * 0.02 * element.reactionStrength;
        element.lastMouseInteraction = performance.now();
        
        // Spiel Interaktions-Sound ab
        playSound('interaction');
    }
    
    if (type === 'attract') {
        newPos.x += dx * influence * element.reactionStrength;
        newPos.y += dy * influence * element.reactionStrength;
    } else if (type === 'repel') {
        newPos.x -= dx * influence * element.reactionStrength;
        newPos.y -= dy * influence * element.reactionStrength;
    }
    return newPos;
}

// === Minispiellogik: Timer und Berührungszeit ===
let gameStartTime = performance.now();
let lastFrameTime = gameStartTime;
let penaltyTime = 0;
let touching = false;

const DIFFICULTY_INTERVAL = 5000; // 5 Sekunden
const MIN_CANVAS_SCALE = 0.2; // Erhöht von 0.05 auf 0.2 (20% der ursprünglichen Größe)
let MAX_TOUCH_TIME = 20; // Sekunden, wird durch Modus gesetzt
let selectedMode = null;

const MODES = {
    easy: {
        time: 30,
        initialElements: {
            processes: 1,
            images: 2,
            words: 4,
            polygons: 3,
            lines: 2
        },
        elementIncrease: {
            processes: 0.5,
            images: 0.5,
            words: 0.5,
            polygons: 0.5,
            lines: 0.5
        }
    },
    medium: {
        time: 20,
        initialElements: {
            processes: 2,
            images: 3,
            words: 5,
            polygons: 4,
            lines: 3
        },
        elementIncrease: {
            processes: 0.8,
            images: 0.8,
            words: 0.8,
            polygons: 0.8,
            lines: 0.8
        }
    },
    hard: {
        time: 12,
        initialElements: {
            processes: 3,
            images: 4,
            words: 6,
            polygons: 5,
            lines: 4
        },
        elementIncrease: {
            processes: 1,
            images: 1,
            words: 1,
            polygons: 1,
            lines: 1
        }
    },
    hardcore: {
        time: 6,
        initialElements: {
            processes: 4,
            images: 5,
            words: 7,
            polygons: 6,
            lines: 5
        },
        elementIncrease: {
            processes: 1.5,
            images: 1.5,
            words: 1.5,
            polygons: 1.5,
            lines: 1.5
        }
    }
};

const MAX_PROCESSES = 20;
const MAX_IMAGES = 10;
const MAX_WORDS = 10;
const MAX_POLYGONS = 10;
const MAX_LINES = 8;

// === Startbildschirm-Linien-Animation ===
let startScreenLines = [];
let startScreenLinesActive = false;
let startScreenLinesAnimationFrame = null;

function createStartScreenLine(canvas) {
    const sides = ['top', 'bottom', 'left', 'right'];
    const startSide = sides[Math.floor(Math.random() * sides.length)];
    let x, y, dx, dy;
    const speed = 1.5 + Math.random() * 2.5;
    if (startSide === 'top') {
        x = Math.random() * canvas.width;
        y = 0;
        dx = (Math.random() - 0.5) * speed;
        dy = speed;
    } else if (startSide === 'bottom') {
        x = Math.random() * canvas.width;
        y = canvas.height;
        dx = (Math.random() - 0.5) * speed;
        dy = -speed;
    } else if (startSide === 'left') {
        x = 0;
        y = Math.random() * canvas.height;
        dx = speed;
        dy = (Math.random() - 0.5) * speed;
    } else {
        x = canvas.width;
        y = Math.random() * canvas.height;
        dx = -speed;
        dy = (Math.random() - 0.5) * speed;
    }
    const color = `hsl(${Math.floor(Math.random()*360)}, 80%, 60%)`;
    return { x, y, dx, dy, color };
}

function startScreenLinesAnimation() {
    const canvas = document.getElementById('startBgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Größe anpassen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (!startScreenLinesActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Linien bewegen und zeichnen
    for (const line of startScreenLines) {
        line.x += line.dx;
        line.y += line.dy;
        // Invertieren an den Rändern
        if (line.x < 0 || line.x > canvas.width) line.dx *= -1;
        if (line.y < 0 || line.y > canvas.height) line.dy *= -1;
        ctx.save();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3.5;
        ctx.globalAlpha = 0.95;
        ctx.shadowColor = line.color;
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x - line.dx * 40, line.y - line.dy * 40);
        ctx.stroke();
        ctx.restore();
    }
    startScreenLinesAnimationFrame = requestAnimationFrame(startScreenLinesAnimation);
}

function startStartScreenLines() {
    const canvas = document.getElementById('startBgCanvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    startScreenLines = [];
    for (let i = 0; i < 6; i++) {
        startScreenLines.push(createStartScreenLine(canvas));
    }
    startScreenLinesActive = true;
    startScreenLinesAnimation();
    window.addEventListener('resize', resizeStartScreenLinesCanvas);
}

function stopStartScreenLines() {
    startScreenLinesActive = false;
    if (startScreenLinesAnimationFrame) {
        cancelAnimationFrame(startScreenLinesAnimationFrame);
        startScreenLinesAnimationFrame = null;
    }
    const canvas = document.getElementById('startBgCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    window.removeEventListener('resize', resizeStartScreenLinesCanvas);
}

function resizeStartScreenLinesCanvas() {
    const canvas = document.getElementById('startBgCanvas');
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// === Integration in Startscreen-Logik ===
function setupStartScreen() {
    const startScreen = document.getElementById('startScreen');
    if (!startScreen) return;

    // Start Heartbeat-Sound schon beim Startbildschirm
    initAudio();
    updateHeartbeat();

    // Starte Linienanimation für Startscreen
    startStartScreenLines();

    // Schwierigkeitskarten als Buttons
    const cards = startScreen.querySelectorAll('.difficulty-card');
    cards.forEach(card => {
        card.onclick = () => {
            selectedMode = card.dataset.mode;
            const mode = MODES[selectedMode];
            MAX_TOUCH_TIME = mode.time;
            penaltyTime = 0;
            gameOver = false;
            gameStartTime = performance.now();
            lastFrameTime = gameStartTime;
            difficultyLevel = 0;
            lastDifficultyIncrease = performance.now();
            // Setze initiale Elemente basierend auf Modus
            processCount = mode.initialElements.processes;
            processes = Array(processCount).fill().map(() => createProcess());
            window.maxImagesOnCanvas = mode.initialElements.images;
            window.maxWordsOnCanvas = mode.initialElements.words;
            window.maxPolygons = mode.initialElements.polygons;
            window.maxGlobalLines = mode.initialElements.lines;
            randomImages = [];
            randomWordsOnCanvas = [];
            filledPolygons = [];
            globalLines = [];
            currentCanvasScale = 1;
            lastMouseStillPos = null;
            lastMouseStillTime = null;
            mouseHistory = [];
            lastImageCreation = performance.now() - imageCreationInterval;
            lastWordCreation = performance.now() - wordCreationInterval;
            lastPolygonCreation = performance.now() - polygonInterval;
            lastGlobalLineCreation = performance.now() - globalLineInterval;
            initAudio();
            updateHeartbeat();
            // Stoppe Startscreen-Linienanimation
            stopStartScreenLines();
            const msg = document.getElementById('gameOverMsg');
            if (msg) msg.remove();
            startScreen.style.display = 'none';
            processes.forEach((proc, idx) => {
                if (proc._switchInterval) clearInterval(proc._switchInterval);
                proc._switchInterval = setInterval(() => switchPattern(proc), 5000 + Math.random() * 5000);
            });
            requestAnimationFrame(animate);
        };
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupStartScreen);
} else {
    setupStartScreen();
}

function showGameOver() {
    if (document.getElementById('gameOverMsg')) return;
    
    // Spiel Game Over Sound
    playSound('gameOver');
    
    // Stop heartbeat on game over
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    const msg = document.createElement('div');
    msg.id = 'gameOverMsg';
    const totalTime = ((performance.now() - gameStartTime) / 1000).toFixed(1);
    // Modus-Name hübsch formatieren
    const modeName = selectedMode ? selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1) : '';
    msg.innerHTML = `
        <div style="margin-bottom:20px;text-align:center;">
            <div style="font-size:1.2em;margin-bottom:12px;">Game Over!</div>
            <div style="font-size:0.8em;color:#aaa;margin-bottom:8px;">You survived for ${totalTime} seconds</div>
            <div style="font-size:0.8em;color:#aaa;">Reached Level ${difficultyLevel + 1}</div>
            <div style="font-size:0.8em;color:#19f3ff;margin-top:8px;">Mode: <b>${modeName}</b></div>
        </div>
    `;
    msg.style.position = 'fixed';
    msg.style.left = '50%';
    msg.style.top = '50%';
    msg.style.transform = 'translate(-50%,-50%)';
    msg.style.background = '#222';
    msg.style.color = '#fff';
    msg.style.fontSize = '2em';
    msg.style.padding = '32px 48px';
    msg.style.borderRadius = '16px';
    msg.style.zIndex = 1000;
    msg.style.boxShadow = '0 4px 32px #000a';
    // Restart-Button
    const btn = document.createElement('button');
    btn.textContent = 'Restart';
    btn.style.fontSize = '1em';
    btn.style.padding = '12px 32px';
    btn.style.marginTop = '10px';
    btn.style.cursor = 'pointer';
    btn.style.background = '#4caf50';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.onclick = () => {
        msg.remove();
        document.getElementById('startScreen').style.display = 'flex';
    };
    msg.appendChild(btn);
    document.body.appendChild(msg);
    bombButton.style.display = 'none';
    resetBombBtnPosition();
}

function animate() {
    if (gameOver || !selectedMode) return;
    
    // Canvas-Größe sanft anpassen
    resizeCanvasWithLevel(true);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = performance.now();
    
    // === Schwierigkeitssteigerung ===
    if (now - lastDifficultyIncrease > DIFFICULTY_INTERVAL) {
        difficultyLevel++;
        lastDifficultyIncrease = now;
        
        // Spiel Level-Up Sound
        playSound('levelUp');
        
        // Update heartbeat speed with new level
        updateHeartbeat();
        
        // Show bomb button at level 2
        if (difficultyLevel === 1) {
            bombButton.style.display = 'block';
        }
        
        // Prozesse erhöhen
        processCount = Math.min(processCount + 1, MAX_PROCESSES);
        while (processes.length < processCount) processes.push(createProcess());
        // Bilder-Limit erhöhen
        window.maxImagesOnCanvas = (window.maxImagesOnCanvas || 3) + 1;
        if (window.maxImagesOnCanvas > MAX_IMAGES) window.maxImagesOnCanvas = MAX_IMAGES;
        // Wörter-Limit erhöhen
        window.maxWordsOnCanvas = (window.maxWordsOnCanvas || 6) + 1;
        if (window.maxWordsOnCanvas > MAX_WORDS) window.maxWordsOnCanvas = MAX_WORDS;
        // Polygone-Limit erhöhen
        window.maxPolygons = (window.maxPolygons || 5) + 1;
        if (window.maxPolygons > MAX_POLYGONS) window.maxPolygons = MAX_POLYGONS;
        // Linien-Limit erhöhen
        window.maxGlobalLines = (window.maxGlobalLines || 4) + 1;
        if (window.maxGlobalLines > MAX_LINES) window.maxGlobalLines = MAX_LINES;
        // Canvas-Zielgröße wird automatisch angepasst, aber kein harter Sprung mehr
    }
    // Setze Limits für die eigentlichen Arrays
    if (typeof window.maxImagesOnCanvas === 'number') {
        while (randomImages.length > window.maxImagesOnCanvas) randomImages.shift();
    }
    if (typeof window.maxWordsOnCanvas === 'number') {
        while (randomWordsOnCanvas.length > window.maxWordsOnCanvas) randomWordsOnCanvas.shift();
    }
    if (typeof window.maxPolygons === 'number') {
        while (filledPolygons.length > window.maxPolygons) filledPolygons.shift();
    }
    if (typeof window.maxGlobalLines === 'number') {
        while (globalLines.length > window.maxGlobalLines) globalLines.shift();
    }

    // Zeichne die Mausspur
    if (mouseActive && mouseTrail.length > 1) {
        ctx.save();
        // Gradient für die Linie
        const gradient = ctx.createLinearGradient(
            mouseTrail[0].x, mouseTrail[0].y,
            mouseTrail[mouseTrail.length - 1].x,
            mouseTrail[mouseTrail.length - 1].y
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(mouseTrail[0].x, mouseTrail[0].y);
        for (let i = 1; i < mouseTrail.length; i++) {
            ctx.lineTo(mouseTrail[i].x, mouseTrail[i].y);
        }
        ctx.stroke();
        
        // Zeichne einen leuchtenden Punkt an der aktuellen Mausposition
        ctx.beginPath();
        ctx.arc(mousePosition.x, mousePosition.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
        
        // Glüheffekt um den Punkt
        ctx.beginPath();
        ctx.arc(mousePosition.x, mousePosition.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        
        ctx.restore();
    }

    // Neue globale Linien erstellen
    if (now - lastGlobalLineCreation > globalLineInterval && globalLines.length < maxGlobalLines) {
        globalLines.push(createGlobalLine());
        lastGlobalLineCreation = now;
    }
    // Neue Polygone erstellen
    if (now - lastPolygonCreation > polygonInterval) {
        if (filledPolygons.length >= maxPolygons) {
            // Entferne das älteste Polygon
            filledPolygons.sort((a, b) => a.created - b.created);
            filledPolygons.shift();
        }
        filledPolygons.push(createFilledPolygon());
        lastPolygonCreation = now;
    }

    // Polygone zeichnen (bleiben lange bestehen)
    filledPolygons = filledPolygons.filter(poly => (now - poly.created) < poly.lifetime);
    for (const poly of filledPolygons) {
        // Polygonmittelpunkt berechnen
        let center = poly.points.reduce((acc, p) => ({x: acc.x + p.x, y: acc.y + p.y}), {x:0, y:0});
        center.x /= poly.points.length;
        center.y /= poly.points.length;
        
        // Maus-Einfluss auf Mittelpunkt
        let newCenter = applyGeneralMouseInfluence(center, 1.0, 220, 'repel', poly);
        
        // Wende Trägheitsbewegung an
        if (poly.lastMouseInteraction && now - poly.lastMouseInteraction < 1000) {
            poly.velocity.x *= 0.95;
            poly.velocity.y *= 0.95;
            poly.rotationVelocity *= 0.95;
            poly.rotation += poly.rotationVelocity;
            newCenter.x += poly.velocity.x;
            newCenter.y += poly.velocity.y;
        }
        
        let dx = newCenter.x - center.x;
        let dy = newCenter.y - center.y;
        
        // Punkte verschieben
        let movedPoints = poly.points.map(p => ({x: p.x + dx, y: p.y + dy}));
        ctx.save();
        ctx.translate(newCenter.x, newCenter.y);
        ctx.rotate(poly.rotation);
        ctx.beginPath();
        ctx.moveTo(movedPoints[0].x - newCenter.x, movedPoints[0].y - newCenter.y);
        for (let i = 1; i < movedPoints.length; i++) {
            ctx.lineTo(movedPoints[i].x - newCenter.x, movedPoints[i].y - newCenter.y);
        }
        ctx.closePath();
        ctx.fillStyle = poly.color;
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.restore();
    }

    // Globale Linien bewegen und zeichnen
    for (const line of globalLines) {
        // Maus-Einfluss auf Linienkopf
        let newPos = applyGeneralMouseInfluence({x: line.x, y: line.y}, 1.2, 200, 'repel');
        line.x = newPos.x;
        line.y = newPos.y;
        // Bewegung
        line.x += line.dx;
        line.y += line.dy;
        // Invertieren an den Rändern
        if (line.x < 0 || line.x > canvas.width) line.dx *= -1;
        if (line.y < 0 || line.y > canvas.height) line.dy *= -1;
        // Zeichnen
        ctx.save();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x - line.dx * 50, line.y - line.dy * 50); // Linie in Bewegungsrichtung
        ctx.stroke();
        ctx.restore();
    }

    // Neue Bilder erstellen
    if (now - lastImageCreation > imageCreationInterval) {
        randomImages.push(createRandomImage());
        lastImageCreation = now;
    }

    // Neue Wörter erstellen
    if (now - lastWordCreation > wordCreationInterval && randomWordsOnCanvas.length < maxWordsOnCanvas) {
        randomWordsOnCanvas.push(createRandomWord());
        lastWordCreation = now;
    }

    // Wörter zeichnen und verwalten
    randomWordsOnCanvas = randomWordsOnCanvas.filter(wordObj => {
        const age = now - wordObj.created;
        if (age > wordObj.lifetime) return false;
        
        // Fade-out Effekt
        let alpha = 1;
        if (age > wordObj.lifetime * 0.7) {
            alpha = 1 - ((age - wordObj.lifetime * 0.7) / (wordObj.lifetime * 0.3));
        }
        
        // Maus-Einfluss auf Wortposition
        let newPos = applyGeneralMouseInfluence({x: wordObj.x, y: wordObj.y}, 0.8, 180, 'repel', wordObj);
        
        // Wende Trägheitsbewegung an
        if (wordObj.lastMouseInteraction && now - wordObj.lastMouseInteraction < 1000) {
            wordObj.velocity.x *= 0.95;
            wordObj.velocity.y *= 0.95;
            wordObj.rotationVelocity *= 0.95;
            wordObj.rotation += wordObj.rotationVelocity;
            newPos.x += wordObj.velocity.x;
            newPos.y += wordObj.velocity.y;
        }
        
        wordObj.x = newPos.x;
        wordObj.y = newPos.y;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `${wordObj.fontWeight} ${wordObj.fontSize}px Arial`;
        ctx.translate(wordObj.x, wordObj.y);
        ctx.rotate(wordObj.rotation);
        ctx.fillStyle = wordObj.color || (wordObj.color = `hsl(${Math.floor(Math.random()*360)}, 80%, 60%)`);
        ctx.fillText(wordObj.word, 0, 0);
        ctx.restore();
        return true;
    });

    // Bilder zeichnen und verwalten
    randomImages = randomImages.filter(img => {
        const age = now - img.created;
        if (age > img.lifetime) {
            return false;
        }
        
        // Fade-out Effekt
        if (age > img.lifetime * 0.7) {
            img.alpha = 1 - ((age - img.lifetime * 0.7) / (img.lifetime * 0.3));
        }
        
        if (img.image.complete) {
            // Maus-Einfluss auf Bildposition
            let newPos = applyGeneralMouseInfluence({x: img.x, y: img.y}, 0.7, 160, 'repel', img);
            
            // Wende Trägheitsbewegung an
            if (img.lastMouseInteraction && now - img.lastMouseInteraction < 1000) {
                img.velocity.x *= 0.95;
                img.velocity.y *= 0.95;
                img.rotationVelocity *= 0.95;
                img.rotation += img.rotationVelocity;
                newPos.x += img.velocity.x;
                newPos.y += img.velocity.y;
            }
            
            img.x = newPos.x;
            img.y = newPos.y;
            
            ctx.save();
            ctx.globalAlpha = img.alpha;
            ctx.translate(img.x + img.width/2, img.y + img.height/2);
            ctx.rotate(img.rotation);
            ctx.translate(-img.width/2, -img.height/2);
            shapeMasks[img.shape](ctx, 0, 0, img.width, img.height);
            ctx.clip();
            if (img.filter !== 'none') {
                ctx.filter = `${img.filter}(${img.filterValue})`;
            }
            ctx.drawImage(img.image, 0, 0, img.width, img.height);
            ctx.restore();
        }
        return true;
    });

    // Bestehende Animation
    for (let i = 0; i < processes.length; i++) {
        let proc = processes[i];
        const hue = ((proc.time * 0.2) + i * 60) % 360;
        let grad = ctx.createLinearGradient(proc.origin.x, proc.origin.y, proc.origin.x + 200, proc.origin.y + 200);
        grad.addColorStop(0, `hsl(${hue}, 90%, 60%)`);
        grad.addColorStop(1, `hsl(${(hue+120)%360}, 90%, 60%)`);
        const color = grad;
        let pos = patterns[proc.pattern](proc, proc.time);
        
        // Wende Mausinteraktion an
        pos = applyGeneralMouseInfluence(pos, 0.5, 200, 'repel');
        
        // Reduziere die Anzahl der Punkte für bessere Performance
        if (proc.points.length > 50) {
            proc.points = proc.points.slice(-50);
        }
        
        if (pos.x < 0) { proc.direction.x *= -1; pos.x = 0; }
        if (pos.x > canvas.width) { proc.direction.x *= -1; pos.x = canvas.width; }
        if (pos.y < 0) { proc.direction.y *= -1; pos.y = 0; }
        if (pos.y > canvas.height) { proc.direction.y *= -1; pos.y = canvas.height; }
        proc.points.push({ x: pos.x, y: pos.y });
        
        // Lebensdauer prüfen
        let age = now - proc.created;
        let fadeAlpha = proc.alpha;
        if (!proc.fading && age > proc.lifetime) {
            proc.fading = true;
            proc.fadeStart = now;
        }
        if (proc.fading) {
            let fadeProgress = (now - proc.fadeStart) / proc.fadeDuration;
            fadeAlpha = proc.alpha * (1 - fadeProgress);
            if (fadeProgress >= 1) {
                processes[i] = createProcess();
                continue;
            }
        }
        if (proc.points.length > 1) {
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = proc.lineWidth;
            ctx.beginPath();
            for (let j = 1; j < proc.points.length; j++) {
                ctx.moveTo(proc.points[j-1].x, proc.points[j-1].y);
                ctx.lineTo(proc.points[j].x, proc.points[j].y);
            }
            ctx.stroke();
            ctx.restore();
        }
        // Muster langsamer und größer aufbauen
        proc.time += proc.speed * 0.35; // langsamer
    }

    // === Minispiellogik: Timer und Berührungszeit ===
    let totalTime = (now - gameStartTime) / 1000;
    let dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    let isTouching = false;
    // --- Prüfe auf Berührung mit Bildern ---
    for (const img of randomImages) {
        if (!img.image.complete) continue;
        // Transformierte Mauskoordinaten (Rotation!)
        let cx = img.x + img.width/2;
        let cy = img.y + img.height/2;
        let mx = mousePosition.x - cx;
        let my = mousePosition.y - cy;
        let angle = -img.rotation;
        let rx = Math.cos(angle) * mx - Math.sin(angle) * my + img.width/2;
        let ry = Math.sin(angle) * mx + Math.cos(angle) * my + img.height/2;
        // Maske nach Form prüfen
        ctx.save();
        ctx.beginPath();
        shapeMasks[img.shape](ctx, 0, 0, img.width, img.height);
        let hit = ctx.isPointInPath(rx, ry);
        ctx.restore();
        if (hit) { isTouching = true; break; }
    }
    // --- Prüfe auf Berührung mit Polygonen ---
    if (!isTouching) {
        for (const poly of filledPolygons) {
            // Mittelpunkt-Transformation (Rotation)
            let center = poly.points.reduce((acc, p) => ({x: acc.x + p.x, y: acc.y + p.y}), {x:0, y:0});
            center.x /= poly.points.length;
            center.y /= poly.points.length;
            let angle = -poly.rotation;
            let mx = mousePosition.x - center.x;
            let my = mousePosition.y - center.y;
            let rotated = poly.points.map(p => {
                let dx = p.x - center.x, dy = p.y - center.y;
                return {
                    x: Math.cos(angle) * dx - Math.sin(angle) * dy,
                    y: Math.sin(angle) * dx + Math.cos(angle) * dy
                };
            });
            if (pointInPolygon({x: mx, y: my}, rotated.map(p => ({x: p.x, y: p.y})))) {
                isTouching = true; break;
            }
        }
    }
    // --- Prüfe auf Berührung mit Wörtern ---
    if (!isTouching) {
        for (const wordObj of randomWordsOnCanvas) {
            let w = ctx.measureText(wordObj.word).width;
            let h = wordObj.fontSize;
            let cx = wordObj.x, cy = wordObj.y;
            let angle = -wordObj.rotation;
            let mx = mousePosition.x - cx;
            let my = mousePosition.y - cy;
            let rx = Math.cos(angle) * mx - Math.sin(angle) * my;
            let ry = Math.sin(angle) * mx + Math.cos(angle) * my;
            if (rectContains({x: rx, y: ry}, 0, -h*0.7, w, h)) {
                isTouching = true; break;
            }
        }
    }
    // --- Prüfe auf Berührung mit Linien ---
    if (!isTouching) {
        for (const line of globalLines) {
            let a = {x: line.x, y: line.y};
            let b = {x: line.x - line.dx * 50, y: line.y - line.dy * 50};
            if (pointNearLine(mousePosition, a, b, 8)) {
                isTouching = true; break;
            }
        }
    }
    // --- Prüfe auf Berührung mit Prozesspfaden ---
    if (!isTouching) {
        for (const proc of processes) {
            for (let j = 1; j < proc.points.length; j++) {
                let a = proc.points[j-1];
                let b = proc.points[j];
                if (pointNearLine(mousePosition, a, b, 8)) {
                    isTouching = true; break;
                }
            }
            if (isTouching) break;
        }
    }
    // --- Prüfe auf Berührung mit Bomb Button ---
    if (!isTouching && bombButton.style.display !== 'none') {
        const rect = bombButton.getBoundingClientRect();
        const scaleX = canvas.width / window.innerWidth;
        const scaleY = canvas.height / window.innerHeight;
        
        if (mousePosition.x >= rect.left * scaleX && 
            mousePosition.x <= rect.right * scaleX && 
            mousePosition.y >= rect.top * scaleY && 
            mousePosition.y <= rect.bottom * scaleY) {
            isTouching = true;
        }
    }
    // --- Zeit zählen für Berührung ---
    if (isTouching && mouseActive) {
        penaltyTime += dt;
        touching = true;
        // Spiel Sound bei Berührung
        if (!touching) { // Nur beim ersten Kontakt
            playSound('collision');
        }
    } else {
        touching = false;
    }
    // === Anti-Camping-Mechanik: Hochzählen, wenn Maus exakt still steht ODER außerhalb Canvas ===
    if (!mouseActive) {
        // Maus ist nicht auf dem Canvas: Strafzeit hochzählen
        penaltyTime += dt;
        lastMouseStillPos = null;
        lastMouseStillTime = null;
    } else {
        if (lastMouseStillPos && mousePosition.x === lastMouseStillPos.x && mousePosition.y === lastMouseStillPos.y) {
            // Maus steht exakt still
            penaltyTime += dt;
        } else {
            lastMouseStillPos = {x: mousePosition.x, y: mousePosition.y};
            lastMouseStillTime = now;
        }
    }
    updateGameStatsDisplay(totalTime, penaltyTime);
    updateTouchBar();
    // Game Over prüfen
    if (penaltyTime >= MAX_TOUCH_TIME) {
        gameOver = true;
        showGameOver();
        return;
    }
    requestAnimationFrame(animate);
}

function pointInPolygon(point, vs) {
    // Ray-casting algorithm
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function rectContains(point, x, y, w, h) {
    return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
}

function pointNearLine(p, a, b, dist) {
    // Abstand Punkt zu Linie (a-b)
    const A = p.x - a.x;
    const B = p.y - a.y;
    const C = b.x - a.x;
    const D = b.y - a.y;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;
    let xx, yy;
    if (param < 0) { xx = a.x; yy = a.y; }
    else if (param > 1) { xx = b.x; yy = b.y; }
    else { xx = a.x + param * C; yy = a.y + param * D; }
    const dx = p.x - xx, dy = p.y - yy;
    return (dx * dx + dy * dy) <= dist * dist;
}

function updateGameStatsDisplay(total, penalty) {
    // Only update the existing HTML elements
    const totalTimeSpan = document.getElementById('totalTime');
    if (totalTimeSpan) totalTimeSpan.textContent = total.toFixed(1);
    const levelDisplaySpan = document.getElementById('levelDisplay');
    if (levelDisplaySpan) levelDisplaySpan.textContent = (difficultyLevel + 1);
    // Modus-Anzeige ergänzen
    let modeSpan = document.getElementById('modeDisplay');
    if (!modeSpan) {
        const statsDiv = document.getElementById('game-stats');
        if (statsDiv) {
            modeSpan = document.createElement('div');
            modeSpan.id = 'modeDisplay';
            statsDiv.appendChild(modeSpan);
        }
    }
    if (modeSpan) {
        const modeName = selectedMode ? selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1) : '';
        modeSpan.innerHTML = `Mode: <b>${modeName}</b>`;
    }
}

function updateTouchBar() {
    const bar = document.getElementById('touchBar');
    let rest = Math.max(0, MAX_TOUCH_TIME - penaltyTime);
    let percent = (rest / MAX_TOUCH_TIME) * 100;
    bar.style.width = percent + '%';
    if (percent > 60) bar.style.background = 'linear-gradient(90deg,#4caf50,#ffeb3b)';
    else if (percent > 30) bar.style.background = 'linear-gradient(90deg,#ffeb3b,#f44336)';
    else bar.style.background = 'linear-gradient(90deg,#f44336,#900)';
}

animate(); 

// --- Bomb Button Float-Away Logic (zentriert rechts als Grundposition) ---
const BOMB_BTN_SIZE = 20;
const BOMB_BTN_MARGIN = 24;
let bombBtnBaseTop = '50%';
let bombBtnBaseRight = BOMB_BTN_MARGIN + 'px';
let bombBtnBaseTransform = 'translateY(-50%)';
let bombBtnFloatTimeout = null;

function resetBombBtnPosition() {
    bombButton.style.top = bombBtnBaseTop;
    bombButton.style.right = bombBtnBaseRight;
    bombButton.style.left = '';
    bombButton.style.bottom = '';
    bombButton.style.transform = bombBtnBaseTransform;
}

resetBombBtnPosition();

window.addEventListener('resize', resetBombBtnPosition);

let lastNopeTime = 0;
window.addEventListener('mousemove', (e) => {
    if (bombButton.style.display === 'none') return;
    const btnRect = bombButton.getBoundingClientRect();
    const btnCenterX = btnRect.left + btnRect.width / 2;
    const btnCenterY = btnRect.top + btnRect.height / 2;
    const dist = Math.hypot(e.clientX - btnCenterX, e.clientY - btnCenterY);
    // Weniger nervig: erst ab 48px Distanz, weniger Flucht
    if (dist < 48) {
        let dx = btnCenterX - e.clientX;
        let dy = btnCenterY - e.clientY;
        let len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        // Weniger Flucht: max 28px
        let moveDist = 28 * (1 - dist / 48);
        let offsetX = dx * moveDist;
        let offsetY = dy * moveDist;
        // Begrenzung: Button darf nicht aus dem Fenster
        const maxOffsetX = window.innerWidth - btnRect.right - 2;
        const minOffsetX = -(btnRect.left - 2);
        const maxOffsetY = window.innerHeight - btnRect.bottom - 2;
        const minOffsetY = -(btnRect.top - 2);
        offsetX = Math.max(minOffsetX, Math.min(offsetX, maxOffsetX));
        offsetY = Math.max(minOffsetY, Math.min(offsetY, maxOffsetY));
        bombButton.style.transform = `translate(${offsetX}px, calc(-50% + ${offsetY}px))`;
        if (bombBtnFloatTimeout) clearTimeout(bombBtnFloatTimeout);
        bombBtnFloatTimeout = setTimeout(resetBombBtnPosition, 600);
        // --- Floating NOPE Text ---
        const now = Date.now();
        if (now - lastNopeTime > 600) {
            lastNopeTime = now;
            const nopeTexts = ['nope', 'no', 'nooo'];
            const text = nopeTexts[Math.floor(Math.random() * nopeTexts.length)];
            const nopeSpan = document.createElement('span');
            nopeSpan.textContent = text;
            nopeSpan.style.position = 'fixed';
            nopeSpan.style.left = (btnCenterX - 10) + 'px';
            nopeSpan.style.top = (btnCenterY - 10) + 'px';
            nopeSpan.style.fontSize = '16px';
            nopeSpan.style.fontWeight = 'bold';
            nopeSpan.style.color = '#fff';
            nopeSpan.style.textShadow = '0 2px 8px #000, 0 0 2px #f00';
            nopeSpan.style.pointerEvents = 'none';
            nopeSpan.style.transition = 'transform 0.7s cubic-bezier(.4,1.6,.6,1), opacity 0.7s linear';
            nopeSpan.style.opacity = '1';
            document.body.appendChild(nopeSpan);
            setTimeout(() => {
                nopeSpan.style.transform = `translate(${dx*28}px, ${dy*28}px)`;
                nopeSpan.style.opacity = '0';
            }, 10);
            setTimeout(() => {
                nopeSpan.remove();
            }, 800);
        }
    }
}); 