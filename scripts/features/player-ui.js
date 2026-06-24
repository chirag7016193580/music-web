function updateQueueUI() {
    queueList.innerHTML = "";
    const immersiveQueueList = document.getElementById('immersive-queue-list');
    if (immersiveQueueList) immersiveQueueList.innerHTML = "";

    if(currentPlaylist.length === 0) {
        queueList.innerHTML = "<p style='color:gray; font-size:14px;'>Queue is empty.</p>"; 
        if(immersiveQueueList) immersiveQueueList.innerHTML = "<p style='color:gray; font-size:14px;'>Queue is empty.</p>";
        return;
    }
    // SmartEngine: Use DocumentFragment for batch DOM insertion (avoids reflow per item)
    const frag = document.createDocumentFragment();
    const immFrag = immersiveQueueList ? document.createDocumentFragment() : null;
    
    currentPlaylist.forEach((song, index) => {
        let div = document.createElement('div');
        div.className = `queue-item ${index === currentSongIndex ? 'active-queue' : ''}`;
        div.onclick = () => { playSongByIndex(index); };
        
        // SmartEngine: optimize image URL based on quality tier
        const imgUrl = SmartEngine.optimizeImageUrl(song.image);
        div.innerHTML = `
            <img src="${imgUrl}" loading="lazy" onerror="this.src='https://via.placeholder.com/40'">
            <div class="queue-item-info">
                <h4 style="color: ${index === currentSongIndex ? 'var(--primary-color)' : '#fff'}">${song.title}</h4>
                <p>${song.artist}</p>
            </div>
            ${index === currentSongIndex ? '<i class="fas fa-volume-up" style="margin-left:auto; color: var(--primary-color); font-size: 14px;"></i>' : ''}
        `;
        frag.appendChild(div);

        // Immersive queue (Right side PC view)
        if(immFrag) {
            let imDiv = document.createElement('div');
            imDiv.className = `queue-item ${index === currentSongIndex ? 'active-queue' : ''}`;
            imDiv.style.background = index === currentSongIndex ? 'rgba(29, 185, 84, 0.2)' : 'transparent';
            imDiv.onclick = () => { playSongByIndex(index); };
            imDiv.innerHTML = div.innerHTML;
            immFrag.appendChild(imDiv);
        }
    });
    // SmartEngine: Single DOM write instead of N writes
    queueList.appendChild(frag);
    if(immersiveQueueList && immFrag) immersiveQueueList.appendChild(immFrag);
    
    const activeQueueItem = queueList.querySelector('.active-queue');
    if(activeQueueItem) activeQueueItem.scrollIntoView({ behavior: "smooth", block: "center" });

    const activeImmersiveQueueItem = immersiveQueueList?.querySelector('.active-queue');
    if(activeImmersiveQueueItem) activeImmersiveQueueItem.scrollIntoView({ behavior: "smooth", block: "center" });
}

function handleVolumeChange() { setVolume(volumeBar.value / 100); }

function setVolume(val) {
    if(val > 1) val = 1; if(val < 0) val = 0;
    audioEl.volume = val;
    volumeBar.value = val * 100;
    volFill.style.width = `${val * 100}%`;
    
    if (val === 0) volIcon.className = "fas fa-volume-mute";
    else if (val < 0.5) volIcon.className = "fas fa-volume-down";
    else volIcon.className = "fas fa-volume-up";
}

function toggleMute() {
    if (audioEl.volume > 0) { preMuteVolume = audioEl.volume; setVolume(0); } 
    else { setVolume(preMuteVolume > 0 ? preMuteVolume : 1); }
}

function seekAudio() {
    if(isNaN(audioEl.duration)) return;
    audioEl.currentTime = (progressBar.value / 100) * audioEl.duration;
}

function seekAudioImm() {
    if(isNaN(audioEl.duration)) return;
    const immProgressBar = document.getElementById('imm-progress-bar');
    if(immProgressBar) {
        audioEl.currentTime = (immProgressBar.value / 100) * audioEl.duration;
    }
}

// SmartEngine: Cache DOM refs for timeupdate to avoid repeated lookups
let _cachedImmProgressBar = null;
let _cachedImmFill = null;
let _cachedImmThumb = null;
let _cachedImmCurTime = null;
let _cachedImmTotalTime = null;
let _cachedCurTime = null;
let _cachedTotalTime = null;
let _timeupdateDomCached = false;
function _cacheTimeupdateDom() {
    _cachedCurTime = document.getElementById('current-time');
    _cachedTotalTime = document.getElementById('total-time');
    _cachedImmProgressBar = document.getElementById('imm-progress-bar');
    _cachedImmFill = document.getElementById('imm-progress-fill');
    _cachedImmThumb = document.getElementById('imm-progress-thumb');
    _cachedImmCurTime = document.getElementById('imm-current-time');
    _cachedImmTotalTime = document.getElementById('imm-total-time');
    _timeupdateDomCached = true;
}

