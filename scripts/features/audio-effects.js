function createReverbBuffer(ctx) {
    let length = ctx.sampleRate * 1.5; 
    let impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let i = 0; i < length; i++) {
        let n = length - i;
        let decay = Math.pow(n / length, 4); 
        impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * decay;
        impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * decay;
    }
    return impulse;
}

function setupWebAudio() {
    try {
        if(audioCtx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        track = audioCtx.createMediaElementSource(audioEl);
        
        // Set up Analyser for Audio Visualizer
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        visualizerBufferLength = analyser.frequencyBinCount;
        visualizerDataArray = new Uint8Array(visualizerBufferLength);

        trebleNode = audioCtx.createBiquadFilter();
        trebleNode.type = "highshelf";
        trebleNode.frequency.value = 4000;
        trebleNode.gain.value = isHDMode ? 6 : 0; 

        midNode = audioCtx.createBiquadFilter();
        midNode.type = "peaking";
        midNode.frequency.value = 1000;
        midNode.Q.value = 1;
        midNode.gain.value = 0;

        bassNode = audioCtx.createBiquadFilter();
        bassNode.type = "lowshelf";
        bassNode.frequency.value = 100;
        bassNode.gain.value = isHDMode ? 5 : 0; 

        fourDFilter = audioCtx.createBiquadFilter();
        fourDFilter.type = "lowpass";
        fourDFilter.frequency.value = is4DMode ? 14000 : 20000; 

        panner = audioCtx.createStereoPanner();
        
        convolver = audioCtx.createConvolver();
        convolver.buffer = createReverbBuffer(audioCtx);

        dryGain = audioCtx.createGain();
        wetGain = audioCtx.createGain();
        
        dryGain.gain.value = 1; 
        wetGain.gain.value = is4DMode ? 0.35 : 0; 

        // Connect nodes: Track -> Analyser -> Filters -> Speakers
        track.connect(analyser).connect(trebleNode).connect(midNode).connect(bassNode).connect(fourDFilter).connect(panner);
        
        panner.connect(dryGain).connect(audioCtx.destination);
        panner.connect(convolver).connect(wetGain).connect(audioCtx.destination);
        
        // Start the visualizer loop
        drawVisualizer();
    } catch (err) {
        console.warn("Web Audio API CORS Error", err);
    }
}

// Live Audio Visualizer Drawing Loop (SmartEngine: frame-budget aware)
let _vizFrameSkip = 0;
let _vizCanvas = null;
let _vizCtx = null;
const _vizFrameInterval = SmartEngine.qualityTier === 'high' ? 1 : (SmartEngine.qualityTier === 'medium' ? 2 : 4);
function drawVisualizer() {
    visualizerAnimationId = requestAnimationFrame(drawVisualizer);
    
    // SmartEngine: skip frames on lower quality tiers
    _vizFrameSkip++;
    if (_vizFrameSkip % _vizFrameInterval !== 0) return;
    
    if(!analyser) return;
    // SmartEngine: cache canvas ref
    if(!_vizCanvas) _vizCanvas = document.getElementById('audio-visualizer');
    if(!_vizCanvas) return;
    if(!_vizCtx) _vizCtx = _vizCanvas.getContext('2d');
    
    // Match canvas internal resolution to display size
    _vizCanvas.width = _vizCanvas.offsetWidth;
    _vizCanvas.height = _vizCanvas.offsetHeight;
    
    analyser.getByteFrequencyData(visualizerDataArray);
    _vizCtx.clearRect(0, 0, _vizCanvas.width, _vizCanvas.height);
    
    const barWidth = (_vizCanvas.width / visualizerBufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    for(let i = 0; i < visualizerBufferLength; i++) {
        barHeight = visualizerDataArray[i];
        
        let r = barHeight + (25 * (i/visualizerBufferLength));
        let g = 255;
        let b = 100;
        
        _vizCtx.fillStyle = `rgb(${r},${g},${b})`;
        _vizCtx.fillRect(x, _vizCanvas.height - barHeight + 50, barWidth, barHeight);
        
        x += barWidth + 1;
    }
}

function toggleHDMode() {
    isHDMode = !isHDMode;
    const btn = document.getElementById('mode-hd-btn');
    if(isHDMode) {
        btn.classList.add('active');
        showToast("HD Clear Audio On ✨");
        setupWebAudio();
        if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        if(trebleNode) trebleNode.gain.value = 6;
        if(bassNode) bassNode.gain.value = 5;
    } else {
        btn.classList.remove('active');
        showToast("HD Audio Off");
        if(trebleNode) trebleNode.gain.value = 0;
        if(bassNode) bassNode.gain.value = 0;
    }
}

function toggle4DMode() {
    is4DMode = !is4DMode;
    if(is4DMode) {
        mode4dBtn.classList.add('active');
        showToast("4D Clear Mode On 🎧 (360 Sound)");
        setupWebAudio();
        if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        
        if(fourDFilter) fourDFilter.frequency.value = 14000; 
        if(wetGain) wetGain.gain.value = 0.35; 
        if(dryGain) dryGain.gain.value = 1.0; 

        let startTime = audioCtx.currentTime;
        let speed = 0.5; 
        clearInterval(panInterval);
        if(is4DMode) { 
            panInterval = setInterval(() => {
                let elapsed = audioCtx.currentTime - startTime;
                if(panner) panner.pan.value = Math.sin(elapsed * speed);
            }, 20);
        } else {
            if(panner) panner.pan.value = 0; 
        }
    } else {
        mode4dBtn.classList.remove('active');
        showToast("4D Mode Off");
        clearInterval(panInterval);
        if(panner) panner.pan.value = 0; 
        if(fourDFilter) fourDFilter.frequency.value = 20000; 
        if(wetGain) wetGain.gain.value = 0; 
        if(dryGain) dryGain.gain.value = 1; 
    }
}

// 4D Odiyo ni Shakyata
function check4DAvailability(song) {
    const text = (song.title + " " + song.artist).toLowerCase();
    const premiumKeywords = ['remix', 'dj', 'bass', 'party', '8d', '3d', 'lofi', 'chill', 'pop', 'hits', 'dance', 'electronic', 'beat', 'mashup', 'slowed', 'reverb'];
    if(premiumKeywords.some(kw => text.includes(kw))) return true;
    return false;
}

// --- IMMERSIVE UI ---
function toggleImmersivePlayer() {
    const panel = document.getElementById('immersive-player');
    panel.classList.toggle('open');
    document.getElementById('immersive-btn').classList.toggle('active');
    if(panel.classList.contains('open')) updateImmersivePanel();
}

async function updateImmersivePanel() {
    if(currentSongIndex === -1) return;
    const song = currentPlaylist[currentSongIndex];
    
    // Set visuals
    document.getElementById('immersive-bg').style.backgroundImage = `url('${song.image}')`;
    document.getElementById('immersive-img').src = song.image;
    if(document.getElementById('imm-mobile-img')) document.getElementById('imm-mobile-img').src = song.image;
    document.getElementById('immersive-title').innerText = song.title;
    document.getElementById('immersive-artist').innerText = song.artist;
}

function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist,
            album: 'Sangeet PRO',
            artwork: [
                { src: song.image, sizes: '96x96', type: 'image/jpeg' },
                { src: song.image, sizes: '128x128', type: 'image/jpeg' },
                { src: song.image, sizes: '192x192', type: 'image/jpeg' },
                { src: song.image, sizes: '256x256', type: 'image/jpeg' },
                { src: song.image, sizes: '384x384', type: 'image/jpeg' },
                { src: song.image, sizes: '512x512', type: 'image/jpeg' }
            ]
        });
        navigator.mediaSession.setActionHandler('play', () => {
            audioEl.play();
            playPauseBtn.innerHTML = "<i class='fas fa-pause'></i>";
            const _ippbMsPlay = getImmPlayPauseBtn();
            if(_ippbMsPlay) _ippbMsPlay.innerHTML = "<i class='fas fa-pause'></i>";
            navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            audioEl.pause();
            playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
            const _ippbMsPause = getImmPlayPauseBtn();
            if(_ippbMsPause) _ippbMsPause.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
            navigator.mediaSession.playbackState = 'paused';
        });
        navigator.mediaSession.setActionHandler('previoustrack', prevSong);
        navigator.mediaSession.setActionHandler('nexttrack', nextSong);
        try {
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                const skipTime = details.seekOffset || 10;
                audioEl.currentTime = Math.max(audioEl.currentTime - skipTime, 0);
                updateMediaPositionState();
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                const skipTime = details.seekOffset || 10;
                audioEl.currentTime = Math.min(audioEl.currentTime + skipTime, audioEl.duration);
                updateMediaPositionState();
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.fastSeek && 'fastSeek' in audioEl) {
                    audioEl.fastSeek(details.seekTime);
                } else {
                    audioEl.currentTime = details.seekTime;
                }
                updateMediaPositionState();
            });
            navigator.mediaSession.setActionHandler('stop', () => {
                audioEl.pause();
                audioEl.currentTime = 0;
                playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                const _ippbMsStop = getImmPlayPauseBtn();
                if(_ippbMsStop) _ippbMsStop.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                navigator.mediaSession.playbackState = 'none';
            });
        } catch(e) { /* Some handlers not supported on all browsers */ }
        navigator.mediaSession.playbackState = 'playing';
    }
}

// Update media notification progress bar / position
function _updateMediaPositionStateCore() {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
        try {
            if (audioEl.duration && isFinite(audioEl.duration) && audioEl.duration > 0) {
                navigator.mediaSession.setPositionState({
                    duration: audioEl.duration,
                    playbackRate: audioEl.playbackRate,
                    position: Math.min(audioEl.currentTime, audioEl.duration)
                });
            }
        } catch(e) { /* Ignore position state errors */ }
    }
}
// Performance: Throttle media position updates to once per second (avoid excessive calls from timeupdate)
const updateMediaPositionState = SmartEngine.throttle(_updateMediaPositionStateCore, 1000);

// --- PLAYBACK ENGINE ---
