// --- API FETCH LOGIC (OPTIMIZED WITH CACHE) ---
async function getAudioData(query) {
    // ENGINE FIX: Use memory cache to return instant results
    if (apiCache.has(query)) {
        return apiCache.get(query);
    }

    try {
        const url = `https://music-api-tawny-ten.vercel.app/api/search?song=${encodeURIComponent(query)}&limit=50`;
        let res = await fetch(url);
        
        if (res.ok) {
            let json = await res.json();
            
            let tracks = Array.isArray(json) ? json : (json.data?.results || json.results || json.data || json.songs || []);
            
            if (tracks.length > 0) {
                let formattedData = tracks.map(track => {
                    let fullAudioUrl = extractBestAudioUrl(track);
                    
                    let imgUrl = 'https://via.placeholder.com/300';
                    if (track.image) {
                        if (Array.isArray(track.image) && track.image.length > 0) {
                            imgUrl = track.image[track.image.length - 1].link || track.image[track.image.length - 1].url || track.image[track.image.length - 1];
                        } else if (typeof track.image === 'string') {
                            imgUrl = track.image;
                        } else if (typeof track.image === 'object') {
                            imgUrl = track.image.link || track.image.url || track.image.high;
                        }
                    }

                    let tempDiv = document.createElement('div');
                    tempDiv.innerHTML = track.name || track.title || track.song || query;
                    let cleanTitle = tempDiv.textContent || tempDiv.innerText;

                    return {
                        title: cleanTitle,
                        artist: track.primaryArtists || track.singers || track.artist || "Unknown Artist",
                        image: imgUrl,
                        audioUrl: fullAudioUrl,
                        isFullAudioFetched: !!fullAudioUrl 
                    };
                }).filter(t => t.audioUrl && t.audioUrl.startsWith('http'));
                
                if (formattedData.length > 0) {
                    apiCache.set(query, formattedData); // Save to cache
                    return formattedData; 
                }
            }
        }
    } catch(err) { 
        if(err.message && err.message.includes('fetch')) {
            showToast("Backend Server/CORS Issue! Playing preview.");
        }
    }

    // Fallback: iTunes
    try {
        let fr = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=50`);
        let fd = await fr.json();
        if (fd.results && fd.results.length > 0) {
            let formattedData = fd.results.filter(track => track.previewUrl).map(track => ({
                title: track.trackName,
                artist: track.artistName,
                image: track.artworkUrl100.replace('100x100bb', '300x300bb'),
                audioUrl: track.previewUrl,
                isFullAudioFetched: false
            }));
            let result = formattedData.filter((v, i, a) => a.findIndex(t => (t.title.toLowerCase() === v.title.toLowerCase())) === i);
            apiCache.set(query, result); // Save fallback to cache
            return result;
        }
        return [];
    } catch(err) { 
        return [];
    }
}

function handleKeyPress(event) {
    if (event.key === "Enter") {
        document.getElementById('songInput').blur();
        searchMusic();
    }
}

let searchDebounceTimeout;
async function handleSearchInput() {
    const query = document.getElementById('songInput').value.trim();
    const dropdown = document.getElementById('search-history-dropdown');
    dropdown.classList.add('active');

    if (query.length < 2) {
        renderSearchHistory();
        return;
    }

    clearTimeout(searchDebounceTimeout);
    dropdown.innerHTML = '<div style="padding: 12px 20px; color: var(--text-muted); font-size: 13px;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

    searchDebounceTimeout = setTimeout(async () => {
        try {
            let res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=8`);
            let data = await res.json();

            if (data.results && data.results.length > 0) {
                let html = '';
                let suggestions = [];
                data.results.forEach(track => {
                    if(!suggestions.includes(track.trackName)) suggestions.push(track.trackName);
                });
                suggestions = [...new Set(suggestions)].slice(0, 6); 

                suggestions.forEach(item => {
                    const cleanItem = item.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    html += `<div class="search-history-item" onmousedown="searchFromHistory('${cleanItem}')"><i class="fas fa-search"></i> ${item}</div>`;
                });
                dropdown.innerHTML = html;
            } else {
                dropdown.innerHTML = '<div style="padding: 12px 20px; color: var(--text-muted); font-size: 13px;">No suggestions found.</div>';
            }
        } catch (err) {
            dropdown.innerHTML = '<div style="padding: 12px 20px; color: var(--text-muted); font-size: 13px;">Error loading suggestions.</div>';
        }
    }, 400); 
}

function renderSearchHistory() {
    const dropdown = document.getElementById('search-history-dropdown');
    if (searchHistory.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px 20px; color: var(--text-muted); font-size: 13px;">No recent searches found.</div>';
        return;
    }
    let html = '';
    searchHistory.forEach(item => {
        const cleanItem = item.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        html += `<div class="search-history-item" onmousedown="searchFromHistory('${cleanItem}')"><i class="fas fa-history"></i> ${item}</div>`;
    });
    dropdown.innerHTML = html;
}