// SmartEngine: Throttled timeupdate (avoids layout thrashing on every frame)
let _lastTimeUpdateSec = -1;
audioEl.addEventListener('timeupdate', () => {
    if(isNaN(audioEl.duration)) return;
    if(!_timeupdateDomCached) _cacheTimeupdateDom();
    
    const curSec = Math.floor(audioEl.currentTime);
    // Only update DOM once per second (huge perf win on mobile)
    if (curSec === _lastTimeUpdateSec) return;
    _lastTimeUpdateSec = curSec;
    
    const percent = (audioEl.currentTime / audioEl.duration) * 100;
    
    // Desktop Progress Bar Sync
    progressBar.value = percent;
    progressFill.style.width = `${percent}%`;
    progressThumb.style.left = `${percent}%`;
    if(_cachedCurTime) _cachedCurTime.innerText = formatTime(audioEl.currentTime);
    if(_cachedTotalTime) _cachedTotalTime.innerText = formatTime(audioEl.duration);

    // Mobile Immersive Progress Bar Sync
    if(_cachedImmProgressBar) {
        _cachedImmProgressBar.value = percent;
        if(_cachedImmFill) _cachedImmFill.style.width = `${percent}%`;
        if(_cachedImmThumb) _cachedImmThumb.style.left = `${percent}%`;
        if(_cachedImmCurTime) _cachedImmCurTime.innerText = formatTime(audioEl.currentTime);
        if(_cachedImmTotalTime) _cachedImmTotalTime.innerText = formatTime(audioEl.duration);
    }

    // SmartEngine: Throttled save (already throttled via saveCurrentState)
    saveCurrentState();
});

// --- MOBILE SWIPE GESTURES ---
let touchstartX = 0;
let touchstartY = 0;

// Mini Player Swipe
const bottomPlayerArea = document.getElementById('bottom-player-area');
bottomPlayerArea.addEventListener('touchstart', e => { 
    touchstartX = e.changedTouches[0].screenX; 
    touchstartY = e.changedTouches[0].screenY;
}, { passive: true });
bottomPlayerArea.addEventListener('touchend', e => {
    let touchendX = e.changedTouches[0].screenX;
    let touchendY = e.changedTouches[0].screenY;
    let diffX = touchstartX - touchendX;
    let diffY = touchstartY - touchendY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Swipe Left/Right
        if (diffX > 60) nextSong(); 
        if (diffX < -60) prevSong(); 
    } else {
        // Swipe Up
        if (diffY > 40 && !immersivePlayer.classList.contains('open')) {
            toggleImmersivePlayer();
        }
    }
});

// Immersive Player Swipe Down
let immTouchY = 0;
immersivePlayer.addEventListener('touchstart', e => { 
    immTouchY = e.changedTouches[0].screenY; 
}, { passive: true });
immersivePlayer.addEventListener('touchend', e => {
    if(e.changedTouches[0].screenY - immTouchY > 80) {
        if (immersivePlayer.classList.contains('open')) toggleImmersivePlayer();
    }
});

function formatTime(seconds) {
    let mins = Math.floor(seconds / 60);
    let secs = Math.floor(seconds % 60);
    if(secs < 10) secs = "0" + secs;
    return `${mins}:${secs}`;
}

function showToast(message) {
    const toastIcon = toastEl.querySelector('.toast-icon');
    const toastText = toastEl.querySelector('.toast-text');
    if (toastText) {
        toastText.innerText = message;
    } else {
        toastEl.innerText = message;
    }
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function setActive(element) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
}

document.addEventListener('keydown', (e) => {
    if (document.activeElement.id === 'songInput' || document.activeElement.id === 'new-playlist-name') return;
    switch(e.code) {
        case 'Space': e.preventDefault(); togglePlay(); break;
        case 'ArrowRight': e.preventDefault(); nextSong(); break;
        case 'ArrowLeft': e.preventDefault(); prevSong(); break;
        case 'ArrowUp': e.preventDefault(); setVolume(audioEl.volume + 0.1); break;
        case 'ArrowDown': e.preventDefault(); setVolume(audioEl.volume - 0.1); break;
        case 'KeyM': e.preventDefault(); toggleMute(); break;
        case 'KeyS': e.preventDefault(); toggleShuffle(); break;
        case 'KeyR': e.preventDefault(); toggleRepeat(); break;
        case 'KeyF': e.preventDefault(); toggleImmersivePlayer(); break;
        case 'KeyL': e.preventDefault(); toggleLike(); break;
        case 'KeyQ': e.preventDefault(); toggleQueue(); break;
    }
});

