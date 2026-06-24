// ==========================================
// SLEEP TIMER SYSTEM
// ==========================================
function showSleepTimerModal() {
    const modal = document.getElementById('sleep-timer-modal');
    if (modal) modal.style.display = 'flex';
    updateSleepTimerUI();
}

function closeSleepTimerModal() {
    const modal = document.getElementById('sleep-timer-modal');
    if (modal) modal.style.display = 'none';
}

function setSleepTimer(minutes) {
    cancelSleepTimer();
    sleepTimerEndTime = Date.now() + (minutes * 60 * 1000);
    
    sleepTimerId = setTimeout(() => {
        audioEl.pause();
        playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
        const _ippbSleep = getImmPlayPauseBtn();
        if(_ippbSleep) _ippbSleep.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
        showToast("Sleep timer ended. Good night!");
        cancelSleepTimer();
    }, minutes * 60 * 1000);

    sleepCountdownInterval = setInterval(() => {
        updateSleepCountdown();
    }, 1000);

    showToast(`Sleep timer set for ${minutes} minutes`);
    updateSleepTimerUI();
    
    const badge = document.getElementById('sleep-timer-badge');
    if (badge) badge.style.display = 'inline-flex';
}

function cancelSleepTimer() {
    if (sleepTimerId) clearTimeout(sleepTimerId);
    if (sleepCountdownInterval) clearInterval(sleepCountdownInterval);
    sleepTimerId = null;
    sleepTimerEndTime = null;
    sleepCountdownInterval = null;
    
    const badge = document.getElementById('sleep-timer-badge');
    if (badge) badge.style.display = 'none';
    updateSleepTimerUI();
}

function updateSleepTimerUI() {
    const optionsDiv = document.getElementById('sleep-timer-options');
    const activeDiv = document.getElementById('sleep-timer-active');
    if (!optionsDiv || !activeDiv) return;

    if (sleepTimerEndTime) {
        optionsDiv.style.display = 'none';
        activeDiv.style.display = 'block';
        updateSleepCountdown();
    } else {
        optionsDiv.style.display = 'grid';
        activeDiv.style.display = 'none';
    }
}

function updateSleepCountdown() {
    if (!sleepTimerEndTime) return;
    const remaining = Math.max(0, sleepTimerEndTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const text = document.getElementById('sleep-countdown-text');
    if (text) text.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ==========================================
// EQUALIZER SYSTEM
// ==========================================
function showEqualizer() {
    const modal = document.getElementById('equalizer-modal');
    if (modal) modal.style.display = 'flex';
    
    // Sync toggle states
    const toggle3d = document.getElementById('toggle-3d');
    const toggleHd = document.getElementById('toggle-hd');
    if (toggle3d) toggle3d.checked = is4DMode;
    if (toggleHd) toggleHd.checked = isHDMode;
}

function closeEqualizerModal() {
    const modal = document.getElementById('equalizer-modal');
    if (modal) modal.style.display = 'none';
}

function updateEQ() {
    const bassVal = parseInt(document.getElementById('eq-bass').value);
    const midVal = parseInt(document.getElementById('eq-mid').value);
    const trebleVal = parseInt(document.getElementById('eq-treble').value);

    document.getElementById('eq-bass-val').innerText = `${bassVal} dB`;
    document.getElementById('eq-mid-val').innerText = `${midVal} dB`;
    document.getElementById('eq-treble-val').innerText = `${trebleVal} dB`;

    if (!audioCtx) setupWebAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    if (bassNode) bassNode.gain.value = bassVal;
    if (midNode) midNode.gain.value = midVal;
    if (trebleNode) trebleNode.gain.value = trebleVal;
}

function setEQPreset(preset, btnEl) {
    document.querySelectorAll('.eq-preset').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const presets = {
        flat:   { bass: 0, mid: 0, treble: 0 },
        bass:   { bass: 8, mid: 2, treble: -2 },
        treble: { bass: -2, mid: 1, treble: 8 },
        vocal:  { bass: -3, mid: 6, treble: 3 },
        party:  { bass: 6, mid: 3, treble: 5 }
    };

    const p = presets[preset] || presets.flat;
    document.getElementById('eq-bass').value = p.bass;
    document.getElementById('eq-mid').value = p.mid;
    document.getElementById('eq-treble').value = p.treble;
    updateEQ();
    showToast(`EQ: ${preset.charAt(0).toUpperCase() + preset.slice(1)} preset`);
}

// ==========================================
// PLAYBACK SPEED CONTROL
// ==========================================
function cyclePlaybackSpeed() {
    const currentIdx = playbackSpeeds.indexOf(currentPlaybackSpeed);
    const nextIdx = (currentIdx + 1) % playbackSpeeds.length;
    currentPlaybackSpeed = playbackSpeeds[nextIdx];
    audioEl.playbackRate = currentPlaybackSpeed;
    
    const label = document.getElementById('speed-label');
    if (label) label.innerText = `${currentPlaybackSpeed}x`;
    showToast(`Speed: ${currentPlaybackSpeed}x`);
}

// ==========================================
// SHARE SONG FEATURE
// ==========================================
function showShareModal() {
    if (currentSongIndex === -1) { showToast("Play a song first!"); return; }
    const song = currentPlaylist[currentSongIndex];
    const modal = document.getElementById('share-modal');
    const preview = document.getElementById('share-song-preview');
    if (preview) {
        preview.innerHTML = `
            <img src="${song.image}" alt="${song.title}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;">
            <div style="flex:1;min-width:0;">
                <h4 style="color:#fff;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${song.title}</h4>
                <p style="color:var(--text-secondary);font-size:13px;">${song.artist}</p>
            </div>
        `;
    }
    if (modal) modal.style.display = 'flex';
}

function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) modal.style.display = 'none';
}

