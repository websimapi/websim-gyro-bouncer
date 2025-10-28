import { Player } from './player.js';
import { PlatformManager } from './platforms.js';
import { Controls } from './controls.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreDisplay = document.getElementById('score-display');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const highScoreEl = document.getElementById('high-score');

let player, platformManager;
let cameraY = 0;
let score = 0;
let gameState = 'start';

const playerImg = new Image();
playerImg.src = 'player.png';
const platformImg = new Image();
platformImg.src = 'platform.png';

const controls = new Controls();

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function init() {
    player = new Player(canvas.width / 2, canvas.height - 100, playerImg);
    platformManager = new PlatformManager(canvas.width, canvas.height, platformImg);
    platformManager.generateInitialPlatforms();
    
    cameraY = 0;
    score = 0;
    scoreEl.textContent = 0;
    
    uiState('game');
    if (gameState !== 'playing') {
        gameState = 'playing';
        gameLoop();
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
    }
}

function update() {
    const tilt = controls.getTilt();
    player.update(tilt, platformManager.platforms, canvas.width);

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

function gameLoop() {
    if (gameState !== 'playing') return;
    update();
    draw();
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

restartButton.addEventListener('click', init);

// Initial UI state
uiState('start');