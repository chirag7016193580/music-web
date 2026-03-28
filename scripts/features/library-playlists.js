function showLikedSongs() {
    currentPlaylist = likedSongs; 
    if(likedSongs.length > 0) renderPlaylistView("Liked Songs \u2764\uFE0F", likedSongs);
    else {
        document.getElementById('results').innerHTML = `
            <button class="back-to-home-btn" onclick="loadHome(); setActive(document.querySelector('.menu-item'));">
                <i class="fas fa-arrow-left"></i> Back to Home
            </button>
            <p style='padding:20px; color:gray;'>Koi gaana pasand nahi kiya gaya.</p>`;
    }
    updateQueueUI();
}

// --- LIBRARY AND DOWNLOADS ---
function showLibrary() {
    document.getElementById('page-title').style.display = 'none';
    
    const aiSummaryBox = document.getElementById('ai-summary-box');
    if(aiSummaryBox) aiSummaryBox.style.display = 'none';
    
    document.getElementById('songInput').value = ""; 
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    
    const resultsDiv = document.getElementById('results');
    
    let html = `
        <button class="back-to-home-btn" onclick="loadHome(); setActive(document.querySelector('.menu-item'));">
            <i class="fas fa-arrow-left"></i> Back to Home
        </button>
        <h1 style="font-size: 36px; font-weight: 900; margin-bottom: 30px; color: #fff; letter-spacing: -1px;">Library \uD83D\uDCDA</h1>`;

    html += `<div class="playlist-section"><h2><i class="fas fa-folder-open" style="color:var(--primary-color);"></i> Meri Playlists</h2>`;
    const pNames = Object.keys(userPlaylists);
    if(pNames.length > 0) {
        html += `<div class="results-row">`;
        pNames.forEach(pName => {
            const pSongs = userPlaylists[pName];
            const coverImg = pSongs.length > 0 ? pSongs[0].image : 'https://via.placeholder.com/300?text=No+Songs';
            html += `
                <div class="song-card" onclick="playUserPlaylist('${pName}')">
                    <img src="${coverImg}" loading="lazy" style="border-radius: 8px;">
                    <div class="play-btn"><i class="fas fa-play" style="margin-left:4px;"></i></div>
                    <h3 style="font-size: 16px;">${pName}</h3>
                    <p style="font-size: 13px;">${pSongs.length} Gane</p>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        html += `<p style="color:var(--text-muted); font-size: 14px;">Aapki koi playlist nahi hai. Sidebar se 'New Playlist' banayein.</p>`;
    }
    html += `</div>`;
    
    html += `<div class="playlist-section" style="margin-top: 40px;"><h2><i class="fas fa-history" style="color:var(--primary-color);"></i> Recently Played Songs</h2>`;
    const historyArray = Object.values(playHistory).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0)).slice(0, 20);
    
    if (historyArray.length > 0) {
        html += `<div class="song-list-container">`;
        historyArray.forEach((song, i) => {
            html += `
                <div class="song-list-row" onclick="playFromLibrary('history', ${i})">
                    <img src="${song.image}" loading="lazy">
                    <div class="song-list-info">
                        <h4>${song.title}</h4>
                        <p>${song.artist}</p>
                    </div>
                    <div class="song-list-action"><i class="fas fa-play" style="color: var(--text-muted);"></i></div>
                </div>
            `;
        });
        html += `</div>`;
        window.libraryHistoryData = historyArray; 
    } else {
        html += `<p style="color:var(--text-muted); font-size: 14px;">You haven't played any songs yet.</p>`;
    }
    html += `</div>`;

    html += `<div class="playlist-section" style="margin-top: 40px;"><h2><i class="fas fa-download" style="color:var(--primary-color);"></i> Downloaded Songs</h2>`;
    if (downloadedSongs && downloadedSongs.length > 0) {
        html += `<div class="song-list-container">`;
        downloadedSongs.forEach((song, i) => {
            html += `
                <div class="song-list-row" onclick="playFromLibrary('downloads', ${i})">
                    <img src="${song.image}" loading="lazy">
                    <div class="song-list-info">
                        <h4>${song.title}</h4>
                        <p>${song.artist}</p>
                    </div>
                    <div class="song-list-action"><i class="fas fa-check-circle" style="color: var(--primary-color);"></i></div>
                </div>
            `;
        });
        html += `</div>`;
        window.libraryDownloadsData = downloadedSongs; 
    } else {
        html += `<p style="color:var(--text-muted); font-size: 14px;">Your download list is empty.</p>`;
    }
    html += `</div>`;

    resultsDiv.innerHTML = html;
}

window.playUserPlaylist = function(pName) {
    const songs = userPlaylists[pName];
    if(!songs || songs.length === 0) {
        showToast("Is playlist mein koi gane nahi hain.");
        return;
    }
    currentPlaylist = songs;
    renderPlaylistView(`📁 ${pName}`, currentPlaylist);
    updateQueueUI();
};

function playFromLibrary(type, index) {
    if (type === 'history') {
        currentPlaylist = window.libraryHistoryData;
    } else {
        currentPlaylist = window.libraryDownloadsData;
    }
    playSongByIndex(index);
}

// --- DOWNLOAD TOGGLE FEATURE ---
function toggleDownload(e) {
    if(currentSongIndex === -1) return;
    const song = currentPlaylist[currentSongIndex];
    const btn = document.getElementById('download-btn');
    const immBtn = document.getElementById('imm-download-btn');
    
    const isDownloadedIndex = downloadedSongs.findIndex(s => s.audioUrl === song.audioUrl);

    if(isDownloadedIndex > -1) {
        downloadedSongs.splice(isDownloadedIndex, 1);
        if(btn) btn.classList.remove('active');
        if(immBtn) immBtn.classList.remove('active');
        showToast("Removed from Downloads");
    } else {
        downloadedSongs.push(song);
        if(btn) btn.classList.add('active');
        if(immBtn) immBtn.classList.add('active');
        showToast("Song is downloading... ⬇️");
        
        const a = document.createElement('a');
        a.href = song.audioUrl;
        a.download = `${song.title} - ${song.artist}.m4a`; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    SmartEngine.batchedSetItem('proMusicDownloadedSongs', JSON.stringify(downloadedSongs));
    
    // Auto update library page if it's currently open
    if(document.getElementById('page-title') && document.getElementById('page-title').innerText === "Library 📚" || document.getElementById('results').innerHTML.includes("Library 📚")) {
        showLibrary();
    }
}

function showLanguages() {
    document.getElementById('songInput').value = "";
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));

    const resultsDiv = document.getElementById('results');
    
    const languages = [
        { name: "Bollywood", color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", query: "Bollywood Top Hits 2024" },
        { name: "South Indian", color: "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)", query: "South Indian Pan India Top Hits" },
        { name: "Hindi", color: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", query: "Hindi Pop Top Hits" },
        { name: "Punjabi", color: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", query: "Punjabi Top Pop Hits" },
        { name: "English", color: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)", query: "Global Pop Top Hits" },
        { name: "Tamil", color: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", query: "Tamil Top Hit Songs" },
        { name: "Telugu", color: "linear-gradient(135deg, #ff0844 0%, #ffb199 100%)", query: "Telugu Top Hit Songs" },
        { name: "Bhojpuri", color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", query: "Bhojpuri Top Hit Songs" },
        { name: "Marathi", color: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", query: "Marathi Top Hit Songs" },
        { name: "Gujarati", color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", query: "Gujarati Top Hit Songs" }
    ];

    let html = `
        <div style="display:flex; gap: 24px; margin-bottom: 30px; align-items: flex-end; flex-wrap: wrap;">
            <div style="flex: 1;">
                <h1 style="font-size: 50px; font-weight: 900; margin: 8px 0 15px 0; color: #fff; text-shadow: 0 4px 15px rgba(0,0,0,0.5); display:block; letter-spacing: -1px;">Choose Language</h1>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; padding-bottom: 40px;">`;
    
    languages.forEach(lang => {
        html += `
            <div onclick="fetchSongsAndShowList('${lang.query}', '🔥 Top ${lang.name} Songs')" style="background: ${lang.color}; border-radius: 12px; height: 120px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.2); will-change: transform;" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 15px 25px rgba(0,0,0,0.4)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 10px 20px rgba(0,0,0,0.2)';">
                <h3 style="color: #000; font-size: 24px; font-weight: 800; text-shadow: 0 2px 5px rgba(255,255,255,0.5);">${lang.name}</h3>
            </div>
        `;
    });
    
    html += '</div>';
    resultsDiv.innerHTML = html;
}

function showCreatePlaylistModal() {
    document.getElementById('create-playlist-modal').style.display = 'flex';
    document.getElementById('new-playlist-name').focus();
}

function closeCreatePlaylistModal() {
    document.getElementById('create-playlist-modal').style.display = 'none';
    document.getElementById('new-playlist-name').value = '';
}

function saveNewPlaylist() {
    const name = document.getElementById('new-playlist-name').value.trim();
    if(!name) { showToast("Kripya naam likhein!"); return; }
    if(userPlaylists[name]) { showToast("Ye playlist pehle se hai!"); return; }
    
    userPlaylists[name] = [];
    SmartEngine.batchedSetItem('proMusicUserPlaylists', JSON.stringify(userPlaylists));
    closeCreatePlaylistModal();
    showToast(`'${name}' playlist ban gayi! 🎉`);
    
    if(document.getElementById('results').innerHTML.includes("Library 📚")) {
        showLibrary();
    }
}

function showAddToPlaylistModal(e) {
    if(e) e.stopPropagation();
    if(currentSongIndex === -1) { showToast("Pehle koi gana play karein!"); return; }
    
    const optionsContainer = document.getElementById('playlist-options');
    optionsContainer.innerHTML = '';
    
    const playlistNames = Object.keys(userPlaylists);
    if(playlistNames.length === 0) {
        optionsContainer.innerHTML = '<p style="color:var(--text-muted); font-size:13px; text-align:center;">Koi playlist nahi hai. Pehle nayi playlist banayein.</p>';
    } else {
        playlistNames.forEach(pName => {
            let div = document.createElement('div');
            div.className = 'playlist-select-item';
            div.innerText = pName;
            div.onclick = () => addSongToPlaylist(pName);
            optionsContainer.appendChild(div);
        });
    }
    document.getElementById('add-to-playlist-modal').style.display = 'flex';
}

function closeAddToPlaylistModal() {
    document.getElementById('add-to-playlist-modal').style.display = 'none';
}

function addSongToPlaylist(playlistName) {
    if(currentSongIndex === -1) return;
    const song = currentPlaylist[currentSongIndex];
    
    const exists = userPlaylists[playlistName].find(s => s.audioUrl === song.audioUrl);
    if(exists) {
        showToast("Gana pehle se playlist mein hai!");
    } else {
        userPlaylists[playlistName].push(song);
        SmartEngine.batchedSetItem('proMusicUserPlaylists', JSON.stringify(userPlaylists));
        showToast(`Gana '${playlistName}' mein jod diya gaya!`);
        // Feedback Loop: playlist addition signal
        trackPlaylistAddition(song, playlistName);
        
        if(document.getElementById('results').innerHTML.includes("Library 📚")) {
            showLibrary();
        }
    }
    closeAddToPlaylistModal();
}

function toggleQueue() {
    isQueueOpen = !isQueueOpen;
    if(isQueueOpen) {
        queuePanel.classList.add('open'); document.getElementById('queue-btn').classList.add('active'); updateQueueUI();
    } else {
        queuePanel.classList.remove('open'); document.getElementById('queue-btn').classList.remove('active');
    }
}

// SmartEngine: Optimized queue rendering with DocumentFragment (batch DOM)
