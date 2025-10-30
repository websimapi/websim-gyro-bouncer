import { Player } from './player.js';
import { PlatformManager } from './platforms.js';
import { Controls } from './controls.js';
import { Replay } from './replay.js';
import QRCode from 'qrcode';
import Matter from 'https://esm.sh/matter-js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const replayCanvas = document.getElementById('replay-canvas');
const replayCtx = replayCanvas.getContext('2d');

const loadingScreen = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const scoreDisplay = document.getElementById('score-display');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const highScoreEl = document.getElementById('high-score');

// --- Matter.js setup ---
let engine;
const restitution = 3.0; // Bounciness

let player, platformManager, replay;
let cameraY = 0;
let score = 0;
let gameState = 'start';
let lastTime = 0;

let audioCtx;
let bounceSoundBuffer;

const platformImg = new Image();
platformImg.src = 'platform.png';

let userAvatarImg = null;
let avatarLoadFailed = false;

const controls = new Controls();
const AVATAR_CACHE_KEY = 'gyroBouncerAvatarCache';
const isDesktop = !('ontouchstart' in window) && navigator.maxTouchPoints < 1;

function setupDesktopUI() {
    if (isDesktop) {
        document.body.classList.add('is-desktop');
        const qrCanvas = document.getElementById('qr-code');
        if (qrCanvas) {
             QRCode.toCanvas(qrCanvas, 'https://bouncer.on.websim.com', { width: 180, margin: 1 }, function (error) {
                if (error) console.error(error);
                console.log('QR code generated!');
            });
        }
    }
}

async function preload() {
    // On desktop, we don't need to load an avatar. This is now handled before main() is called.
    if (isDesktop) {
        return;
    }

    uiState('loading');
    loadingStatus.textContent = 'Initializing...';
    let finalLoadingMessage = '';
    let fromCache = false;

    try {
        loadingStatus.textContent = 'Connecting to server...';
        const room = new WebsimSocket();
        await room.initialize();
        const client = room.peers[room.clientId];
        if (client && client.avatarUrl) {
            loadingStatus.textContent = 'Profile found. Checking for cached avatar...';
            const cachedAvatar = JSON.parse(localStorage.getItem(AVATAR_CACHE_KEY));
            if (cachedAvatar && cachedAvatar.url === client.avatarUrl) {
                console.log("Loading avatar from cache.");
                fromCache = true;
                loadingStatus.textContent = 'Loading avatar from local cache...';
                await new Promise(resolve => setTimeout(resolve, 1000));
                userAvatarImg = await loadImageFromDataURL(cachedAvatar.dataUrl);
                finalLoadingMessage = 'Avatar loaded from cache.';
            } else {
                console.log("Fetching new avatar.");
                loadingStatus.textContent = 'Fetching your avatar...';
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { image: fetchedImg, source } = await loadImageWithProxies(client.avatarUrl);
                if (fetchedImg) {
                    userAvatarImg = fetchedImg;
                    if (source === 'Direct') {
                        finalLoadingMessage = 'Avatar loaded directly.';
                    } else if (source.startsWith('CORS Proxy')) {
                        finalLoadingMessage = `Avatar loaded via ${source}.`;
                    }
                    loadingStatus.textContent = finalLoadingMessage;
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Show message

                    loadingStatus.textContent = 'Caching avatar for next time...';
                    const dataUrl = imageToDataURL(userAvatarImg);
                    localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify({ url: client.avatarUrl, dataUrl }));
                    console.log("Avatar cached.");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    avatarLoadFailed = true;
                }
            }

            if (!userAvatarImg) {
                avatarLoadFailed = true;
                loadingStatus.textContent = 'Your avatar could not be loaded.';
                alert("Your avatar could not be loaded. Please try again or check your profile picture.");
            } else {
                loadingStatus.textContent = finalLoadingMessage;
            }
        } else {
            avatarLoadFailed = true;
            loadingStatus.textContent = 'No profile picture found.';
            alert("You don't seem to have a profile picture. Please set one to play.");
        }
    } catch (e) {
        avatarLoadFailed = true;
        console.error("Websim socket failed to initialize, cannot fetch avatar:", e);
        loadingStatus.textContent = 'Could not connect to get your profile.';
        alert("Could not connect to get your profile. Please refresh and try again.");
    }
    
    if (!avatarLoadFailed) {
        loadingStatus.textContent = "Loading game assets...";
        await new Promise((resolve) => {
            if (platformImg.complete) {
                resolve();
            } else {
                platformImg.onload = () => resolve();
                platformImg.onerror = () => resolve(); // continue even if it fails
            }
        });

        // give a small delay for user to read final message
        loadingStatus.textContent += ' Ready!';
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    uiState('start');
}

function main() {
    // The desktop UI is now set up before this function is even called.
    // Preload assets and then show start screen
    preload();
    requestAnimationFrame(gameLoop);
}

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

function imageToDataURL(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
}

function loadImageFromDataURL(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => {
            console.error("Failed to load image from data URL", err);
            // If it fails, clear the bad cache entry
            localStorage.removeItem(AVATAR_CACHE_KEY);
            reject(err);
        };
        img.src = dataUrl;
    });
}