function hideSearchHistory() {
    setTimeout(() => { document.getElementById('search-history-dropdown').classList.remove('active'); }, 200);
}

function searchFromHistory(query) {
    document.getElementById('songInput').value = query;
    searchMusic();
}

async function fetchWithRetry(url, payload) {
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < 6; i++) {
        try {
            const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (e) {
            if (i === 5) throw e;
            await new Promise(res => setTimeout(res, delays[i]));
        }
    }
}

async function loadHome() {
    document.getElementById('bg-blur').style.backgroundImage = 'none';

    document.getElementById('songInput').value = ""; 
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = loaderHTML; 

    const profile = getUserProfile(), hour = new Date().getHours();
    
    // Top Singers List for Daily Mix
    let top = profile.topArtists.slice(0, 5);
    if(top.length === 0) top = ["Arijit Singh", "Kishore Kumar", "Diljit Dosanjh", "Shreya Ghoshal", "Darshan Raval"];
    else if (top.length < 5) {
        const defaults = ["Arijit Singh", "Pritam", "Kishore Kumar", "Badshah", "Atif Aslam"];
        top = [...new Set([...top, ...defaults])].slice(0, 5);
    }

    let dQ = profile.topArtists.slice(0, 2).map(a => a + " best songs");
    if(dQ.length === 0) dQ = ["Arijit Singh best songs", "Diljit Dosanjh best songs"];
    if(profile.topKeywords.includes("romantic")) dQ.push("Atif Aslam romantic");

    let mixed = [];
    // ENGINE FIX: Load Home feed tracks in parallel instead of one by one
    let dQPromises = dQ.map(q => getAudioData(q).catch(() => []));
    let dQResults = await Promise.all(dQPromises);
    dQResults.forEach(d => mixed = mixed.concat(d));

    mixed.forEach(s => s.smartScore = calculateSongScore(s, profile, hour));
    let mfy = mixed.sort((a, b) => b.smartScore - a.smartScore).filter((v,i,a) => a.findIndex(t => t.title === v.title) === i);

    resultsDiv.innerHTML = ""; 

    // -------------------------------------------------------------
    // DYNAMIC POOLS FOR RANDOMIZED FRESH CONTENT EVERY LOAD
    // FIX: Using completely unique search queries with "Hits"
    // so the API doesn't return the exact same 50 songs.
    // -------------------------------------------------------------

    // 1. Made For You (Daily Mixes)
    const dailyMixes = [
        { id: 'dm1', text: `${top[0]}, Pritam, Sachin-Jigar and more`, q: `${top[0]} blockbusters top hits`, color: '#00e5ff', badge: 'Daily Mix', num: '01' },
        { id: 'dm2', text: `${top[1]}, Lata Mangeshkar, R.D. Burman`, q: `${top[1]} all time superhits`, color: '#fdf500', badge: 'Daily Mix', num: '02' },
        { id: 'dm3', text: `${top[2]}, Guru Randhawa, AP Dhillon`, q: `${top[2]} biggest hits`, color: '#ff4d4d', badge: 'Daily Mix', num: '03' },
        { id: 'dm4', text: `${top[3]}, Mitraz, Anuv Jain and indie`, q: `${top[3]} top 50 hits`, color: '#ff8df0', badge: 'Daily Mix', num: '04' },
        { id: 'dm5', text: `${top[4]}, Badshah, Honey Singh`, q: `${top[4]} smash hits`, color: '#92e424', badge: 'Daily Mix', num: '05' }
    ];
    renderMixSection("Made For You (Daily Mix)", dailyMixes);

    // 2. Quick Picks
    if(mfy.length > 0) {
        renderQuickPicks(mfy);
        setTimeout(() => {
            const qpHeader = document.querySelector('.quick-picks-header h2');
            if(qpHeader) qpHeader.innerHTML = "🎯 Quick Picks For You <span style='font-size:14px; background:var(--primary-color); padding:4px 10px; border-radius:20px; margin-left:10px; color:#fff;'>Smart Mix</span>";
        }, 100);
    }

    // Hit gane fetch karne ke liye separate queries
    // 3. Trending Mixes Pool (Sirf Trending Hits)
    let trendingPool = [
        { text: 'Top Bollywood Hits 2026', q: 'Top 50 Bollywood Hits', color: '#ff0055', badge: 'Trending' },
        { text: 'Viral Instagram Hits', q: 'Viral Instagram Reels Hits', color: '#ff4500', badge: 'Trending' },
        { text: 'Global Top 50 Hits', q: 'Global Top 50 Pop Hits', color: '#1db954', badge: 'Trending' },
        { text: 'South Pan India Hits', q: 'South Indian Blockbuster Hits', color: '#8c52ff', badge: 'Trending' },
        { text: 'Trending Indie Hits', q: 'Indian Indie Pop Hits', color: '#00d2ff', badge: 'Trending' }
    ];
    let trendingMixes = shuffleArray(trendingPool).slice(0, 5).map((m, i) => ({...m, id: 'tr'+i, num: '0'+(i+1)}));
    renderMixSection("🔥 Trending Hit Songs", trendingMixes);

    // 4. Party Mixes Pool (Sirf Party Hits)
    let partyPool = [
        { text: 'Badshah & Honey Singh Hits', q: 'Badshah Honey Singh Dance Hits', color: '#ff00ff', badge: 'Party Mix' },
        { text: 'Punjabi Dance Hits', q: 'Hardy Sandhu Punjabi Dance Hits', color: '#00ffff', badge: 'Party Mix' },
        { text: 'Club Mix DJ Hits', q: 'Bollywood DJ Remix Hits', color: '#ffff00', badge: 'Party Mix' },
        { text: 'Retro Party Hits', q: 'Kishore Kumar Fun Dance Hits', color: '#ff00aa', badge: 'Party Mix' },
        { text: 'Bhojpuri Dance Hits', q: 'Pawan Singh Bhojpuri Hits', color: '#00ff00', badge: 'Party Mix' }
    ];
    let partyMixes = shuffleArray(partyPool).slice(0, 5).map((m, i) => ({...m, id: 'pt'+i, num: '0'+(i+1)}));
    renderMixSection("🕺 Party Hits Mix", partyMixes);

    // 5. Bollywood Nonstop Pool (Sirf Nonstop Hits)
    let nonstopPool = [
        { text: 'Arijit Singh Sad Hits', q: 'Arijit Singh Sad Hits', color: '#4a90e2', badge: 'Nonstop' },
        { text: 'Pritam Romantic Hits', q: 'Pritam Romantic Hits Mashup', color: '#bd10e0', badge: 'Nonstop' },
        { text: 'Lofi Bollywood Hits', q: 'Lofi Bollywood Chill Hits', color: '#50e3c2', badge: 'Nonstop' },
        { text: '90s Romantic Hits', q: '90s Romantic Melody Hits', color: '#b8e986', badge: 'Nonstop' },
        { text: 'Udit Narayan Alka Yagnik Hits', q: 'Udit Narayan Alka Yagnik Duet Hits', color: '#ffaa00', badge: 'Nonstop' }
    ];
    let nonstopMixes = shuffleArray(nonstopPool).slice(0, 5).map((m, i) => ({...m, id: 'ns'+i, num: '0'+(i+1)}));
    renderMixSection("🎬 Bollywood Nonstop Hits", nonstopMixes);

    // 6. Top New Movie Songs Pool (Sirf Latest Hits)
    let newMoviesPool = [
        { text: 'Latest Bollywood Hits', q: 'New Hindi Movie Hits 2025', color: '#ff2a5f', badge: 'New Releases' },
        { text: 'Fresh Chartbuster Hits', q: 'T-Series Latest Hits', color: '#ffb300', badge: 'New Releases' },
        { text: 'New Punjabi Hits', q: 'Latest Punjabi Pop Hits', color: '#00d2ff', badge: 'New Releases' },
        { text: 'Trending Filmy Hits', q: 'YRF New Release Hits', color: '#00ff88', badge: 'New Releases' }
    ];
    let newMoviesMixes = shuffleArray(newMoviesPool).slice(0, 5).map((m, i) => ({...m, id: 'nm'+i, num: '0'+(i+1)}));
    renderMixSection("🍿 New Movie Hits", newMoviesMixes);
    
    // 7. Sabse Popular Gane (All Time Hits) Pool
    let popularPool = [
        { text: 'A.R. Rahman Classic Hits', q: 'AR Rahman Tamil Hindi Classic Hits', color: '#ff6b81', badge: 'Popular' },
        { text: 'Kishore Kumar Evergreen Hits', q: 'Kishore Kumar Retro Hits', color: '#4facfe', badge: 'Popular' },
        { text: 'Sonu Nigam 2000s Hits', q: 'Sonu Nigam Melody Hits', color: '#f093fb', badge: 'Popular' },
        { text: 'Atif Aslam Romance Hits', q: 'Atif Aslam Romantic Best Hits', color: '#5ee7df', badge: 'Popular' },
        { text: 'Shreya Ghoshal Melody Hits', q: 'Shreya Ghoshal Soft Hits', color: '#f6d365', badge: 'Popular' }
    ];
    let popularMixes = shuffleArray(popularPool).slice(0, 5).map((m, i) => ({...m, id: 'pop'+i, num: '0'+(i+1)}));
    renderMixSection("🌟 Sabse Popular Hit Gane (All Time Hits)", popularMixes);
    
    // 8. Top Singers Playlist (Dynamic based on User History)
    let userFavoriteSingers = profile.topArtists; // ALready sorted by playCount
    let defaultSingers = ['Arijit Singh', 'Shreya Ghoshal', 'Diljit Dosanjh', 'Atif Aslam', 'Kishore Kumar', 'Darshan Raval', 'Neha Kakkar', 'Sonu Nigam'];
    
    // Combine and remove duplicates, take top 10
    let combinedSingers = [...new Set([...userFavoriteSingers, ...defaultSingers])].slice(0, 10);
    
    let singersPool = combinedSingers.map(artistName => ({ name: artistName }));
    let sectionTitle = userFavoriteSingers.length > 0 ? "🎤 Your Favorite Singers" : "🎤 Top Singers (Ultimate Hit Collections)";
    
    renderSingersSection(sectionTitle, singersPool);

    autoPlayKeywords = ["Arijit Singh superhits", "Diljit Dosanjh hits", "Shreya Ghoshal hits", "Badshah smash hits", "Pritam top hits", "Top Bollywood Superhits"];
}