function shareSong(platform) {
    if (currentSongIndex === -1) return;
    const song = currentPlaylist[currentSongIndex];
    const text = `Listen to "${song.title}" by ${song.artist} on Sangeet PRO!`;
    const url = window.location.href;

    switch(platform) {
        case 'whatsapp':
            window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
            break;
        case 'twitter':
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
            break;
        case 'copy':
            navigator.clipboard.writeText(text + ' ' + url).then(() => {
                showToast('Link copied to clipboard!');
            }).catch(() => {
                showToast('Could not copy link');
            });
            break;
    }
    closeShareModal();
}

// ==========================================
// KEYBOARD SHORTCUTS MODAL
// ==========================================
function showKeyboardShortcuts() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.style.display = 'flex';
}

function closeShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.style.display = 'none';
}

// ==========================================
// USER PROFILE SYSTEM (Photo Upload + localStorage)
// ==========================================

const GOOGLE_PROFILE_STORAGE_KEY = 'proMusicGoogleProfile';
const DEFAULT_PROFILE_NAME = 'Music Lover';
const DEFAULT_TOPBAR_NAME = 'Guest';
const DEFAULT_PROFILE_IMAGE = 'https://i.pravatar.cc/100?img=11';
let googleAuthInitialized = false;
let googleButtonRendered = false;
let googleAuthRetryCount = 0;

function getGoogleClientId() {
    return String(window.SANGEET_GOOGLE_CLIENT_ID || '').trim();
}

function getStoredGoogleProfile() {
    try {
        return JSON.parse(memStorage.getItem(GOOGLE_PROFILE_STORAGE_KEY)) || null;
    } catch (e) {
        return null;
    }
}

function setStoredGoogleProfile(profile) {
    try {
        if (profile) {
            memStorage.setItem(GOOGLE_PROFILE_STORAGE_KEY, JSON.stringify(profile));
        } else {
            localStorage.removeItem(GOOGLE_PROFILE_STORAGE_KEY);
        }
    } catch (e) {
        console.warn('Could not update Google profile storage:', e);
    }
}

function decodeGoogleCredential(credential) {
    try {
        const payload = credential.split('.')[1];
        if (!payload) return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
        console.warn('Could not decode Google credential:', e);
        return null;
    }
}

