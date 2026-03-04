  // ==========================================
        // DEVICE INITIALIZATION & MEMORY STORAGE
        // ==========================================
        const DEVICE_INIT_KEY = 'proMusic_device_initialized_v2';
        
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
            setTimeout(() => { showToast("Welcome to Pro Music App! ✨"); }, 1500);
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
        
        // ENGINE OPTIMIZATION: In-memory cache for API requests to eliminate redundant loading
        const apiCache = new Map();
        
        let isShuffle = false;
        let repeatMode = 0; 
        let preMuteVolume = 1;
        let isQueueOpen = false;

        let is4DMode = false;
        let isHDMode = false;
        let audioCtx, track, panner, fourDFilter, trebleNode, bassNode, panInterval, convolver, dryGain, wetGain;
        let analyser, visualizerDataArray, visualizerBufferLength, visualizerAnimationId;

        // PWA Install Variable
        let deferredPrompt;

        const loaderHTML = `<div class="loader" style="margin: 50px auto;"></div>`;

        // ==========================================
        // PWA INSTALLATION SETUP
        // ==========================================
        
        const manifestData = {
            "name": "Pro Music Player",
            "short_name": "Pro Music",
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
            showToast("Pro Music installed successfully! 🎉");
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

        // JS for Scroll Buttons
        function scrollRow(btnElement, direction) {
            const container = btnElement.parentElement.querySelector('.scrollable-row');
            if(container) {
                const scrollAmount = 350; 
                container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
            }
        }

        // --- SMART RECOMMENDATION ENGINE ---
        function trackSongPlay(song) {
            const id = song.title + "-" + song.artist;
            if(!playHistory[id]) {
                playHistory[id] = { ...song, playCount: 0, firstPlayed: Date.now() };
            }
            playHistory[id].playCount += 1;
            playHistory[id].lastPlayed = Date.now();
            memStorage.setItem('proMusicPlayHistory', JSON.stringify(playHistory));
        }

        function getUserProfile() {
            const historyVals = Object.values(playHistory);
            const artists = {};
            const keywords = {};
            historyVals.forEach(s => {
                artists[s.artist] = (artists[s.artist] || 0) + s.playCount;
                const words = (s.title + " " + s.artist).split(' ');
                words.forEach(w => {
                    if(w.length > 3) keywords[w.toLowerCase()] = (keywords[w.toLowerCase()] || 0) + s.playCount;
                });
            });
            
            // Limit increased to 10 to better support dynamic singer playlists
            const topArtists = Object.keys(artists).sort((a,b) => artists[b] - artists[a]).slice(0, 10);
            const topKeywords = Object.keys(keywords).sort((a,b) => keywords[b] - keywords[a]).slice(0, 15);
            
            return { topArtists, topKeywords, historyVals };
        }

        function calculateSongScore(song, userProfile, hour) {
            const historyData = playHistory[song.title + "-" + song.artist];
            const playCountScore = historyData ? Math.min(historyData.playCount / 20, 1.0) : 0;
            let recentPlayWeight = 0;
            if (historyData) {
                const hoursSincePlay = (Date.now() - historyData.lastPlayed) / (1000 * 60 * 60);
                recentPlayWeight = Math.max(1.0 - (hoursSincePlay / 48), 0);
            }
            
            let genreMatch = 0;
            const songString = (song.title + " " + song.artist).toLowerCase();
            userProfile.topKeywords.forEach(kw => {
                if(songString.includes(kw)) genreMatch += 0.15;
            });
            genreMatch = Math.min(genreMatch, 1.0);
            
            let timeMatch = 0.5; 
            const isUpbeat = ['remix', 'party', 'dance', 'pop', 'bass', 'workout', 'hit'].some(w => songString.includes(w));
            const isChill = ['lofi', 'chill', 'sleep', 'relax', 'sad', 'romantic', 'love'].some(w => songString.includes(w));
            if ((hour >= 5 && hour <= 11) && isUpbeat) timeMatch = 1.0; 
            if ((hour >= 22 || hour <= 4) && isChill) timeMatch = 1.0;  
            if ((hour >= 17 && hour <= 20) && isUpbeat) timeMatch = 1.0; 
            
            let newReleaseBoost = (!historyData && genreMatch > 0.3) ? 1.0 : 0.0;
            return (playCountScore * 0.4) + (recentPlayWeight * 0.3) + (genreMatch * 0.1) + (timeMatch * 0.1) + (newReleaseBoost * 0.1);
        }

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
                        if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                    }
                } catch(e) {}
            }
        });

        // Save current state helper
        function saveCurrentState() {
            if (currentPlaylist.length > 0 && currentSongIndex >= 0 && !isNaN(audioEl.currentTime)) {
                const state = {
                    playlist: currentPlaylist,
                    index: currentSongIndex,
                    currentTime: audioEl.currentTime,
                    duration: audioEl.duration || 0
                };
                memStorage.setItem('proMusicLastState', JSON.stringify(state));
            }
        }

        // Multiple event listeners to ensure state is saved heavily on mobile APKs
        window.addEventListener('beforeunload', saveCurrentState);
        window.addEventListener('pagehide', saveCurrentState);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') saveCurrentState();
        });

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
                <div style="display:flex; gap: 24px; margin-bottom: 30px; align-items: flex-end; flex-wrap: wrap;">
                    <img src="${songsList[0]?.image || 'https://via.placeholder.com/200'}" loading="lazy" style="width: 220px; height: 220px; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); object-fit: cover;">
                    <div style="flex: 1;">
                        <h1 style="font-size: 50px; font-weight: 900; margin: 8px 0 15px 0; color: #fff; text-shadow: 0 4px 15px rgba(0,0,0,0.5); display:block; letter-spacing: -1px;">${title}</h1>
                        <p style="color:var(--text-muted); font-size: 15px; font-weight:500;"><b>Pro Music</b> • ${songsList.length} hit songs</p>
                        <div style="margin-top: 25px; display: flex; gap: 15px; align-items: center;">
                            <button onclick="playSongByIndex(0)" style="width: 60px; height: 60px; border-radius: 50%; background: var(--primary-color); border: none; font-size: 22px; cursor: pointer; color: #000; box-shadow: 0 8px 25px rgba(29, 185, 84, 0.4); display: flex; justify-content: center; align-items: center; transition: 0.3s; will-change: transform;"><i class="fas fa-play" style="margin-left: 4px;"></i></button>
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
                memStorage.setItem('proMusicSearchHistory', JSON.stringify(searchHistory));
            }
        }

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
                track.connect(analyser).connect(trebleNode).connect(bassNode).connect(fourDFilter).connect(panner);
                
                panner.connect(dryGain).connect(audioCtx.destination);
                panner.connect(convolver).connect(wetGain).connect(audioCtx.destination);
                
                // Start the visualizer loop
                drawVisualizer();
            } catch (err) {
                console.warn("Web Audio API CORS Error", err);
            }
        }

        // Live Audio Visualizer Drawing Loop
        function drawVisualizer() {
            visualizerAnimationId = requestAnimationFrame(drawVisualizer);
            
            if(!analyser) return;
            const canvas = document.getElementById('audio-visualizer');
            if(!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Match canvas internal resolution to display size
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            
            analyser.getByteFrequencyData(visualizerDataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / visualizerBufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for(let i = 0; i < visualizerBufferLength; i++) {
                barHeight = visualizerDataArray[i];
                
                // Creating a sleek green-to-white gradient for the bars
                let r = barHeight + (25 * (i/visualizerBufferLength));
                let g = 255;
                let b = 100;
                
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, canvas.height - barHeight + 50, barWidth, barHeight);
                
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
                    album: 'Pro Music',
                    artwork: [ { src: song.image, sizes: '300x300', type: 'image/jpeg' } ]
                });
                navigator.mediaSession.setActionHandler('play', togglePlay);
                navigator.mediaSession.setActionHandler('pause', togglePlay);
                navigator.mediaSession.setActionHandler('previoustrack', prevSong);
                navigator.mediaSession.setActionHandler('nexttrack', nextSong);
            }
        }

        // --- PLAYBACK ENGINE ---
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
            if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-spinner fa-spin'></i>";

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
            if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-pause'></i>";
            
            const state = { playlist: currentPlaylist, index: currentSongIndex, currentTime: 0 };
            memStorage.setItem('proMusicLastState', JSON.stringify(state));

            if (!isQueueOpen && window.innerWidth > 900) toggleQueue();
            updateQueueUI(); 
            highlightVerticalListSong(index); 
            if(immersivePlayer.classList.contains('open')) updateImmersivePanel();
            
            updateMediaSession(song); 
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
                if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-pause'></i>";
            } else {
                audioEl.pause();
                playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
            }
            
            if (currentPlaylist.length > 0 && currentSongIndex >= 0) {
                memStorage.setItem('proMusicLastState', JSON.stringify({
                    playlist: currentPlaylist,
                    index: currentSongIndex,
                    currentTime: audioEl.currentTime
                }));
            }
        }

        function nextSong() {
            if(currentPlaylist.length === 0) return;
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
                        if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                    }
                } else {
                    audioEl.pause(); 
                    playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                    if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                }
            } catch (err) {
                audioEl.pause(); 
                playPauseBtn.innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
                if(document.getElementById('imm-play-pause-btn')) document.getElementById('imm-play-pause-btn').innerHTML = "<i class='fas fa-play' style='margin-left: 3px;'></i>";
            }
        }

        function prevSong() {
            if (currentPlaylist.length > 0 && currentSongIndex > 0) {
                if(audioEl.currentTime > 3) audioEl.currentTime = 0;
                else playSongByIndex(currentSongIndex - 1);
            } else if (currentSongIndex === 0) audioEl.currentTime = 0;
        }

        audioEl.addEventListener('ended', () => {
            if (repeatMode === 2) { audioEl.currentTime = 0; audioEl.play(); } 
            else { nextSong(); }
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
            }
            memStorage.setItem('proMusicLikedSongs', JSON.stringify(likedSongs));
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

        function showLikedSongs() {
            currentPlaylist = likedSongs; 
            if(likedSongs.length > 0) renderPlaylistView("Liked Songs ❤️", likedSongs);
            else document.getElementById('results').innerHTML = "<p style='padding:20px; color:gray;'>Koi gaana pasand nahi kiya gaya.</p>";
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
            
            let html = `<h1 style="font-size: 36px; font-weight: 900; margin-bottom: 30px; color: #fff; letter-spacing: -1px;">Library 📚</h1>`;

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
            memStorage.setItem('proMusicDownloadedSongs', JSON.stringify(downloadedSongs));
            
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
            memStorage.setItem('proMusicUserPlaylists', JSON.stringify(userPlaylists));
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
                memStorage.setItem('proMusicUserPlaylists', JSON.stringify(userPlaylists));
                showToast(`Gana '${playlistName}' mein jod diya gaya! ✅`);
                
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

        function updateQueueUI() {
            queueList.innerHTML = "";
            const immersiveQueueList = document.getElementById('immersive-queue-list');
            if (immersiveQueueList) immersiveQueueList.innerHTML = "";

            if(currentPlaylist.length === 0) {
                queueList.innerHTML = "<p style='color:gray; font-size:14px;'>Queue is empty.</p>"; 
                if(immersiveQueueList) immersiveQueueList.innerHTML = "<p style='color:gray; font-size:14px;'>Queue is empty.</p>";
                return;
            }
            currentPlaylist.forEach((song, index) => {
                let div = document.createElement('div');
                div.className = `queue-item ${index === currentSongIndex ? 'active-queue' : ''}`;
                div.onclick = () => { playSongByIndex(index); };
                
                div.innerHTML = `
                    <img src="${song.image}" loading="lazy" onerror="this.src='https://via.placeholder.com/40'">
                    <div class="queue-item-info">
                        <h4 style="color: ${index === currentSongIndex ? 'var(--primary-color)' : '#fff'}">${song.title}</h4>
                        <p>${song.artist}</p>
                    </div>
                    ${index === currentSongIndex ? '<i class="fas fa-volume-up" style="margin-left:auto; color: var(--primary-color); font-size: 14px;"></i>' : ''}
                `;
                queueList.appendChild(div);

                // Immersive kyu (Right side PC view)
                if(immersiveQueueList) {
                    let imDiv = document.createElement('div');
                    imDiv.className = `queue-item ${index === currentSongIndex ? 'active-queue' : ''}`;
                    imDiv.style.background = index === currentSongIndex ? 'rgba(29, 185, 84, 0.2)' : 'transparent';
                    imDiv.onclick = () => { playSongByIndex(index); };
                    imDiv.innerHTML = div.innerHTML;
                    immersiveQueueList.appendChild(imDiv);
                }
            });
            const activeQueueItem = document.querySelector('.active-queue');
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

        audioEl.addEventListener('timeupdate', () => {
            if(isNaN(audioEl.duration)) return;
            
            const percent = (audioEl.currentTime / audioEl.duration) * 100;
            
            // Desktop Progress Bar Sync
            progressBar.value = percent;
            progressFill.style.width = `${percent}%`;
            progressThumb.style.left = `${percent}%`;
            document.getElementById('current-time').innerText = formatTime(audioEl.currentTime);
            document.getElementById('total-time').innerText = formatTime(audioEl.duration);

            // Mobile Immersive Progress Bar Sync
            const immProgressBar = document.getElementById('imm-progress-bar');
            if(immProgressBar) {
                immProgressBar.value = percent;
                document.getElementById('imm-progress-fill').style.width = `${percent}%`;
                document.getElementById('imm-progress-thumb').style.left = `${percent}%`;
                document.getElementById('imm-current-time').innerText = formatTime(audioEl.currentTime);
                document.getElementById('imm-total-time').innerText = formatTime(audioEl.duration);
            }

            // --- Frequent Save for Accurate Resume ---
            // Ab har 1 second mein exact position save hogi taaki app crash/close hone par bhi wahi se start ho
            if (Math.floor(audioEl.currentTime) % 1 === 0 && currentPlaylist.length > 0) {
                saveCurrentState();
            }
        });

        // --- MOBILE SWIPE GESTURES ---
        let touchstartX = 0;
        let touchstartY = 0;
        
        // Mini Player Swipe
        const bottomPlayerArea = document.getElementById('bottom-player-area');
        bottomPlayerArea.addEventListener('touchstart', e => { 
            touchstartX = e.changedTouches[0].screenX; 
            touchstartY = e.changedTouches[0].screenY;
        });
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
        });
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
            toastEl.innerText = message;
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
            }
        });