async function loadImageWithProxies(url) {
    const proxies = [
        { name: 'Direct', url: '' },
        { name: 'CORS Proxy 1', url: 'https://api.allorigins.win/raw?url=' },
        { name: 'CORS Proxy 2', url: 'https://corsproxy.io/?' },
    ];

    for (const proxy of proxies) {
        const proxyUrl = proxy.url + url;
        try {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Always set for cross-origin images to prevent canvas tainting
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = proxyUrl;
            });
            console.log(`Successfully loaded image from: ${proxyUrl}`);
            return { image: img, source: proxy.name };
        } catch (error) {
            console.warn(`Failed to load image from: ${proxyUrl}`, error);
        }
    }
    return { image: null, source: 'failed' };
}

async function loadSound(url) {
    if (!audioCtx) return null;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        return audioBuffer;
    } catch (e) {
        console.error(`Failed to load sound: ${url}`, e);
        return null;
    }
}

function playSound(buffer) {
    if (!audioCtx || !buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
}

async function init() {
    if (avatarLoadFailed) {
        alert("Cannot start the game because your avatar failed to load. Please refresh the page.");
        return;
    }

    if (!userAvatarImg) {
        alert("Avatar not loaded yet. Please wait.");
        return;
    }

    // --- Initialize Physics Engine ---
    engine = Matter.Engine.create();
    engine.world.gravity.y = 1.2;
    engine.world.gravity.x = 0;
    
    // Logic for one-way platforms
    Matter.Events.on(engine, 'beforeUpdate', (event) => {
        if (!player || !platformManager) return;
        
        const playerBody = player.body;
        const playerBottom = playerBody.position.y + player.radius;

        platformManager.platforms.forEach(platform => {
            const platformTop = platform.body.position.y - platform.height / 2;
            
            // Player is moving down OR player is already above the platform
            // Make platform solid
            if (playerBody.velocity.y > 0 && playerBottom < platformTop + 5) {
                 platform.body.isSensor = false;
            } 
            // Player is moving up
            // Make platform passable
            else if (playerBody.velocity.y <= 0) {
                platform.body.isSensor = true;
            }
        });
    });

    // Custom collision handler for bounce sound
    Matter.Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            
            let playerBody, platformBody;

            if (pair.bodyA.label === 'player' && pair.bodyB.label === 'platform') {
                playerBody = pair.bodyA;
                platformBody = pair.bodyB;
            } else if (pair.bodyB.label === 'player' && pair.bodyA.label === 'platform') {
                playerBody = pair.bodyB;
                platformBody = pair.bodyA;
            } else {
                continue;
            }
            
            // Only play sound on downward collision
            if (playerBody.velocity.y > 1) { // Check for significant downward velocity
                 playSound(bounceSoundBuffer);
            }
        }
    });

    player = new Player(canvas.width / 2, canvas.height - 100, userAvatarImg, engine.world, { restitution });
    platformManager = new PlatformManager(canvas.width, canvas.height, platformImg, engine.world, { restitution });
    platformManager.generateInitialPlatforms();
    replay = new Replay();

    // Load sound on first init
    if (audioCtx && !bounceSoundBuffer) {
        bounceSoundBuffer = await loadSound('boing.mp3');
    }
    
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
    loadingScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreDisplay.classList.add('hidden');

    if (state === 'loading') {
        loadingScreen.classList.remove('hidden');
    } else if (state === 'start') {
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
    player.update(tilt, canvas.width, deltaTime);

    // Update engine
    Matter.Engine.update(engine, deltaTime * 1000); // Matter.js expects milliseconds

    // Camera follows player
    if (player.body.position.y < cameraY + canvas.height / 2.5) {
        cameraY = player.body.position.y - canvas.height / 2.5;
    }
    
    // Update score
    score = Math.max(score, Math.floor(-cameraY / 10));
    scoreEl.textContent = score;

    platformManager.update(cameraY, player.body.position.y);
    
    // Game over condition
    if (player.body.position.y > cameraY + canvas.height) {
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
    const playerFrame = frame.player;
    if (userAvatarImg && userAvatarImg.complete) {
        replayCtx.save();
        replayCtx.translate(playerFrame.x, playerFrame.y);
        replayCtx.rotate(playerFrame.angle);

        // Create circular clipping path
        replayCtx.beginPath();
        replayCtx.arc(0, 0, playerFrame.radius, 0, Math.PI * 2, true);
        replayCtx.closePath();
        replayCtx.clip();

        // Draw the image, centered
        replayCtx.drawImage(
            userAvatarImg,
            -playerFrame.radius,
            -playerFrame.radius,
            playerFrame.width,
            playerFrame.height
        );

        replayCtx.restore();
    }

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
    if (isDesktop) return; // Prevent desktop users from starting

    // Initialize AudioContext on user interaction
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

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

// --- Initial Setup ---

// Immediately setup for desktop or show loading for mobile
if (isDesktop) {
    setupDesktopUI();
    uiState('start');
    // We can just show the start screen and not run the game loop etc.
    // No need to call main() for desktop.
} else {
    // For mobile, start the main game loading process
    main();
}