function getEffectiveProfileState() {
    const googleProfile = getStoredGoogleProfile();
    const savedLocalName = memStorage.getItem('proMusicUserName');
    const localPhoto = memStorage.getItem('proMusicProfilePhoto') || DEFAULT_PROFILE_IMAGE;

    if (googleProfile) {
        return {
            isGoogleUser: true,
            name: googleProfile.name || googleProfile.email || DEFAULT_PROFILE_NAME,
            email: googleProfile.email || 'Signed in with Google',
            photo: googleProfile.picture || localPhoto,
            googleProfile
        };
    }

    return {
        isGoogleUser: false,
        name: savedLocalName || DEFAULT_PROFILE_NAME,
        topbarName: savedLocalName || DEFAULT_TOPBAR_NAME,
        email: 'Not signed in',
        photo: localPhoto,
        googleProfile: null
    };
}

function syncProfileUi() {
    const state = getEffectiveProfileState();
    const profileImg = document.getElementById('profile-img');
    const modalProfileImg = document.getElementById('modal-profile-img');
    const profileName = document.getElementById('profile-name');
    const modalName = document.getElementById('modal-profile-name');
    const profileEmail = document.getElementById('profile-auth-email');
    const authStatus = document.getElementById('profile-auth-status');
    const logoutBtn = document.getElementById('google-logout-btn');
    const nameEditBtn = document.querySelector('.profile-name-edit-btn');
    const uploadBtn = document.getElementById('profile-upload-btn');

    if (profileImg) {
        profileImg.src = state.photo;
        profileImg.classList.toggle('profile-uploaded', state.photo !== DEFAULT_PROFILE_IMAGE);
    }
    if (modalProfileImg) modalProfileImg.src = state.photo;
    if (profileName) profileName.innerText = state.topbarName || state.name;
    if (modalName) modalName.innerText = state.name;
    if (profileEmail) profileEmail.innerText = state.email;
    if (authStatus) {
        authStatus.innerText = state.isGoogleUser
            ? 'Signed in with Google'
            : (getGoogleClientId() ? 'Sign in with Google to sync your profile' : 'Google Client ID pending');
    }
    if (logoutBtn) logoutBtn.style.display = state.isGoogleUser ? 'inline-flex' : 'none';
    if (nameEditBtn) nameEditBtn.classList.toggle('hidden-action', state.isGoogleUser);
    if (uploadBtn) uploadBtn.classList.toggle('hidden-action', state.isGoogleUser);

    updateGoogleAuthUi();
}

function updateGoogleAuthUi() {
    const slot = document.getElementById('google-signin-slot');
    const isGoogleUser = !!getStoredGoogleProfile();
    const clientId = getGoogleClientId();

    if (!slot) return;

    if (isGoogleUser) {
        slot.style.display = 'none';
        return;
    }

    slot.style.display = 'flex';

    if (!clientId) {
        slot.innerHTML = '<div class="google-auth-note">Google login ready hai. Bas client ID paste karna baaki hai.</div>';
        return;
    }

    if (!window.google?.accounts?.id) {
        slot.innerHTML = '<div class="google-auth-note">Loading Google Sign-In...</div>';
        return;
    }

    if (!googleButtonRendered) {
        slot.innerHTML = '';
        window.google.accounts.id.renderButton(slot, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            width: 280
        });
        googleButtonRendered = true;
    }
}

function handleGoogleCredentialResponse(response) {
    const payload = decodeGoogleCredential(response?.credential || '');
    if (!payload) {
        showToast('Google login failed. Please try again.');
        return;
    }

    setStoredGoogleProfile({
        sub: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture
    });
    googleButtonRendered = false;
    syncProfileUi();
    showToast(`Welcome, ${payload.given_name || payload.name || 'there'}!`);
}

function initGoogleAuth(forceRender = false) {
    const clientId = getGoogleClientId();
    if (!clientId) {
        googleAuthInitialized = false;
        googleButtonRendered = false;
        syncProfileUi();
        return;
    }

    if (!window.google?.accounts?.id) {
        googleAuthRetryCount += 1;
        if (googleAuthRetryCount <= 20) {
            setTimeout(() => initGoogleAuth(forceRender), 400);
        } else {
            updateGoogleAuthUi();
        }
        return;
    }

    if (!googleAuthInitialized) {
        window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        googleAuthInitialized = true;
    }

    if (forceRender) {
        googleButtonRendered = false;
    }

    updateGoogleAuthUi();
}