// --- NEW: SINGER SPECIFIC PLAYLIST LOGIC ---
function renderSingersSection(title, singers) {
    const resultsDiv = document.getElementById('results');
    
    let html = `
        <div class="playlist-section">
            <h2 style="font-size: 26px; font-weight: 800; margin-bottom: 20px; color: #fff; text-shadow: 0 4px 15px rgba(0,0,0,0.4);">${title}</h2>
            <div class="scroll-wrapper">
                <button class="scroll-btn scroll-left" onclick="scrollRow(this, -1)"><i class="fas fa-chevron-left"></i></button>
                <div class="daily-mix-row scrollable-row" style="gap: 30px;">
    `;
    
    singers.forEach(singer => {
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(singer.name)}&background=random&color=fff&size=250&bold=true`;
        
        html += `
            <div class="singer-card" onclick="playDeepSingerPlaylist('${singer.name}')">
                <div class="singer-img-wrapper">
                    <img src="${avatarUrl}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
                    <div class="qp-play-overlay" style="border-radius: 50%;"><i class="fas fa-play" style="font-size: 24px;"></i></div>
                </div>
                <h4 style="color: #fff; font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 5px;">${singer.name}</h4>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">100+ Hit Songs</p>
            </div>
        `;
    });

    html += `       </div>
                <button class="scroll-btn scroll-right" onclick="scrollRow(this, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>`;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    resultsDiv.appendChild(wrapper);

    // Fetch actual images for singers asynchronously to replace avatars
    singers.forEach((singer) => {
        setTimeout(async () => {
            try {
                let data = await getAudioData(singer.name + " latest hits");
                if(data && data.length > 0 && data[0].image && !data[0].image.includes('placeholder')) {
                    const imgElements = Array.from(document.querySelectorAll('.singer-card h4')).filter(el => el.innerText === singer.name);
                    if(imgElements.length > 0) {
                        const imgWrap = imgElements[0].previousElementSibling;
                        imgWrap.innerHTML += `<img src="${data[0].image}" loading="lazy" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; opacity:0; transition: opacity 0.5s; object-fit: cover; border-radius: 50%;" onload="this.style.opacity=1">`;
                    }
                }
            } catch(e){}
        }, 500); // Staggered to prevent freezing
    });
}

async function playDeepSingerPlaylist(singer) {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    const resultsDiv = document.getElementById('results');
    
    // Beautiful loading state
    resultsDiv.innerHTML = `
        <div style="text-align:center; padding: 60px 20px;">
            <div class="loader" style="margin: 0 auto 20px auto; border-left-color: #fff;"></div>
            <h3 style="color:#fff; font-size:22px;">Loading Ultimate ${singer} Hit Collection...</h3>
            <p style="color:var(--text-muted); font-size:14px; margin-top:10px;">Finding 100+ unique hit tracks</p>
        </div>
    `;

    // Hit gane fetch karne ke liye separate queries
    const queries = [
        `${singer} top hits`,
        `${singer} romantic hits`,
        `${singer} sad hits`,
        `${singer} blockbuster hits`,
        `${singer} latest hits`
    ];

    let massiveList = [];
    const promises = queries.map(q => getAudioData(q).catch(() => []));
    const results = await Promise.all(promises);

    results.forEach(res => {
        if(res && res.length > 0) massiveList = massiveList.concat(res);
    });

    // Filter out exact duplicate songs
    massiveList = massiveList.filter((v,i,a) => a.findIndex(t => t.title === v.title) === i);
    
    // Shuffle the mega list so user doesn't always hear the exact same Top 5 hits first
    massiveList = shuffleArray(massiveList);

    if(massiveList.length > 0) {
        currentPlaylist = massiveList;
        renderPlaylistView(`👑 ${singer} Ultimate Hits (100+ Songs)`, currentPlaylist);
        updateQueueUI();
        playSongByIndex(0);
        showToast(`${massiveList.length} unique hit songs loaded! 🎉`);
    } else {
        resultsDiv.innerHTML = `<p style="text-align:center; color:var(--text-muted);">Could not fetch hit songs.</p>`;
    }
}

// Generic Spotify Style Mix Section Renderer
function renderMixSection(title, mixes) {
    const resultsDiv = document.getElementById('results');
    
    let html = `
        <div class="daily-mix-section">
            <h2 class="daily-mix-header">${title}</h2>
            <div class="scroll-wrapper">
                <button class="scroll-btn scroll-left" onclick="scrollRow(this, -1)"><i class="fas fa-chevron-left"></i></button>
                <div class="daily-mix-row scrollable-row">
    `;
    
    mixes.forEach(mix => {
        const grad = `linear-gradient(135deg, rgba(30,30,30,1), ${mix.color}40)`;
        let fullTitle = `${mix.badge} ${mix.num}`.replace(/'/g, "\\'");
        
        html += `
            <div class="daily-mix-card" onclick="fetchSongsAndShowList('${mix.q}', '${fullTitle}')">
                <div class="dm-img-container" style="background: ${grad};" id="dm-img-${mix.id}">
                    <div class="dm-badges">
                        <span class="dm-text-badge" style="color: ${mix.color};">${mix.badge}</span>
                        <span class="dm-num-badge" style="color: ${mix.color};">${mix.num}</span>
                    </div>
                    <div class="dm-play-btn"><i class="fas fa-play" style="margin-left: 4px;"></i></div>
                </div>
                <p>${mix.text}</p>
            </div>
        `;
    });
    html += `       </div>
                <button class="scroll-btn scroll-right" onclick="scrollRow(this, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>`;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    resultsDiv.appendChild(wrapper);

    // Fetch images dynamically
    mixes.forEach((mix, index) => {
        setTimeout(async () => {
            try {
                let data = await getAudioData(mix.q);
                if(data && data.length > 0) {
                    let imgDiv = document.getElementById(`dm-img-${mix.id}`);
                    if(imgDiv) {
                        // ENGINE FIX: Added lazy loading to dynamically inserted images
                        imgDiv.innerHTML += `<img src="${data[0].image}" loading="lazy" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; opacity:0; transition: opacity 0.5s; will-change: opacity;" onload="this.style.opacity=0.85">`;
                    }
                }
            } catch(e){}
        }, index * 100); // Reduced delay for faster population
    });
}

let autoPlayKeywords = [];

function renderQuickPicks(data) {
    const resultsDiv = document.getElementById('results');
    const maxItems = Math.min(data.length, 24);
    const qpSection = document.createElement('div');
    qpSection.className = 'quick-picks-section';
    
    let html = `
        <div class="quick-picks-header">
            <img src="https://i.pravatar.cc/100?img=11" alt="User" loading="lazy">
            <h2>Quick Picks For You</h2>
        </div>
        <div class="scroll-wrapper">
            <button class="scroll-btn scroll-left" onclick="scrollRow(this, -1)"><i class="fas fa-chevron-left"></i></button>
            <div class="quick-picks-wrapper scrollable-row">
                <div class="quick-picks-grid">
    `;

    for(let i = 0; i < maxItems; i++) {
        const song = data[i];
        html += `
            <div class="quick-pick-item" onclick="playFromQuickPicks(${i})">
                <div class="qp-img-wrapper">
                    <img src="${song.image}" loading="lazy" onerror="this.src='https://via.placeholder.com/48'">
                    <div class="qp-play-overlay"><i class="fas fa-play"></i></div>
                </div>
                <div class="quick-pick-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
            </div>
        `;
    }

    html += `           </div>
                </div>
            <button class="scroll-btn scroll-right" onclick="scrollRow(this, 1)"><i class="fas fa-chevron-right"></i></button>
        </div>`;
    qpSection.innerHTML = html;
    resultsDiv.appendChild(qpSection);
    window.quickPicksData = data.slice(0, maxItems);
}

function playFromQuickPicks(index) {
    if(window.quickPicksData) {
        currentPlaylist = window.quickPicksData;
        playSongByIndex(index);
    }
}

async function startRadio() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<div class="loader" style="margin: 50px auto;"></div>`;
    
    // Radio ke liye bilkul alag queries taaki hits repeat na hon
    const diverseVibes = [
        "Coke Studio Hits", "MTV Unplugged Hits", "Indie Pop Hits", 
        "Bollywood Lofi Hits", "Punjabi Acoustic Hits", "Sufi Bollywood Hits", 
        "90s Bollywood Romantic Hits", "Retro Classic Hits", "Ghazal Hits"
    ];
    
    let kws = [];
    
    // Mix user preferences with random diverse vibes
    if (likedSongs.length > 0) {
        const randomArtist = likedSongs[Math.floor(Math.random() * likedSongs.length)].artist;
        kws.push(`${randomArtist} unplugged hits`);
        kws.push(`${randomArtist} live hits`);
    } else if (searchHistory.length > 0) {
        kws.push(`${searchHistory[0]} mashup hits`);
    }
    
    // Fill the rest with completely random diverse vibes
    let shuffledVibes = shuffleArray(diverseVibes);
    kws = kws.concat(shuffledVibes.slice(0, 3));
    kws = shuffleArray(kws).slice(0, 4);

    let comb = []; 
    // ENGINE FIX: Fetch Radio stations in parallel
    let radioPromises = kws.map(kw => getAudioData(kw).catch(() => []));
    let radioResults = await Promise.all(radioPromises);
    
    radioResults.forEach(d => {
        // Take random 10 from each to ensure massive variety
        let shuffledD = shuffleArray(d).slice(0, 15);
        comb = comb.concat(shuffledD);
    });
    
    // Filter duplicates and shuffle entirely
    comb = comb.filter((v,i,a) => a.findIndex(t => t.title === v.title) === i).sort(() => 0.5 - Math.random());
    
    // ALSO filter out anything they just listened to recently to make it truly "fresh"
    const recentTitles = Object.keys(playHistory).map(k => k.split('-')[0]);
    let freshComb = comb.filter(c => !recentTitles.includes(c.title));

    // If filtering leaves too few, just use the mixed comb
    if(freshComb.length < 10) freshComb = comb;

    if(freshComb.length > 0) {
        currentPlaylist = freshComb.slice(0, 40); // limit to 40 max
        renderPlaylistView(`📻 Fresh Custom Radio Hits`, currentPlaylist);
        updateQueueUI(); playSongByIndex(0);
    } else {
        resultsDiv.innerHTML = "<p>Radio couldn't connect.</p>";
    }
}

async function generateAIDJPlaylist() {
    const resultsDiv = document.getElementById('results');
    
    resultsDiv.innerHTML = `
        <div class="ai-loader-container">
            <i class="fas fa-robot ai-brain"></i>
            <div class="ai-text">Finding new hit songs from your history...</div>
        </div>
    `;

    const recentSearches = searchHistory.slice(0, 5).join(", ") || "Bollywood, Pop, Chill";
    const topArtists = likedSongs.map(s => s.artist).slice(0, 5).join(", ") || "Arijit Singh, Shreya Ghoshal, Badshah";
    
    const systemPrompt = `You are an advanced music recommendation and playlist generation engine similar to Spotify.
OBJECTIVE: Analyze user listening behavior and generate personalized hit song recommendations.
USER DATA:
- Most played genres: ${recentSearches}
- Favorite artists: ${topArtists}
- Listening frequency: High
- Current mood: Upbeat/Discover

RECOMMENDATION MODEL: Use HYBRID APPROACH.
1. Match genre, tempo, mood.
2. Avoid repeating same artist more than 2 times.
3. Generate EXACTLY 10 recommended Indian/Global songs (real songs that exist on Apple Music/Spotify). Ensure they are popular hits.

OUTPUT FORMAT: YOU MUST RETURN ONLY VALID JSON. Do not include markdown formatting or backticks.
{
  "final_playlist": {
      "playlist_name": "Free AI Smart Hit Mix",
      "songs": [
  { "song_name": "Song Title", "artist": "Artist Name", "reason": "Why picked" }
      ]
  }
}`;

    const payload = {
        contents: [{ parts: [{ text: "Generate the hit playlist JSON now." }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { responseMimeType: "application/json" }
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
        const result = await fetchWithRetry(url, payload);
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if(!textResponse) throw new Error("Empty AI Response");
        
        const aiData = JSON.parse(textResponse);
        
        resultsDiv.innerHTML = `
            <div class="loader" style="margin: 50px auto;"></div>
        `;

        const finalPlayableList = [];
        // ENGINE FIX: Fetch AI tracks in parallel
        const aiPromises = aiData.final_playlist.songs.map(songObj => {
            const query = `${songObj.song_name} ${songObj.artist} hit`;
            return getAudioData(query).catch(() => []);
        });
        const aiResults = await Promise.all(aiPromises);
        
        aiResults.forEach(iData => {
            if(iData && iData.length > 0) finalPlayableList.push(iData[0]);
        });

        if(finalPlayableList.length > 0) {
            currentPlaylist = finalPlayableList;
            renderPlaylistView(`🤖 ${aiData.final_playlist.playlist_name}`, currentPlaylist);
            updateQueueUI();
            showToast("Free AI Playlist is ready! ✨");
        } else {
            throw new Error("No songs found.");
        }

    } catch(e) {
        console.error("AI DJ Error, using offline local fallback:", e);
        try {
            await generateLocalFallbackPlaylist();
        } catch(err) {
            resultsDiv.innerHTML = `<div style="text-align:center; padding:50px; color:#fff;">
                <i class="fas fa-exclamation-triangle" style="font-size:40px; color:#ff4500; margin-bottom:15px;"></i>
                <h3>Sorry, AI DJ couldn't connect.</h3>
                <p style="color:var(--text-muted); margin-top:10px;">Network issue. Please try again.</p>
            </div>`;
        }
    }
}

async function generateLocalFallbackPlaylist() {
    let keywords = ["Top Bollywood Hits", "Trending Songs"];
    if (searchHistory.length > 0) keywords.unshift(searchHistory[0] + " hits");
    if (likedSongs.length > 0) keywords.unshift(likedSongs[0].artist + " best hit songs");
    
    let combinedData = [];
    // ENGINE FIX: Fetch Local fallback tracks in parallel
    const fbPromises = keywords.slice(0, 3).map(kw => getAudioData(kw).catch(() => []));
    const fbResults = await Promise.all(fbPromises);
    
    fbResults.forEach(data => combinedData = combinedData.concat(data.slice(0, 5)));
    
    combinedData = combinedData.filter((v,i,a) => a.findIndex(t => (t.title === v.title)) === i).sort(() => 0.5 - Math.random());
    
    if(combinedData.length > 0) {
        currentPlaylist = combinedData;
        renderPlaylistView(`🤖 Free Smart Hit Mix (Offline)`, currentPlaylist);
        updateQueueUI();
        showToast("Smart Playlist is ready! ✨");
    } else {
        throw new Error("Local fallback failed");
    }
}

function renderPlaylistView(title, songsList) {
    const resultsDiv = document.getElementById('results');
    
    let html = `
        <button class="back-to-home-btn" onclick="loadHome(); setActive(document.querySelector('.menu-item'));">
            <i class="fas fa-arrow-left"></i> Back to Home
        </button>
        <div class="playlist-view-header">
            <img src="${songsList[0]?.image || 'https://via.placeholder.com/200'}" loading="lazy" class="playlist-view-cover">
            <div class="playlist-view-info">
                <h1 class="page-header-title">${title}</h1>
                <p class="playlist-view-meta"><b>Pro Music</b> &bull; ${songsList.length} hit songs</p>
                <div class="playlist-view-actions">
                    <button class="playlist-play-all-btn" onclick="playSongByIndex(0)"><i class="fas fa-play playlist-play-icon"></i></button>
                </div>
            </div>
        </div>
        <div class="song-list-container">
            <div style="display: flex; padding: 10px 15px; color: var(--text-muted); font-size: 13px; font-weight:700; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 15px; text-transform:uppercase;">
                <span style="width: 30px;">#</span>
                <span style="flex: 1;">Title</span>
                <span style="width: 50px; text-align: center;"><i class="far fa-clock"></i></span>
            </div>
    `;

    songsList.forEach((song, index) => {
        const isLiked = likedSongs.some(s => s.title === song.title && s.artist === song.artist);
        html += `
            <div class="song-list-row" onclick="playSongByIndex(${index})" id="song-row-${index}">
                <span class="song-num" style="width: 30px; color: var(--text-muted); font-size: 14px; font-weight:600;">${index + 1}</span>
                <img src="${song.image}" loading="lazy">
                <div class="song-list-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
                <div class="song-list-action">
                    <i class="fas fa-heart" style="color: ${isLiked ? 'var(--primary-color)' : 'transparent'}; font-size:16px;"></i>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    resultsDiv.innerHTML = html;
}

// --- NEW SEARCH RESULT VIEW ---
function renderSearchView(query, songsList) {
    const resultsDiv = document.getElementById('results');
    window.currentSearchData = songsList; 
    
    let html = `
        <button class="back-to-home-btn" onclick="loadHome(); setActive(document.querySelector('.menu-item'));">
            <i class="fas fa-arrow-left"></i> Back to Home
        </button>
        <h1 style="font-size: 36px; font-weight: 900; margin-bottom: 30px; color: #fff; letter-spacing: -1px;">Results for: '${query}'</h1>
        
        <div style="display: flex; gap: 30px; flex-wrap: wrap; margin-bottom: 50px;">
            
            <!-- Top Result Card -->
            <div class="top-result-card" onclick="playSearchResult(0)">
                <h3 style="margin-bottom: 25px; font-size: 22px; color: #fff; font-weight: 800;">Top Result</h3>
                <img src="${songsList[0].image}" loading="lazy" style="width: 130px; height: 130px; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); margin-bottom: 25px; object-fit: cover;">
                <h2 style="font-size: 32px; font-weight: 900; color: #fff; margin-bottom: 8px; letter-spacing: -1px;">${songsList[0].title}</h2>
                <p style="color: var(--text-muted); font-size: 16px; font-weight: 600; display: flex; align-items: center;">
                    ${songsList[0].artist} 
                    <span style="background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 20px; margin-left: 12px; font-size: 12px; font-weight: 700; color: #fff;">Hit Song</span>
                </p>
                <div class="play-btn" style="opacity: 1; transform: none; box-shadow: 0 10px 25px rgba(29, 185, 84, 0.5);"><i class="fas fa-play" style="margin-left: 4px;"></i></div>
            </div>

            <!-- Top Songs List -->
            <div style="flex: 2; min-width: 300px;">
                <h3 style="margin-bottom: 20px; font-size: 22px; color: #fff; font-weight: 800;">Songs</h3>
                <div class="song-list-container">
    `;

    const topSongs = songsList.slice(0, 4);
    topSongs.forEach((song, index) => {
        const isLiked = likedSongs.some(s => s.title === song.title && s.artist === song.artist);
        html += `
            <div class="song-list-row" onclick="playSearchResult(${index})" style="padding: 10px 15px; margin-bottom: 4px; background: rgba(255,255,255,0.03);">
                <img src="${song.image}" loading="lazy" style="width: 50px; height: 50px; border-radius: 6px;">
                <div class="song-list-info">
                    <h4 style="font-size: 16px;">${song.title}</h4>
                    <p style="font-size: 14px;">${song.artist}</p>
                </div>
                <div class="song-list-action">
                    <i class="fas fa-heart" style="color: ${isLiked ? 'var(--primary-color)' : 'rgba(255,255,255,0.3)'};"></i>
                </div>
            </div>
        `;
    });

    html += `
                </div>
            </div>
        </div>

        <!-- Related Playlists -->
        <div class="playlist-section">
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 20px; color: #fff;">Related Hit Playlists</h2>
            <div class="scroll-wrapper">
                <button class="scroll-btn scroll-left" onclick="scrollRow(this, -1)"><i class="fas fa-chevron-left"></i></button>
                <div class="results-row scrollable-row">
    `;

    const relatedMixes = songsList.slice(4, 14);
    relatedMixes.forEach((song) => {
        html += `
            <div class="song-card" onclick="fetchSongsAndShowList('${song.artist} best hit songs', '${song.artist} Hit Mix', false)">
                <img src="${song.image}" loading="lazy" style="border-radius: 8px;">
                <div class="play-btn"><i class="fas fa-play" style="margin-left:4px;"></i></div>
                <h3 style="font-size: 16px;">${song.artist} Hit Mix</h3>
                <p style="font-size: 13px;">Made for you</p>
            </div>
        `;
    });

    html += `
                </div>
                <button class="scroll-btn scroll-right" onclick="scrollRow(this, 1)"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

function playSearchResult(index) {
    currentPlaylist = window.currentSearchData;
    playSongByIndex(index);
}

function playFromRow(rowData, index) {
    currentPlaylist = rowData;
    playSongByIndex(index);
}

function filterByCategory(query, element) {
    document.getElementById('songInput').value = ""; 
    let textOnly = element.innerText.trim();
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    fetchSongsAndShowList(query, textOnly, false);
}

function searchMusic() {
    const query = document.getElementById('songInput').value;
    if (!query.trim()) return;
    saveToHistory(query); 
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    fetchSongsAndShowList(query, `Results for: ${query}`, true);
}

async function fetchSongsAndShowList(query, title, isSearch = false) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = loaderHTML; 
    const data = await getAudioData(query);
    
    if (data.length > 0) {
        if (isSearch) {
            renderSearchView(query, data);
        } else {
            currentPlaylist = data;
            renderPlaylistView(title, currentPlaylist);
            updateQueueUI();
        }
    } else {
        resultsDiv.innerHTML = "<p>No hit songs found. Try another search.</p>";
    }
}

function renderPills() {
    const container = document.getElementById('category-pills');
    
    const defaults = [
        { q: 'Podcasts', l: 'Podcasts' },
        { q: 'Sleep music', l: 'Sleep' },
        { q: 'Relaxing music', l: 'Relax' },
        { q: 'Romantic Hit Songs', l: 'Romance' },
        { q: 'Energizing hit music', l: 'Energize' },
        { q: 'Party Hit Songs', l: 'Party' },
        { q: 'Sad Hit Songs', l: 'Sad' },
        { q: 'Feel good hit music', l: 'Feel good' },
        { q: 'Commute hit music', l: 'Commute' },
        { q: 'Workout hit music', l: 'Workout' },
        { q: 'Focus hit music', l: 'Focus' }
    ];

    let html = '';
    defaults.forEach(d => {
        html += `<div class="pill" onclick="filterByCategory('${d.q}', this)">${d.l}</div>`;
    });
    container.innerHTML = html;
}

function saveToHistory(query) {
    const cleanQuery = query.replace(/(Songs|Hits|Bollywood)/ig, '').trim();
    if(cleanQuery.length > 2 && !searchHistory.includes(cleanQuery)) {
        searchHistory.unshift(cleanQuery); 
        if(searchHistory.length > 8) searchHistory.pop(); 
        SmartEngine.batchedSetItem('proMusicSearchHistory', JSON.stringify(searchHistory));
    }
}

