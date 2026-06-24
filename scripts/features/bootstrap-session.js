// FAST LOAD & RESTORE STATE (Fixed Mobile Start Issue)
document.addEventListener('DOMContentLoaded', () => {
    // Restore message for returning users
    const lastStateStr = memStorage.getItem('proMusicLastState');
    if (lastStateStr || likedSongs.length > 0) {
        setTimeout(() => { showToast("Aapka data load ho gaya hai 🔄"); }, 1500);
    }

    renderPills(); 
    loadHome(); // Turant homepage songs load karo   
    setVolume(1.0); 

    // Resuming from local storage instantly
    if (lastStateStr) {
        try {
            const lastState = JSON.parse(lastStateStr);
            if(lastState && lastState.playlist && lastState.playlist.length > 0 && lastState.index >= 0) {
                currentPlaylist = lastState.playlist;
                currentSongIndex = lastState.index;
                const song = currentPlaylist[currentSongIndex];

                document.getElementById('np-title').innerText = song.title;
                document.getElementById('np-artist').innerText = song.artist;
                document.getElementById('np-img').src = song.image;
                document.getElementById('np-img').style.display = "block";
                
                document.getElementById('bg-blur').style.backgroundImage = `url('${song.image}')`;
                
                likeBtn.style.display = "block";
                
                const isDownloaded = downloadedSongs.some(s => s.audioUrl === song.audioUrl);
                if(document.getElementById('download-btn')) {
                   document.getElementById('download-btn').style.display = "block";
                   document.getElementById('download-btn').classList.toggle('active', isDownloaded);
                }
                if(document.getElementById('imm-download-btn')) {
                    document.getElementById('imm-download-btn').classList.toggle('active', isDownloaded);
                }

                if(document.getElementById('add-pl-btn')) {
                    document.getElementById('add-pl-btn').style.display = "block";
                }

                const isLiked = likedSongs.some(s => s.title === song.title && s.artist === song.artist);
                likeBtn.classList.toggle('active', isLiked);
                
                const immLikeBtns = document.querySelectorAll('.immersive-song-info .action-btn .fa-heart');
                immLikeBtns.forEach(icon => {
                    if(isLiked) icon.parentElement.classList.add('active');
                    else icon.parentElement.classList.remove('active');
                });

                const is4DReady = check4DAvailability(song);
                mode4dBtn.style.display = is4DReady ? 'inline-block' : 'none';

                audioEl.crossOrigin = "anonymous";
                audioEl.src = song.audioUrl;
                
                // Set the last played time precisely
                if (lastState.currentTime) {
                    audioEl.currentTime = lastState.currentTime;
                    // Pre-fill the progress bar visually
                    if(lastState.duration && lastState.duration > 0) {
                        const percent = (lastState.currentTime / lastState.duration) * 100;
                        progressBar.value = percent;
                        progressFill.style.width = `${percent}%`;
                        progressThumb.style.left = `${percent}%`;
                        document.getElementById('current-time').innerText = formatTime(lastState.currentTime);
                    }
                }
                
                updateQueueUI();
                updateMediaSession(song);
                
                // Note: Auto-play is often blocked by mobile browsers/WebViews until user taps 'Play'
                // So we leave it paused intentionally, ready to play exactly from where they left off.
                playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                const _ippbRestore = getImmPlayPauseBtn();
                if(_ippbRestore) _ippbRestore.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
            }
        } catch(e) {}
    }
});

// Save current state helper (SmartEngine: throttled to avoid jank)
const _saveCurrentStateCore = function() {
    if (currentPlaylist.length > 0 && currentSongIndex >= 0 && !isNaN(audioEl.currentTime)) {
        const state = {
            playlist: currentPlaylist,
            index: currentSongIndex,
            currentTime: audioEl.currentTime,
            duration: audioEl.duration || 0
        };
        SmartEngine.batchedSetItem('proMusicLastState', JSON.stringify(state));
    }
};
const saveCurrentState = SmartEngine.throttle(_saveCurrentStateCore, SmartEngine.settings.saveInterval);
// Emergency save (direct write for page close)
function saveCurrentStateImmediate() {
    if (currentPlaylist.length > 0 && currentSongIndex >= 0 && !isNaN(audioEl.currentTime)) {
        const state = {
            playlist: currentPlaylist,
            index: currentSongIndex,
            currentTime: audioEl.currentTime,
            duration: audioEl.duration || 0
        };
        try { localStorage.setItem('proMusicLastState', JSON.stringify(state)); } catch(e) {}
    }
}

