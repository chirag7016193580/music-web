async function playSongByIndex(index) {
    if(index < 0 || index >= currentPlaylist.length) return;
    currentSongIndex = index;
    let song = currentPlaylist[index];

    trackSongPlay(song);

    document.getElementById('np-title').innerText = song.title;
    document.getElementById('np-artist').innerText = song.artist;
    document.getElementById('np-img').src = song.image;
    document.getElementById('np-img').style.display = "block";
    
    document.getElementById('bg-blur').style.backgroundImage = `url('${song.image}')`;
    
    likeBtn.style.display = "block";
    
    // Sync download buttons
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

    // Sync like buttons
    const isLiked = likedSongs.some(s => s.title === song.title && s.artist === song.artist);
    if(isLiked) likeBtn.classList.add('active');
    else likeBtn.classList.remove('active');
    
    const immLikeBtns = document.querySelectorAll('.immersive-song-info .action-btn .fa-heart');
    immLikeBtns.forEach(icon => {
        if(isLiked) icon.parentElement.classList.add('active');
        else icon.parentElement.classList.remove('active');
    });

    const is4DReady = check4DAvailability(song);
    if(is4DReady) {
        mode4dBtn.style.display = 'inline-block'; 
    } else {
        mode4dBtn.style.display = 'none'; 
        if(is4DMode) {
            toggle4DMode(); 
            showToast("This song is not suitable for 4D, 4D mode disabled.");
        }
    }

    playPauseBtn.innerHTML = "<i class='fas fa-spinner fa-spin'></i>";
    const _ippb = getImmPlayPauseBtn();
    if(_ippb) _ippb.innerHTML = "<i class='fas fa-spinner fa-spin'></i>";

    if (!song.isFullAudioFetched) {
        try {
            showToast("Searching for full song... ⏳");
            
            const queriesToTry = [
                `${song.title} ${song.artist}`,
                song.title
            ];
            
            let foundFullAudio = false;

            for (let q of queriesToTry) {
                if (foundFullAudio) break;
                
                const url = `https://music-api-tawny-ten.vercel.app/api/search?song=${encodeURIComponent(q)}&limit=10`;

                let localRes = await fetch(url);
                if (!localRes.ok) continue;

                let localData = await localRes.json();
                let tracks = Array.isArray(localData) ? localData : (localData.data?.results || localData.results || localData.data || []);
                
                if(tracks && tracks.length > 0) {
                    for (let i = 0; i < Math.min(tracks.length, 3); i++) {
                        let fullUrl = extractBestAudioUrl(tracks[i]);
                        if (fullUrl && fullUrl.startsWith('http')) {
                            song.audioUrl = fullUrl; 
                            song.isFullAudioFetched = true;
                            foundFullAudio = true;
                            showToast("Full Audio Found! 🎵");
                            break;
                        }
                    }
                }
            }
        } catch(err) {
            console.log("Error finding full song, preview will play.", err);
        }
    }
    
    if (!song.isFullAudioFetched) {
        showToast("Preview only (Server Busy/Not Found) ⚠️");
    }
    
    audioEl.crossOrigin = "anonymous";
    audioEl.src = song.audioUrl;
    
    // Auto setup Web Audio context on user interaction (First play)
    if(!audioCtx) setupWebAudio();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    audioEl.play().catch(e => console.log("Auto-play blocked", e));
    
    playPauseBtn.innerHTML = "<i class='fas fa-pause'></i>";
    const _ippb2 = getImmPlayPauseBtn();
    if(_ippb2) _ippb2.innerHTML = "<i class='fas fa-pause'></i>";
    
    const state = { playlist: currentPlaylist, index: currentSongIndex, currentTime: 0 };
    SmartEngine.batchedSetItem('proMusicLastState', JSON.stringify(state));

    if (!isQueueOpen && window.innerWidth > 900) toggleQueue();
    updateQueueUI(); 
    highlightVerticalListSong(index); 
    if(immersivePlayer.classList.contains('open')) updateImmersivePanel();
    
    updateMediaSession(song);
    requestWakeLock();
    // Update position state when audio metadata loads
    audioEl.addEventListener('loadedmetadata', () => { updateMediaPositionState(); }, { once: true });
    updateSidebarMiniPlayer();
    updateLikedBadge();
    
    // SmartEngine: Prefetch next song audio for gapless playback
    if (currentPlaylist.length > 1) {
        const nextIdx = (index + 1) % currentPlaylist.length;
        const nextSong = currentPlaylist[nextIdx];
        if (nextSong && nextSong.audioUrl) {
            SmartEngine.prefetchAudio(nextSong.audioUrl);
        }
    }
}