function signOutGoogle() {
    const profile = getStoredGoogleProfile();
    if (!profile) return;

    const finishSignOut = () => {
        setStoredGoogleProfile(null);
        googleButtonRendered = false;
        if (window.google?.accounts?.id) {
            window.google.accounts.id.disableAutoSelect();
        }
        syncProfileUi();
        initGoogleAuth(true);
        showToast('Google account signed out');
    };

    if (window.google?.accounts?.id?.revoke && profile.email) {
        window.google.accounts.id.revoke(profile.email, finishSignOut);
        return;
    }

    finishSignOut();
}

// Load saved profile photo from localStorage on startup
function loadSavedProfilePhoto() {
    try {
        if (getStoredGoogleProfile()) {
            syncProfileUi();
            return;
        }
        const savedPhoto = memStorage.getItem('proMusicProfilePhoto');
        if (savedPhoto) {
            const profileImg = document.getElementById('profile-img');
            const modalProfileImg = document.getElementById('modal-profile-img');
            if (profileImg) {
                profileImg.src = savedPhoto;
                profileImg.classList.add('profile-uploaded');
            }
            if (modalProfileImg) modalProfileImg.src = savedPhoto;
        }
    } catch (e) {
        console.warn('Could not load saved profile photo:', e);
    }
}

// Handle profile photo upload via file input
function handleProfilePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file');
        return;
    }

    // Validate file size (max 2MB for localStorage)
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image too large. Please select an image under 2MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result;

        // Resize image to save localStorage space
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxSize = 200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);

            // Save to localStorage
            try {
                memStorage.setItem('proMusicProfilePhoto', resizedBase64);
            } catch (storageErr) {
                console.warn('Could not save profile photo to localStorage:', storageErr);
                showToast('Could not save photo - storage full');
                return;
            }

            // Update all profile image elements
            const profileImg = document.getElementById('profile-img');
            const modalProfileImg = document.getElementById('modal-profile-img');
            if (profileImg) {
                profileImg.src = resizedBase64;
                profileImg.classList.add('profile-uploaded');
            }
            if (modalProfileImg) modalProfileImg.src = resizedBase64;

            showToast('Profile photo updated!');
        };
        img.src = base64Data;
    };
    reader.readAsDataURL(file);
}

// Initialize profile photo upload button
function initProfilePhotoUpload() {
    const uploadBtn = document.getElementById('profile-upload-btn');
    const fileInput = document.getElementById('profile-photo-input');

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });

        fileInput.addEventListener('change', handleProfilePhotoUpload);
    }
}

function showProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    
    // Update stats
    const statLikes = document.getElementById('stat-likes');
    const statPlaylists = document.getElementById('stat-playlists');
    const statDownloads = document.getElementById('stat-downloads');
    
    if (statLikes) statLikes.innerText = likedSongs.length;
    if (statPlaylists) statPlaylists.innerText = Object.keys(userPlaylists).length;
    if (statDownloads) statDownloads.innerText = downloadedSongs.length;
    
    syncProfileUi();
    initGoogleAuth(true);
    modal.style.display = 'flex';
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.style.display = 'none';
}

function editProfileName() {
    if (getStoredGoogleProfile()) {
        showToast('Google sign-in active hai. Name Google account se aayega.');
        return;
    }
    const currentName = memStorage.getItem('proMusicUserName') || 'Music Lover';
    const newName = prompt('Enter your name:', currentName);
    if (newName && newName.trim()) {
        SmartEngine.batchedSetItem('proMusicUserName', newName.trim());
        syncProfileUi();
        showToast('Profile updated!');
    }
}

