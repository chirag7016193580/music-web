// ==========================================
// DEVICE INITIALIZATION & MEMORY STORAGE
// ==========================================
const DEVICE_INIT_KEY = 'sangeet_device_initialized_v3';

// Using actual browser localStorage for permanent APK storage
const memStorage = {
    getItem(key) {
        try { return localStorage.getItem(key); }
        catch(e) { return null; }
    },
    setItem(key, val) {
        try { localStorage.setItem(key, String(val)); }
        catch(e) { console.warn('LocalStorage not available', e); }
    },
    clear() {
        try {
            localStorage.removeItem('proMusicLikedSongs');
            localStorage.removeItem('proMusicSearchHistory');
            localStorage.removeItem('proMusicPlayHistory');
            localStorage.removeItem('proMusicUserPlaylists');
            localStorage.removeItem('proMusicDownloadedSongs');
            localStorage.removeItem('proMusicLastState');
            localStorage.removeItem('proMusicProfilePhoto');
            localStorage.removeItem('proMusicUserName');
            localStorage.removeItem('proMusicGoogleProfile');
            localStorage.removeItem('proMusicRecHistory');
            // We purposefully DO NOT remove DEVICE_INIT_KEY here during normal clears 
            // so it doesn't reset the "new device" logic again unnecessarily.
        } catch(e) {}
    }
};

// 1. Agar naya device/APK install hai toh pehle ka garbage delete karke fresh start karo
// Ye sirf ek baar run hoga zindagi mein per device.
if (!memStorage.getItem(DEVICE_INIT_KEY)) {
    memStorage.clear();
    memStorage.setItem(DEVICE_INIT_KEY, 'true');
    console.log("New Device/APK Detected: App Data Reset to Fresh State.");
    setTimeout(() => { showToast("Welcome to Sangeet PRO!"); }, 1500);
}

// 2. Main Local Storage Variables (Jab user use kare toh data hamesha phone me save rahe)
let currentPlaylist = []; 
let currentSongIndex = -1;
let likedSongs = JSON.parse(memStorage.getItem('proMusicLikedSongs')) || [];
let searchHistory = JSON.parse(memStorage.getItem('proMusicSearchHistory')) || [];
let playHistory = JSON.parse(memStorage.getItem('proMusicPlayHistory')) || {};
let userPlaylists = JSON.parse(memStorage.getItem('proMusicUserPlaylists')) || {};
let downloadedSongs = JSON.parse(memStorage.getItem('proMusicDownloadedSongs')) || [];

// Manual App Reset Functions (Custom Modal Version)
function resetAppData() {
    document.getElementById('reset-modal').style.display = 'flex';
}

function closeResetModal() {
    document.getElementById('reset-modal').style.display = 'none';
}

function confirmResetData() {
    closeResetModal();
    memStorage.clear();
    showToast("App reset successful! Restarting... 🔄");
    setTimeout(() => {
        location.reload();
    }, 1500);
}

// ==========================================
// CORE UI & PLAYER VARIABLES
// ==========================================
const apiKey = ""; // Gemini API Key injected by environment
const audioEl = document.getElementById('global-audio');
const playPauseBtn = document.getElementById('play-pause-btn');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const progressThumb = document.getElementById('progress-thumb');
const volumeBar = document.getElementById('volume-bar');
const volFill = document.getElementById('vol-fill');
const volIcon = document.getElementById('vol-icon');
const likeBtn = document.getElementById('like-btn');
const toastEl = document.getElementById('toast');
const queuePanel = document.getElementById('queue-panel');
const queueList = document.getElementById('queue-list');
const immersivePlayer = document.getElementById('immersive-player');
const mode4dBtn = document.getElementById('mode-4d-btn');

// Performance: Cache frequently accessed DOM elements to avoid repeated lookups
let _cachedImmPlayPauseBtn = null;
function getImmPlayPauseBtn() {
    if (!_cachedImmPlayPauseBtn) _cachedImmPlayPauseBtn = document.getElementById('imm-play-pause-btn');
    return _cachedImmPlayPauseBtn;
}

// ENGINE OPTIMIZATION: LRU cache for API requests (auto-evicts old entries on mobile)
const apiCache = new SmartEngine.LRUCache(SmartEngine.settings.cacheMax);

let isShuffle = false;
let repeatMode = 0; 
let preMuteVolume = 1;
let isQueueOpen = false;

let is4DMode = false;
let isHDMode = false;
let audioCtx, track, panner, fourDFilter, trebleNode, bassNode, panInterval, convolver, dryGain, wetGain;
let analyser, visualizerDataArray, visualizerBufferLength, visualizerAnimationId;
let midNode; // EQ mid band node

// PWA Install Variable
let deferredPrompt;

// Sleep Timer Variables
let sleepTimerId = null;
let sleepTimerEndTime = null;
let sleepCountdownInterval = null;

// Playback Speed
let currentPlaybackSpeed = 1.0;
const playbackSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const loaderHTML = `<div class="loader" style="margin: 50px auto;"></div>`;

// ==========================================
// PWA INSTALLATION SETUP
// ==========================================

const manifestData = {
    "name": "Sangeet PRO Music",
    "short_name": "Sangeet",
    "start_url": ".",
    "display": "standalone",
    "background_color": "#000000",
    "theme_color": "#1db954",
    "icons": [
        {
            "src": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/500px-Spotify_logo_without_text.svg.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/500px-Spotify_logo_without_text.svg.png",
            "sizes": "512x512",
            "type": "image/png"
        }
    ]
};
const manifestString = JSON.stringify(manifestData);
const manifestBlob = new Blob([manifestString], {type: 'application/json'});
const manifestURL = URL.createObjectURL(manifestBlob);
document.getElementById('manifest-placeholder').setAttribute('href', manifestURL);

if ('serviceWorker' in navigator) {
    const swCode = `
        self.addEventListener('install', (e) => { self.skipWaiting(); });
        self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
        self.addEventListener('fetch', (e) => { }); 
    `;
    const swBlob = new Blob([swCode], {type: 'application/javascript'});
    const swUrl = URL.createObjectURL(swBlob);
    
    navigator.serviceWorker.register(swUrl).then(registration => {
        console.log('ServiceWorker registered successfully');
    }).catch(err => {
        console.log('ServiceWorker registration failed: ', err);
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('install-btn');
    if(installBtn) {
        installBtn.style.display = 'block';
    }
});

function installPWA() {
    document.getElementById('install-modal').style.display = 'flex';
}

function closeInstallModal() {
    document.getElementById('install-modal').style.display = 'none';
}

async function confirmInstall() {
    document.getElementById('install-modal').style.display = 'none';
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
            document.getElementById('install-btn').style.display = 'none';
        }
        deferredPrompt = null;
    } else {
        showToast("The install option is available in your browser menu (3 dots) as 'Add to Home Screen' or 'Install app'.");
    }
}

window.addEventListener('appinstalled', (evt) => {
    const installBtn = document.getElementById('install-btn');
    if(installBtn) installBtn.style.display = 'none';
    showToast("Sangeet installed successfully!");
});

// ==========================================

// Utility function to shuffle an array
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    if (window.innerWidth > 768) return;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    sidebar.classList.toggle('active');
    overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
}

// JS for Scroll Buttons (SmartEngine optimized)
function scrollRow(btnElement, direction) {
    const container = btnElement.parentElement.querySelector('.scrollable-row');
    if(container) {
        SmartEngine.smoothScrollRow(container, direction);
    }
}

