import { Player } from './player.js';
import { PlatformManager } from './platforms.js';
import { Controls } from './controls.js';
import { Replay } from './replay.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const replayCanvas = document.getElementById('replay-canvas');
const replayCtx = replayCanvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreDisplay = document.getElementById('score-display');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const highScoreEl = document.getElementById('high-score');

let player, platformManager, replay;
let cameraY = 0;
let score = 0;
let gameState = 'start';
let lastTime = 0;

const playerImg = new Image();
playerImg.src = 'player.png';
const platformImg = new Image();
platformImg.src = 'platform.png';

const controls = new Controls();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Set replay canvas resolution based on its display size
    const replayRect = replayCanvas.getBoundingClientRect();
    replayCanvas.width = replayRect.width * window.devicePixelRatio;
    replayCanvas.height = replayRect.height * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function init() {
    player = new Player(canvas.width / 2, canvas.height - 100, playerImg);
    platformManager = new PlatformManager(canvas.width, canvas.height, platformImg);
    platformManager.generateInitialPlatforms();
    replay = new Replay();
    
    cameraY = 0;
    score = 0;
    scoreEl.textContent = 0;
    
    uiState('game');
    if (gameState !== 'playing') {
        gameState = 'playing';
        requestAnimationFrame(gameLoop);
    }
}

function uiState(state) {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.add('hidden');

    if (state === 'start') {
        startScreen.classList.remove('hidden');
    } else if (state === 'game') {
        scoreDisplay.classList.remove('hidden');
    } else if (state === 'over') {
        finalScoreEl.textContent = score;
        let highScore = parseInt(localStorage.getItem('gyroBouncerHighScore')) || 0;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('gyroBouncerHighScore', highScore);
        }
        highScoreEl.textContent = highScore;
        gameOverScreen.classList.remove('hidden');
        resizeCanvas(); // Ensure replay canvas is sized correctly when shown
        replay.startPlayback(60); // Assuming 60fps, can be improved later
    }
}

function update(deltaTime) {
    const tilt = controls.getTilt();
    player.update(tilt, platformManager.platforms, canvas.width, deltaTime);

    // Camera follows player
    if (player.y < cameraY + canvas.height / 2.5) {
        cameraY = player.y - canvas.height / 2.5;
    }
    
    // Update score
    score = Math.max(score, Math.floor(-cameraY / 10));
    scoreEl.textContent = score;

    platformManager.update(cameraY);
    
    // Game over condition
    if (player.y > cameraY + canvas.height) {
        gameState = 'gameOver';
        uiState('over');
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(0, -cameraY);

    platformManager.draw(ctx);
    player.draw(ctx);

    ctx.restore();
}

function drawReplay(deltaTime) {
    const frame = replay.getPlaybackFrame(deltaTime);
    if (!frame) return;

    replayCtx.clearRect(0, 0, replayCanvas.width, replayCanvas.height);
    
    // Scale replay content to fit the replay canvas, maintaining aspect ratio
    const scale = replayCanvas.width / canvas.width;
    replayCtx.save();
    replayCtx.scale(scale, scale);

    replayCtx.translate(0, -frame.cameraY);

    // Draw platforms
    for (const p of frame.platforms) {
        replayCtx.drawImage(platformImg, p.x, p.y, p.width, p.height);
    }

    // Draw player
    replayCtx.drawImage(playerImg, frame.player.x, frame.player.y, player.width, player.height);

    replayCtx.restore();
}


function gameLoop(timestamp) {
    if (!lastTime) {
        lastTime = timestamp;
    }
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const clampedDeltaTime = Math.min(deltaTime, 0.1);

    if (gameState === 'playing') {
        // Clamp deltaTime to avoid large jumps if tab is inactive for a while
        update(clampedDeltaTime);
        draw();
        replay.recordFrame(player, platformManager.platforms, cameraY, clampedDeltaTime);
    } else if (gameState === 'gameOver' && replay.isPlaying) {
        drawReplay(clampedDeltaTime);
    }
    
    requestAnimationFrame(gameLoop);
}

startButton.addEventListener('click', () => {
    controls.requestPermission().then(granted => {
        if (granted) {
            init();
        } else {
            alert('Motion sensor access is required to play this game.');
        }
    }).catch(console.error);
});

restartButton.addEventListener('click', () => {
    lastTime = 0; // Reset lastTime on restart
    init();
});

// Initial UI state
uiState('start');
requestAnimationFrame(gameLoop);