function highlightVerticalListSong(index) {
    const allRows = document.querySelectorAll('.song-list-row');
    if(allRows.length === 0) return;
    allRows.forEach((row, i) => {
        row.classList.remove('active');
        let numSpan = row.querySelector('.song-num');
        let titleH4 = row.querySelector('.song-list-info h4');
        
        if(i === index) {
            row.classList.add('active');
            if(numSpan) numSpan.innerHTML = '<i class="fas fa-volume-up" style="color: var(--primary-color); font-size: 16px;"></i>';
            if(titleH4) titleH4.style.color = 'var(--primary-color)';
        } else {
            if(numSpan) numSpan.innerHTML = i + 1;
            if(titleH4) titleH4.style.color = '#fff';
        }
    });
}

function togglePlay() {
    if (!audioEl.src) return;
    
    // Setup audio context if it wasn't setup yet
    if(!audioCtx) setupWebAudio();
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    if (audioEl.paused) {
        audioEl.play();
        playPauseBtn.innerHTML = "<i class='fas fa-pause'></i>";
        const _ippbPlay = getImmPlayPauseBtn();
        if(_ippbPlay) _ippbPlay.innerHTML = "<i class='fas fa-pause'></i>";
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        requestWakeLock();
    } else {
        audioEl.pause();
        playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
        const _ippbPause = getImmPlayPauseBtn();
        if(_ippbPause) _ippbPause.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        releaseWakeLock();
    }
    
    if (currentPlaylist.length > 0 && currentSongIndex >= 0) {
        SmartEngine.batchedSetItem('proMusicLastState', JSON.stringify({
            playlist: currentPlaylist,
            index: currentSongIndex,
            currentTime: audioEl.currentTime
        }));
    }
}

function nextSong() {
    if(currentPlaylist.length === 0) return;
    // Track skip if song was playing less than 30% duration
    if (currentSongIndex >= 0 && currentPlaylist[currentSongIndex]) {
        const song = currentPlaylist[currentSongIndex];
        if (audioEl.duration > 0 && (audioEl.currentTime / audioEl.duration) < 0.3) {
            trackSongSkip(song);
        }
        // Track listen duration
        if (audioEl.currentTime > 0) {
            trackListenDuration(song, audioEl.currentTime);
        }
    }
    if (isShuffle) {
        let randomIndex = Math.floor(Math.random() * currentPlaylist.length);
        playSongByIndex(randomIndex);
    } else {
        if (currentSongIndex < currentPlaylist.length - 1) playSongByIndex(currentSongIndex + 1);
        else if (repeatMode === 1) playSongByIndex(0); 
        else autoPlayNextPlaylist();
    }
}

async function autoPlayNextPlaylist() {
    showToast("Loading new popular songs... 🔄");
    let searchQuery = "Top Bollywood Hits"; 

    if (currentPlaylist.length > 0 && currentSongIndex >= 0) {
        const lastSong = currentPlaylist[currentSongIndex];
        searchQuery = `${lastSong.artist} popular hits`; 
    } else {
        const profile = getUserProfile();
        if (profile.topArtists.length > 0) {
            searchQuery = `${profile.topArtists[0]} top hit songs`;
        }
    }

    if (autoPlayKeywords && autoPlayKeywords.length > 0 && Math.random() > 0.5) {
        searchQuery = autoPlayKeywords[Math.floor(Math.random() * autoPlayKeywords.length)];
    }
    
    try {
        const newData = await getAudioData(searchQuery);
        if(newData && newData.length > 0) {
            const existingUrls = new Set(currentPlaylist.map(s => s.audioUrl));
            const freshSongs = newData.filter(s => !existingUrls.has(s.audioUrl));

            if(freshSongs.length > 0) {
                currentPlaylist = currentPlaylist.concat(freshSongs);
                showToast(`Auto-Play: Added new hit songs you might like! 🚀`);
                playSongByIndex(currentSongIndex + 1);
                if(!document.querySelector('.top-result-card')) {
                    renderPlaylistView(`📻 Your Custom Hit Mix`, currentPlaylist);
                }
                updateQueueUI();
            } else {
                audioEl.pause(); 
                playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                const _ippbAp1 = getImmPlayPauseBtn();
                if(_ippbAp1) _ippbAp1.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
            }
        } else {
            audioEl.pause(); 
            playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
            const _ippbAp2 = getImmPlayPauseBtn();
            if(_ippbAp2) _ippbAp2.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
        }
    } catch (err) {
        audioEl.pause(); 
        playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
        const _ippbAp3 = getImmPlayPauseBtn();
        if(_ippbAp3) _ippbAp3.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
    }
}