// ==========================================
// PARTICLES BACKGROUND SYSTEM (SmartEngine: adaptive particle count & FPS)
// ==========================================
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    // SmartEngine: Skip particles entirely on low-end devices with animations disabled
    if (!SmartEngine.settings.animationsEnabled) {
        canvas.style.display = 'none';
        return;
    }
    const ctx = canvas.getContext('2d');
    let particles = [];
    const maxParticles = SmartEngine.settings.particles; // SmartEngine: adaptive count
    const connDist = SmartEngine.settings.particleConnDist; // SmartEngine: 0 on low = no connections

    const resize = SmartEngine.throttle(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }, 250);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', resize);

    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.3 + 0.05
        };
    }

    for (let i = 0; i < maxParticles; i++) {
        particles.push(createParticle());
    }

    // SmartEngine: frame-budget-aware animation loop
    let _particleFrameSkip = 0;
    const _particleFrameInterval = SmartEngine.qualityTier === 'high' ? 1 : (SmartEngine.qualityTier === 'medium' ? 2 : 4);
    function animate() {
        requestAnimationFrame(animate);
        // SmartEngine: skip frames on lower tiers to save CPU
        _particleFrameSkip++;
        if (_particleFrameSkip % _particleFrameInterval !== 0) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(29, 185, 84, ${p.opacity})`;
            ctx.fill();
        });

        // SmartEngine: Skip connections entirely when connDist is 0 (low tier)
        if (connDist > 0) {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < connDist) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(29, 185, 84, ${0.08 * (1 - dist / connDist)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
        }
    }
    animate();
}

// ==========================================
// SIDEBAR MINI PLAYER
// ==========================================
function updateSidebarMiniPlayer() {
    if (currentSongIndex === -1 || currentPlaylist.length === 0) return;
    const song = currentPlaylist[currentSongIndex];
    const miniPlayer = document.getElementById('sidebar-mini-player');
    const sidebarImg = document.getElementById('sidebar-np-img');
    const sidebarTitle = document.getElementById('sidebar-np-title');
    const sidebarArtist = document.getElementById('sidebar-np-artist');
    
    if (miniPlayer) miniPlayer.style.display = 'flex';
    if (sidebarImg) sidebarImg.src = song.image;
    if (sidebarTitle) sidebarTitle.innerText = song.title;
    if (sidebarArtist) sidebarArtist.innerText = song.artist;
}

// ==========================================
// LIKED COUNT BADGE
// ==========================================
function updateLikedBadge() {
    const badge = document.getElementById('liked-count-badge');
    if (badge) badge.innerText = likedSongs.length;
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // SmartEngine: Initialize lazy image observer
    SmartEngine.initImageObserver();
    
    // SmartEngine: Start FPS monitoring (auto-downgrades quality if <20 FPS)
    setInterval(SmartEngine.updateFPS, 2000);
    
    // SmartEngine: Flush batched writes on page hide (critical for mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') SmartEngine.emergencyFlush();
    });
    window.addEventListener('pagehide', SmartEngine.emergencyFlush);
    
    // SmartEngine: Passive touch listeners for smooth mobile scrolling
    const scrollContainers = document.querySelectorAll('.scrollable-row, .queue-list, #results');
    scrollContainers.forEach(el => {
        SmartEngine.addPassiveListener(el, 'touchstart', () => {});
        SmartEngine.addPassiveListener(el, 'touchmove', () => {});
    });
    
    // SmartEngine: Log quality tier for debugging
    console.log(`[SmartEngine] Quality: ${SmartEngine.qualityTier} | Mobile: ${SmartEngine.isMobile} | RAM: ${SmartEngine.deviceMemory}GB | Cores: ${SmartEngine.hardwareConcurrency}`);
    
    initParticles();
    updateLikedBadge();
    
    // Load saved profile name
    const savedName = memStorage.getItem('proMusicUserName');
    if (savedName) {
        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.innerText = savedName;
    }

    // ==========================================
    // PROFILE SYSTEM INITIALIZATION
    // ==========================================
    loadSavedProfilePhoto();
    initProfilePhotoUpload();
    syncProfileUi();
    initGoogleAuth();

    // ==========================================
    // SEARCH INPUT EVENT LISTENERS
    // ==========================================
    const songInputEl = document.getElementById('songInput');
    if (songInputEl) {
        songInputEl.addEventListener('keyup', handleKeyPress);
        songInputEl.addEventListener('input', handleSearchInput);
        songInputEl.addEventListener('focus', function() {
            renderSearchHistory();
            document.getElementById('search-history-dropdown').classList.add('active');
        });
        songInputEl.addEventListener('blur', hideSearchHistory);
    }
});

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});