// Multiple event listeners to ensure state is saved (SmartEngine: uses immediate save on exit)
window.addEventListener('beforeunload', saveCurrentStateImmediate);
window.addEventListener('pagehide', saveCurrentStateImmediate);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveCurrentStateImmediate();
});

// --- BACK BUTTON HANDLER (Prevent app from closing while music plays) ---
// Push an initial state so we have history to go back to
if (!window.history.state || !window.history.state.sangeetApp) {
    window.history.pushState({ sangeetApp: true, page: 'home' }, '');
}

window.addEventListener('popstate', function(e) {
    // If music is currently playing, don't let the app close
    if (audioEl && !audioEl.paused) {
        // Re-push state to prevent going back further
        window.history.pushState({ sangeetApp: true, page: 'playing' }, '');
        
        // Check if immersive player is open - close it first
        const immersivePlayer = document.getElementById('immersive-player');
        if (immersivePlayer && immersivePlayer.classList.contains('active')) {
            toggleImmersivePlayer();
            return;
        }
        
        // Check if sidebar is open on mobile - close it
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleMobileMenu();
            return;
        }
        
        // Check if any modal is open - close it
        const openModal = document.querySelector('.modal-overlay[style*="flex"]');
        if (openModal) {
            openModal.style.display = 'none';
            return;
        }
        
        // Check if queue panel is open - close it
        const queuePanel = document.getElementById('queue-panel');
        if (queuePanel && queuePanel.classList.contains('active')) {
            toggleQueue();
            return;
        }
        
        // Music is playing but nothing to close - show mini toast
        showToast('Music chal raha hai! Band karne ke liye pause karo');
    } else {
        // Music is not playing - allow normal back behavior
        // But still push state so app doesn't close immediately
        window.history.pushState({ sangeetApp: true, page: 'idle' }, '');
        
        // If we're on a sub-page, go back to home
        const resultsDiv = document.getElementById('results');
        if (resultsDiv && resultsDiv.innerHTML.trim() !== '' && !resultsDiv.innerHTML.includes('Welcome')) {
            loadHome();
            return;
        }
    }
});

// Keep audio alive when app goes to background (mobile minimize)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && audioEl && !audioEl.paused) {
        // Update media session to keep notification visible
        if ('mediaSession' in navigator && currentSongIndex >= 0 && currentPlaylist[currentSongIndex]) {
            navigator.mediaSession.playbackState = 'playing';
            updateMediaPositionState();
        }
    }
    if (document.visibilityState === 'visible' && audioEl && !audioEl.paused) {
        // Sync UI when coming back to foreground
        playPauseBtn.innerHTML = "<i class='fas fa-pause'></i>";
        const _ippbVis = getImmPlayPauseBtn();
        if(_ippbVis) {
            _ippbVis.innerHTML = "<i class='fas fa-pause'></i>";
        }
        updateMediaPositionState();
    }
});

// Prevent app from being killed - use Wake Lock API if available
let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                // Re-acquire if music is still playing
                if (audioEl && !audioEl.paused) {
                    requestWakeLock();
                }
            });
        }
    } catch(e) { /* Wake Lock not supported or failed */ }
}
function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

// --- AUDIO URL EXTRACTOR ---
function extractBestAudioUrl(track) {
    if (!track) return null;
    
    const possibleKeys = ['downloadUrl', 'audioUrl', 'media_url', 'url', 'link', 'audio', 'songUrl', 'download_links', 'high'];
    for (let key of possibleKeys) {
        let val = track[key];
        if (!val) continue;
        
        if (Array.isArray(val) && val.length > 0) {
            let best = val[val.length - 1];
            let link = best.link || best.url || (typeof best === 'string' ? best : null);
            if (link && link.startsWith('http')) return link;
        } else if (typeof val === 'object') {
            let link = val.link || val.url || val.high;
            if (link && link.startsWith('http')) return link;
        } else if (typeof val === 'string' && val.startsWith('http')) {
            return val;
        }
    }
    
    let foundLink = null;
    JSON.stringify(track, (k, v) => {
        if (typeof v === 'string' && v.startsWith('http') && 
           (v.includes('.mp4') || v.includes('.m4a') || v.includes('.mp3') || v.includes('audiocdn') || v.includes('audio'))) {
            foundLink = v;
        }
        return v;
    });
    return foundLink;
}