function prevSong() {
    if (currentPlaylist.length > 0 && currentSongIndex > 0) {
        if(audioEl.currentTime > 3) audioEl.currentTime = 0;
        else playSongByIndex(currentSongIndex - 1);
    } else if (currentSongIndex === 0) audioEl.currentTime = 0;
}

audioEl.addEventListener('ended', () => {
    // Track listen duration on song end
    if (currentSongIndex >= 0 && currentPlaylist[currentSongIndex]) {
        trackListenDuration(currentPlaylist[currentSongIndex], audioEl.duration || 0);
    }
    if (repeatMode === 2) {
        // Track replay signal when song repeats
        if (currentSongIndex >= 0 && currentPlaylist[currentSongIndex]) {
            trackSongReplay(currentPlaylist[currentSongIndex]);
        }
        audioEl.currentTime = 0; audioEl.play();
    } else { nextSong(); }
});

function toggleShuffle() {
    isShuffle = !isShuffle;
    document.getElementById('shuffle-btn').classList.toggle('active', isShuffle);
    if(document.getElementById('imm-shuffle-btn')) document.getElementById('imm-shuffle-btn').classList.toggle('active', isShuffle);
    showToast(isShuffle ? "Shuffle On" : "Shuffle Off");
}

function toggleRepeat() {
    const btn = document.getElementById('repeat-btn');
    const immBtn = document.getElementById('imm-repeat-btn');
    repeatMode = (repeatMode + 1) % 3; 
    if(repeatMode === 0) {
        btn.classList.remove('active'); btn.innerHTML = "<i class='fas fa-redo'></i>"; 
        if(immBtn) { immBtn.classList.remove('active'); immBtn.innerHTML = "<i class='fas fa-redo'></i>"; }
        showToast("Repeat Off");
    } else if (repeatMode === 1) {
        btn.classList.add('active'); btn.innerHTML = "<i class='fas fa-redo'></i>"; 
        if(immBtn) { immBtn.classList.add('active'); immBtn.innerHTML = "<i class='fas fa-redo'></i>"; }
        showToast("Repeat All");
    } else {
        btn.classList.add('active'); btn.innerHTML = "<i class='fas fa-redo-alt'></i><span style='font-size:10px;position:absolute;margin-top:2px;margin-left:2px;'>1</span>"; 
        if(immBtn) { immBtn.classList.add('active'); immBtn.innerHTML = "<i class='fas fa-redo-alt'></i><span style='font-size:10px;position:absolute;margin-top:2px;margin-left:2px;'>1</span>"; }
        showToast("Repeat One");
    }
}

function toggleLike(e) {
    if(currentSongIndex === -1) return;
    const currentSong = currentPlaylist[currentSongIndex];
    const isLikedIndex = likedSongs.findIndex(s => s.title === currentSong.title && s.artist === currentSong.artist);

    if(isLikedIndex > -1) {
        likedSongs.splice(isLikedIndex, 1); 
        likeBtn.classList.remove('active');
        showToast("Removed from Liked Songs");
    } else {
        likedSongs.push(currentSong); 
        likeBtn.classList.add('active');
        showToast("Added to Liked Songs ❤️");
        // Feedback Loop: like signal strengthens taste vector
        updateTasteVector(currentSong, 'like');
    }
    SmartEngine.batchedSetItem('proMusicLikedSongs', JSON.stringify(likedSongs));
    updateLikedBadge();
    highlightVerticalListSong(currentSongIndex); 
    
    // Highlight in immersive view
    const immLikeBtns = document.querySelectorAll('.immersive-song-info .action-btn');
    immLikeBtns.forEach(btn => {
        if(isLikedIndex > -1) {
            btn.classList.remove('active');
            btn.style.color = "var(--text-muted)";
        } else {
            btn.classList.add('active');
            btn.style.color = "var(--primary-color)";
        }
    });
}

