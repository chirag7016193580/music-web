// ==========================================
// SPOTIFY-LEVEL SMART MUSIC RECOMMENDATION ENGINE
// Deep Logic: 12-Module System
// ==========================================

// --- MODULE 0: Extended Data Storage ---
let skipHistory = JSON.parse(memStorage.getItem('proMusicSkipHistory')) || {};
let replayHistory = JSON.parse(memStorage.getItem('proMusicReplayHistory')) || {};
let listenDuration = JSON.parse(memStorage.getItem('proMusicListenDuration')) || {};
let playlistAdditions = JSON.parse(memStorage.getItem('proMusicPlaylistAdditions')) || {};
let listeningTimePatterns = JSON.parse(memStorage.getItem('proMusicTimePatterns')) || { morning: 0, afternoon: 0, evening: 0, night: 0, latenight: 0 };
let songFeatureCache = JSON.parse(memStorage.getItem('proMusicSongFeatures')) || {};
let collaborativeData = JSON.parse(memStorage.getItem('proMusicCollaborativeData')) || { similarUsers: [], sharedSongs: [] };
let userTasteVector = JSON.parse(memStorage.getItem('proMusicTasteVector')) || null;
let recommendationHistory = JSON.parse(memStorage.getItem('proMusicRecHistory')) || [];

// --- MODULE 1: USER DATA COLLECTION (Enhanced) ---
function trackSongPlay(song) {
    const id = song.title + "-" + song.artist;
    if(!playHistory[id]) {
        playHistory[id] = { ...song, playCount: 0, firstPlayed: Date.now(), skipCount: 0, replayCount: 0, totalListenTime: 0 };
    }
    playHistory[id].playCount += 1;
    playHistory[id].lastPlayed = Date.now();
    SmartEngine.batchedSetItem('proMusicPlayHistory', JSON.stringify(playHistory));

    // Track listening time patterns
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) listeningTimePatterns.morning++;
    else if (hour >= 12 && hour < 17) listeningTimePatterns.afternoon++;
    else if (hour >= 17 && hour < 21) listeningTimePatterns.evening++;
    else if (hour >= 21 || hour < 2) listeningTimePatterns.night++;
    else listeningTimePatterns.latenight++;
    SmartEngine.batchedSetItem('proMusicTimePatterns', JSON.stringify(listeningTimePatterns));

    // Auto-analyze song features
    analyzeSongFeatures(song);

    // Update taste vector dynamically (Feedback Loop)
    updateTasteVector(song, 'play');
}

function trackSongSkip(song) {
    const id = song.title + "-" + song.artist;
    if (!skipHistory[id]) skipHistory[id] = 0;
    skipHistory[id]++;
    if (playHistory[id]) playHistory[id].skipCount = (playHistory[id].skipCount || 0) + 1;
    SmartEngine.batchedSetItem('proMusicSkipHistory', JSON.stringify(skipHistory));
    SmartEngine.batchedSetItem('proMusicPlayHistory', JSON.stringify(playHistory));
    updateTasteVector(song, 'skip');
}

function trackSongReplay(song) {
    const id = song.title + "-" + song.artist;
    if (!replayHistory[id]) replayHistory[id] = 0;
    replayHistory[id]++;
    if (playHistory[id]) playHistory[id].replayCount = (playHistory[id].replayCount || 0) + 1;
    SmartEngine.batchedSetItem('proMusicReplayHistory', JSON.stringify(replayHistory));
    SmartEngine.batchedSetItem('proMusicPlayHistory', JSON.stringify(playHistory));
    updateTasteVector(song, 'replay');
}

function trackListenDuration(song, duration) {
    const id = song.title + "-" + song.artist;
    if (!listenDuration[id]) listenDuration[id] = 0;
    listenDuration[id] += duration;
    if (playHistory[id]) playHistory[id].totalListenTime = (playHistory[id].totalListenTime || 0) + duration;
    SmartEngine.batchedSetItem('proMusicListenDuration', JSON.stringify(listenDuration));
    SmartEngine.batchedSetItem('proMusicPlayHistory', JSON.stringify(playHistory));
}

function trackPlaylistAddition(song, playlistName) {
    const id = song.title + "-" + song.artist;
    if (!playlistAdditions[id]) playlistAdditions[id] = [];
    if (!playlistAdditions[id].includes(playlistName)) playlistAdditions[id].push(playlistName);
    SmartEngine.batchedSetItem('proMusicPlaylistAdditions', JSON.stringify(playlistAdditions));
    updateTasteVector(song, 'playlist_add');
}

// --- MODULE 2: SONG FEATURE ANALYSIS ---
function analyzeSongFeatures(song) {
    const id = song.title + "-" + song.artist;
    if (songFeatureCache[id]) return songFeatureCache[id];

    const titleLower = (song.title + " " + song.artist).toLowerCase();

    // Estimate tempo from keywords
    let tempo = 110;
    if (['dance', 'party', 'club', 'remix', 'edm', 'bass'].some(w => titleLower.includes(w))) tempo = 128;
    else if (['lofi', 'chill', 'sleep', 'relax', 'ambient'].some(w => titleLower.includes(w))) tempo = 80;
    else if (['rock', 'metal', 'punk'].some(w => titleLower.includes(w))) tempo = 140;
    else if (['ballad', 'romantic', 'slow'].some(w => titleLower.includes(w))) tempo = 72;
    else if (['rap', 'hip hop', 'trap'].some(w => titleLower.includes(w))) tempo = 95;

    // Estimate energy level
    let energy = 0.5;
    if (['party', 'dance', 'club', 'remix', 'bass', 'workout', 'rock', 'metal', 'edm'].some(w => titleLower.includes(w))) energy = 0.85;
    else if (['lofi', 'chill', 'sleep', 'relax', 'ambient', 'acoustic'].some(w => titleLower.includes(w))) energy = 0.25;
    else if (['sad', 'heartbreak', 'breakup', 'emotional'].some(w => titleLower.includes(w))) energy = 0.35;
    else if (['pop', 'hit', 'viral'].some(w => titleLower.includes(w))) energy = 0.65;

    // Estimate danceability
    let danceability = 0.5;
    if (['dance', 'party', 'club', 'remix', 'dj', 'bhangra'].some(w => titleLower.includes(w))) danceability = 0.9;
    else if (['lofi', 'chill', 'sleep', 'sad', 'ballad'].some(w => titleLower.includes(w))) danceability = 0.2;

    // Detect mood
    let mood = 'neutral';
    if (['happy', 'party', 'dance', 'celebration', 'fun', 'joy'].some(w => titleLower.includes(w))) mood = 'happy';
    else if (['sad', 'heartbreak', 'breakup', 'cry', 'pain', 'miss', 'alone'].some(w => titleLower.includes(w))) mood = 'sad';
    else if (['chill', 'lofi', 'relax', 'peaceful', 'calm', 'sleep'].some(w => titleLower.includes(w))) mood = 'chill';
    else if (['aggressive', 'rage', 'angry', 'metal', 'rock', 'hard'].some(w => titleLower.includes(w))) mood = 'aggressive';
    else if (['romantic', 'love', 'pyaar', 'ishq', 'dil'].some(w => titleLower.includes(w))) mood = 'romantic';

    // Detect genre
    let genre = 'bollywood';
    if (['edm', 'electronic', 'trance', 'house', 'techno'].some(w => titleLower.includes(w))) genre = 'edm';
    else if (['pop', 'western', 'english'].some(w => titleLower.includes(w))) genre = 'pop';
    else if (['lofi', 'lo-fi'].some(w => titleLower.includes(w))) genre = 'lofi';
    else if (['rap', 'hip hop', 'hip-hop'].some(w => titleLower.includes(w))) genre = 'hiphop';
    else if (['rock', 'metal'].some(w => titleLower.includes(w))) genre = 'rock';
    else if (['classical', 'ghazal', 'sufi', 'qawwali'].some(w => titleLower.includes(w))) genre = 'classical';
    else if (['punjabi', 'bhangra'].some(w => titleLower.includes(w))) genre = 'punjabi';
    else if (['tamil', 'telugu', 'south', 'kollywood', 'tollywood'].some(w => titleLower.includes(w))) genre = 'south_indian';

    // Estimate acousticness and instrumentalness
    let acousticness = 0.3;
    if (['acoustic', 'unplugged', 'live'].some(w => titleLower.includes(w))) acousticness = 0.8;
    let instrumentalness = 0.1;
    if (['instrumental', 'karaoke', 'beats only'].some(w => titleLower.includes(w))) instrumentalness = 0.9;

    // Vocal type detection
    let vocalType = 'mixed';
    if (['duet', 'duo'].some(w => titleLower.includes(w))) vocalType = 'duet';
    else if (['female', 'shreya', 'neha', 'sunidhi', 'lata', 'asha', 'alka'].some(w => titleLower.includes(w))) vocalType = 'female';
    else if (['male', 'arijit', 'kishore', 'sonu', 'atif', 'mohd'].some(w => titleLower.includes(w))) vocalType = 'male';

    // Popularity score (normalized from play history)
    const histData = playHistory[id];
    let popularityScore = 0.5;
    if (histData) {
        popularityScore = Math.min((histData.playCount / 10) * 0.3 + 0.5, 1.0);
    }

    const features = {
        tempo, energy, danceability, mood, genre,
        acousticness, instrumentalness, vocalType, popularityScore,
        releaseYear: new Date().getFullYear(),
        analyzedAt: Date.now()
    };

    songFeatureCache[id] = features;
    SmartEngine.batchedSetItem('proMusicSongFeatures', JSON.stringify(songFeatureCache));
    return features;
}

// --- MODULE 3: USER TASTE MODEL (Taste Vector) ---
function buildTasteVector() {
    const historyVals = Object.values(playHistory);
    if (historyVals.length === 0) return getDefaultTasteVector();

    // Genre vector: count plays per genre weighted by engagement
    const genreCounts = {};
    const moodCounts = {};
    let tempoSum = 0, tempoCount = 0;
    let energySum = 0, energyCount = 0;
    let danceabilitySum = 0, danceCount = 0;
    const artistCounts = {};

    historyVals.forEach(s => {
        const id = s.title + "-" + s.artist;
        const features = songFeatureCache[id] || analyzeSongFeatures(s);
        const weight = getEngagementWeight(s);

        genreCounts[features.genre] = (genreCounts[features.genre] || 0) + weight;
        moodCounts[features.mood] = (moodCounts[features.mood] || 0) + weight;
        tempoSum += features.tempo * weight;
        tempoCount += weight;
        energySum += features.energy * weight;
        energyCount += weight;
        danceabilitySum += features.danceability * weight;
        danceCount += weight;
        artistCounts[s.artist] = (artistCounts[s.artist] || 0) + weight;
    });

    // Normalize genre vector
    const totalGenreWeight = Object.values(genreCounts).reduce((a, b) => a + b, 0) || 1;
    const genreVector = {};
    Object.keys(genreCounts).forEach(g => genreVector[g] = genreCounts[g] / totalGenreWeight);

    // Normalize mood vector
    const totalMoodWeight = Object.values(moodCounts).reduce((a, b) => a + b, 0) || 1;
    const moodVector = {};
    Object.keys(moodCounts).forEach(m => moodVector[m] = moodCounts[m] / totalMoodWeight);

    const tasteVector = {
        genre_vector: genreVector,
        mood_vector: moodVector,
        tempo_range: { avg: tempoCount > 0 ? tempoSum / tempoCount : 110, min: 70, max: 160 },
        energy_preference: energyCount > 0 ? energySum / energyCount : 0.5,
        danceability_preference: danceCount > 0 ? danceabilitySum / danceCount : 0.5,
        top_artists: Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a]).slice(0, 15),
        preferred_moods: Object.keys(moodCounts).sort((a, b) => moodCounts[b] - moodCounts[a]).slice(0, 3),
        listening_time_patterns: { ...listeningTimePatterns },
        skip_rate: calculateSkipRate(),
        replay_rate: calculateReplayRate(),
        lastUpdated: Date.now()
    };

    userTasteVector = tasteVector;
    SmartEngine.batchedSetItem('proMusicTasteVector', JSON.stringify(tasteVector));
    return tasteVector;
}

function getDefaultTasteVector() {
    return {
        genre_vector: { bollywood: 0.4, pop: 0.2, punjabi: 0.15, lofi: 0.1, hiphop: 0.1, classical: 0.05 },
        mood_vector: { happy: 0.3, romantic: 0.25, chill: 0.2, sad: 0.15, neutral: 0.1 },
        tempo_range: { avg: 110, min: 70, max: 150 },
        energy_preference: 0.55,
        danceability_preference: 0.5,
        top_artists: ['Arijit Singh', 'Shreya Ghoshal', 'Diljit Dosanjh', 'Atif Aslam', 'Kishore Kumar'],
        preferred_moods: ['happy', 'romantic', 'chill'],
        listening_time_patterns: { morning: 1, afternoon: 1, evening: 1, night: 1, latenight: 0 },
        skip_rate: 0,
        replay_rate: 0,
        lastUpdated: Date.now()
    };
}

function getEngagementWeight(song) {
    const id = song.title + "-" + song.artist;
    let weight = song.playCount || 1;
    // Boost for likes
    if (likedSongs.some(s => s.title === song.title && s.artist === song.artist)) weight *= 1.5;
    // Boost for replays
    if (replayHistory[id]) weight *= (1 + Math.min(replayHistory[id] * 0.2, 1.0));
    // Penalty for skips
    if (skipHistory[id]) weight *= Math.max(0.3, 1 - (skipHistory[id] * 0.15));
    // Recency boost
    if (song.lastPlayed) {
        const hoursSince = (Date.now() - song.lastPlayed) / (1000 * 60 * 60);
        weight *= Math.max(0.5, 1 - (hoursSince / 168)); // Decay over a week
    }
    return weight;
}

function calculateSkipRate() {
    const total = Object.values(playHistory).reduce((sum, s) => sum + (s.playCount || 0), 0);
    const skips = Object.values(skipHistory).reduce((sum, v) => sum + v, 0);
    return total > 0 ? skips / total : 0;
}

function calculateReplayRate() {
    const total = Object.values(playHistory).reduce((sum, s) => sum + (s.playCount || 0), 0);
    const replays = Object.values(replayHistory).reduce((sum, v) => sum + v, 0);
    return total > 0 ? replays / total : 0;
}

// --- MODULE 10: FEEDBACK LOOP ---
function updateTasteVector(song, action) {
    if (!userTasteVector) userTasteVector = buildTasteVector();
    const features = songFeatureCache[song.title + "-" + song.artist] || analyzeSongFeatures(song);

    const learningRate = 0.05;
    let direction = 0;
    switch (action) {
        case 'play': direction = 0.3; break;
        case 'like': direction = 1.0; break;
        case 'skip': direction = -0.5; break;
        case 'replay': direction = 1.5; break;
        case 'playlist_add': direction = 0.8; break;
        default: direction = 0.1;
    }

    // Adjust genre vector
    if (features.genre && userTasteVector.genre_vector) {
        const current = userTasteVector.genre_vector[features.genre] || 0;
        userTasteVector.genre_vector[features.genre] = Math.max(0, Math.min(1, current + (learningRate * direction)));
        // Renormalize
        const total = Object.values(userTasteVector.genre_vector).reduce((a, b) => a + b, 0) || 1;
        Object.keys(userTasteVector.genre_vector).forEach(g => userTasteVector.genre_vector[g] /= total);
    }

    // Adjust mood vector
    if (features.mood && userTasteVector.mood_vector) {
        const current = userTasteVector.mood_vector[features.mood] || 0;
        userTasteVector.mood_vector[features.mood] = Math.max(0, Math.min(1, current + (learningRate * direction)));
        const total = Object.values(userTasteVector.mood_vector).reduce((a, b) => a + b, 0) || 1;
        Object.keys(userTasteVector.mood_vector).forEach(m => userTasteVector.mood_vector[m] /= total);
    }

    // Adjust energy preference
    userTasteVector.energy_preference = Math.max(0, Math.min(1,
        userTasteVector.energy_preference + (learningRate * direction * (features.energy - userTasteVector.energy_preference))
    ));

    userTasteVector.lastUpdated = Date.now();
    SmartEngine.batchedSetItem('proMusicTasteVector', JSON.stringify(userTasteVector));
}

// --- MODULE 4: COLLABORATIVE FILTERING ---
function getCollaborativeRecommendations(userProfile) {
    // Simulate collaborative filtering using local data:
    // Find "similar user" patterns from playlist and liked songs overlap
    const myLikedTitles = new Set(likedSongs.map(s => s.title.toLowerCase()));
    const myArtists = new Set(userProfile.topArtists.map(a => a.toLowerCase()));

    // Build virtual "similar users" from play history clusters
    const artistClusters = {};
    Object.values(playHistory).forEach(s => {
        const artist = s.artist;
        if (!artistClusters[artist]) artistClusters[artist] = [];
        artistClusters[artist].push(s);
    });

    // Songs from artists user likes but hasn't played much (collaborative signal)
    let collaborativeSongs = [];
    Object.keys(artistClusters).forEach(artist => {
        const songs = artistClusters[artist];
        const unplayed = songs.filter(s => (s.playCount || 0) <= 1);
        if (myArtists.has(artist.toLowerCase()) && unplayed.length > 0) {
            collaborativeSongs = collaborativeSongs.concat(unplayed);
        }
    });

    // Also recommend songs from genres the user likes but from new artists
    const tasteVector = userTasteVector || buildTasteVector();
    const topGenres = Object.keys(tasteVector.genre_vector)
        .sort((a, b) => tasteVector.genre_vector[b] - tasteVector.genre_vector[a])
        .slice(0, 3);

    Object.values(playHistory).forEach(s => {
        const features = songFeatureCache[s.title + "-" + s.artist];
        if (features && topGenres.includes(features.genre) && !myArtists.has(s.artist.toLowerCase())) {
            collaborativeSongs.push(s);
        }
    });

    return collaborativeSongs;
}

// --- MODULE 5: CONTENT-BASED FILTERING ---
function getContentBasedSimilarity(songA, songB) {
    const featA = songFeatureCache[songA.title + "-" + songA.artist] || analyzeSongFeatures(songA);
    const featB = songFeatureCache[songB.title + "-" + songB.artist] || analyzeSongFeatures(songB);

    // Genre similarity (1.0 if same, 0.3 if related, 0.0 if different)
    const genreRelations = {
        'bollywood': ['pop', 'romantic', 'classical'],
        'pop': ['bollywood', 'edm'],
        'edm': ['pop', 'hiphop'],
        'hiphop': ['edm', 'punjabi'],
        'punjabi': ['bollywood', 'hiphop'],
        'lofi': ['chill', 'classical'],
        'rock': ['metal', 'pop'],
        'classical': ['bollywood', 'lofi'],
        'south_indian': ['bollywood', 'classical']
    };
    let genreSim = 0;
    if (featA.genre === featB.genre) genreSim = 1.0;
    else if (genreRelations[featA.genre] && genreRelations[featA.genre].includes(featB.genre)) genreSim = 0.5;

    // Tempo similarity (inverse of normalized difference)
    const tempoSim = 1 - Math.min(Math.abs(featA.tempo - featB.tempo) / 80, 1);

    // Energy similarity
    const energySim = 1 - Math.abs(featA.energy - featB.energy);

    // Mood similarity
    const moodSim = featA.mood === featB.mood ? 1.0 : 0.2;

    // Artist similarity
    const artistSim = songA.artist === songB.artist ? 1.0 : 0.0;

    // Danceability similarity
    const danceSim = 1 - Math.abs(featA.danceability - featB.danceability);

    // Weighted similarity formula
    const similarity = (
        genreSim * 0.30 +
        tempoSim * 0.15 +
        energySim * 0.20 +
        moodSim * 0.15 +
        artistSim * 0.10 +
        danceSim * 0.10
    );

    return Math.min(Math.max(similarity, 0), 1);
}

function getContentBasedRecommendations(referenceSong, candidateList) {
    return candidateList.map(song => ({
        ...song,
        contentSimilarity: getContentBasedSimilarity(referenceSong, song)
    })).sort((a, b) => b.contentSimilarity - a.contentSimilarity);
}

// --- MODULE 6: TREND ANALYSIS ---
function calculateTrendingScore(song) {
    const id = song.title + "-" + song.artist;
    const histData = playHistory[id];

    // Play count factor
    const playCount = histData ? histData.playCount : 0;
    const playCountScore = Math.min(playCount / 30, 1.0);

    // Growth rate: compare recent plays vs older plays
    let growthRate = 0;
    if (histData && histData.firstPlayed && histData.lastPlayed) {
        const daysSinceFirst = (Date.now() - histData.firstPlayed) / (1000 * 60 * 60 * 24);
        if (daysSinceFirst > 0) {
            growthRate = Math.min(playCount / daysSinceFirst, 5) / 5;
        }
    }

    // Playlist appearances count
    const playlistCount = playlistAdditions[id] ? playlistAdditions[id].length : 0;
    const playlistScore = Math.min(playlistCount / 5, 1.0);

    // Social signal: how many times song appears in liked songs of virtual users
    const isLiked = likedSongs.some(s => s.title === song.title && s.artist === song.artist);
    const socialScore = isLiked ? 0.8 : 0.2;

    // TrendingScore = (play_count * 0.4) + (growth_rate * 0.3) + (playlist_count * 0.3)
    return (playCountScore * 0.4) + (growthRate * 0.3) + (playlistScore * 0.2) + (socialScore * 0.1);
}

// --- MODULE 7: MOOD-BASED RECOMMENDATION ---
function detectCurrentMood() {
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Time-based mood detection
    let timeMood = 'neutral';
    if (hour >= 5 && hour < 9) timeMood = 'energetic';       // Morning
    else if (hour >= 9 && hour < 12) timeMood = 'focused';   // Late morning
    else if (hour >= 12 && hour < 14) timeMood = 'happy';    // Lunch
    else if (hour >= 14 && hour < 17) timeMood = 'focused';  // Afternoon
    else if (hour >= 17 && hour < 20) timeMood = 'energetic';// Evening
    else if (hour >= 20 && hour < 23) timeMood = 'chill';    // Night
    else timeMood = 'chill';                                  // Late night

    // Weekend boost for party/happy mood
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (hour >= 18 && hour < 24) timeMood = 'party';
    }

    // Override with recent listening behavior
    if (currentPlaylist.length > 0 && currentSongIndex >= 0) {
        const recentSong = currentPlaylist[currentSongIndex];
        const features = songFeatureCache[recentSong.title + "-" + recentSong.artist];
        if (features) {
            // If user is actively listening to sad songs, mood is sad
            if (features.mood === 'sad') timeMood = 'sad';
            else if (features.mood === 'aggressive') timeMood = 'workout';
            else if (features.energy > 0.8) timeMood = 'energetic';
        }
    }

    return timeMood;
}

function getMoodBasedScore(song, mood) {
    const features = songFeatureCache[song.title + "-" + song.artist] || analyzeSongFeatures(song);

    const moodMapping = {
        'energetic':  { targetEnergy: 0.8, targetMoods: ['happy', 'aggressive'], targetTempo: 125 },
        'focused':    { targetEnergy: 0.4, targetMoods: ['chill', 'neutral'], targetTempo: 100 },
        'happy':      { targetEnergy: 0.65, targetMoods: ['happy', 'romantic'], targetTempo: 115 },
        'chill':      { targetEnergy: 0.3, targetMoods: ['chill', 'romantic', 'sad'], targetTempo: 85 },
        'party':      { targetEnergy: 0.9, targetMoods: ['happy', 'aggressive'], targetTempo: 130 },
        'sad':        { targetEnergy: 0.3, targetMoods: ['sad', 'romantic'], targetTempo: 75 },
        'workout':    { targetEnergy: 0.9, targetMoods: ['aggressive', 'happy'], targetTempo: 140 },
        'neutral':    { targetEnergy: 0.5, targetMoods: ['neutral', 'happy'], targetTempo: 110 }
    };

    const config = moodMapping[mood] || moodMapping['neutral'];
    const energyMatch = 1 - Math.abs(features.energy - config.targetEnergy);
    const moodMatch = config.targetMoods.includes(features.mood) ? 1.0 : 0.2;
    const tempoMatch = 1 - Math.min(Math.abs(features.tempo - config.targetTempo) / 60, 1);

    return (energyMatch * 0.4) + (moodMatch * 0.4) + (tempoMatch * 0.2);
}

// --- MODULE 8: SMART SHUFFLE LOGIC ---
function smartShuffle(playlist) {
    if (playlist.length <= 2) return [...playlist];

    const shuffled = [];
    const remaining = [...playlist];
    const recentArtists = [];
    const recentMoods = [];
    let lastTempo = 110;

    while (remaining.length > 0) {
        // Score each candidate
        let bestIdx = 0;
        let bestScore = -1;

        for (let i = 0; i < remaining.length; i++) {
            const song = remaining[i];
            const features = songFeatureCache[song.title + "-" + song.artist] || analyzeSongFeatures(song);
            let score = 0;

            // Rule 1: Avoid repeating artist frequently
            const artistRecentCount = recentArtists.filter(a => a === song.artist).length;
            if (artistRecentCount === 0) score += 0.3;
            else if (artistRecentCount === 1) score += 0.1;
            else score -= 0.2;

            // Rule 2: Vary tempo gradually (prefer small changes)
            const tempoDiff = Math.abs(features.tempo - lastTempo);
            if (tempoDiff < 20) score += 0.25;
            else if (tempoDiff < 40) score += 0.15;
            else score += 0.05;

            // Rule 3: Mix popular + unknown songs (alternating pattern)
            const histData = playHistory[song.title + "-" + song.artist];
            const isPopular = histData && histData.playCount > 3;
            const isDiscovery = !histData || histData.playCount <= 1;
            if (shuffled.length % 4 === 3 && isDiscovery) score += 0.25; // Every 4th song: discovery
            else if (isPopular) score += 0.15;

            // Rule 4: Keep mood consistency but allow gradual shifts
            if (recentMoods.length > 0 && features.mood === recentMoods[recentMoods.length - 1]) score += 0.1;

            // Add some randomness
            score += Math.random() * 0.15;

            if (score > bestScore) {
                bestScore = score;
                bestIdx = i;
            }
        }

        const chosen = remaining.splice(bestIdx, 1)[0];
        shuffled.push(chosen);

        const chosenFeatures = songFeatureCache[chosen.title + "-" + chosen.artist] || analyzeSongFeatures(chosen);
        recentArtists.push(chosen.artist);
        if (recentArtists.length > 3) recentArtists.shift();
        recentMoods.push(chosenFeatures.mood);
        if (recentMoods.length > 3) recentMoods.shift();
        lastTempo = chosenFeatures.tempo;
    }

    return shuffled;
}

// --- MODULE 9: DISCOVERY ENGINE ---
function getDiscoveryScore(song) {
    const id = song.title + "-" + song.artist;
    const histData = playHistory[id];
    const tasteVector = userTasteVector || buildTasteVector();

    // A song is a "discovery" if:
    // 1. User has never played it
    // 2. It's from a new artist
    // 3. It's from a genre user doesn't usually listen to
    // 4. It's trending

    let discoveryScore = 0;

    // Never played = discovery opportunity
    if (!histData) discoveryScore += 0.4;
    else if (histData.playCount <= 1) discoveryScore += 0.2;

    // New artist
    const knownArtists = tasteVector.top_artists.map(a => a.toLowerCase());
    if (!knownArtists.includes(song.artist.toLowerCase())) discoveryScore += 0.3;

    // Different genre from top preferences
    const features = songFeatureCache[id] || analyzeSongFeatures(song);
    const topGenre = Object.keys(tasteVector.genre_vector).sort((a, b) => tasteVector.genre_vector[b] - tasteVector.genre_vector[a])[0];
    if (features.genre !== topGenre) discoveryScore += 0.2;

    // Trending boost for discoveries
    const trendScore = calculateTrendingScore(song);
    discoveryScore += trendScore * 0.1;

    return Math.min(discoveryScore, 1.0);
}

// --- MODULE 11: FINAL RECOMMENDATION SCORE ---
function calculateFinalRecommendationScore(song, userProfile, hour) {
    const tasteVector = userTasteVector || buildTasteVector();
    const features = songFeatureCache[song.title + "-" + song.artist] || analyzeSongFeatures(song);
    const currentMood = detectCurrentMood();

    // 1. User Taste Match (0.35)
    let tasteMatchScore = 0;
    // Genre alignment
    const genreWeight = tasteVector.genre_vector[features.genre] || 0;
    tasteMatchScore += genreWeight * 0.4;
    // Mood alignment
    const moodWeight = tasteVector.mood_vector[features.mood] || 0;
    tasteMatchScore += moodWeight * 0.3;
    // Energy alignment
    const energyDiff = Math.abs(features.energy - tasteVector.energy_preference);
    tasteMatchScore += (1 - energyDiff) * 0.15;
    // Tempo alignment
    const tempoDiff = Math.abs(features.tempo - tasteVector.tempo_range.avg) / 80;
    tasteMatchScore += (1 - Math.min(tempoDiff, 1)) * 0.15;

    // 2. Similar User Score (Collaborative Filtering) (0.25)
    const id = song.title + "-" + song.artist;
    const histData = playHistory[id];
    let similarUserScore = 0;
    // Check if song matches patterns of highly engaged songs
    if (histData) {
        const engagement = getEngagementWeight(histData);
        similarUserScore = Math.min(engagement / 10, 1.0);
    } else {
        // For new songs, check artist/genre overlap
        const artistMatch = tasteVector.top_artists.includes(song.artist) ? 0.6 : 0;
        similarUserScore = artistMatch + genreWeight * 0.3;
    }

    // 3. Song Feature Similarity to recently played (0.20)
    let featureSimilarityScore = 0;
    if (currentPlaylist.length > 0 && currentSongIndex >= 0) {
        const recentSong = currentPlaylist[currentSongIndex];
        featureSimilarityScore = getContentBasedSimilarity(recentSong, song);
    } else if (likedSongs.length > 0) {
        // Average similarity to top liked songs
        const topLiked = likedSongs.slice(-5);
        featureSimilarityScore = topLiked.reduce((sum, ls) => sum + getContentBasedSimilarity(ls, song), 0) / topLiked.length;
    }

    // 4. Trending Score (0.10)
    const trendingScore = calculateTrendingScore(song);

    // 5. Discovery Factor (0.10)
    const discoveryFactor = getDiscoveryScore(song);

    // 6. Mood-Based Bonus
    const moodScore = getMoodBasedScore(song, currentMood);

    // FINAL SCORE FORMULA (from spec)
    const finalScore = (
        0.30 * tasteMatchScore +
        0.20 * similarUserScore +
        0.15 * featureSimilarityScore +
        0.10 * trendingScore +
        0.10 * discoveryFactor +
        0.15 * moodScore
    );

    return Math.min(Math.max(finalScore, 0), 1);
}

// --- MODULE 12: GENERATE RECOMMENDATIONS OUTPUT ---
async function generateSmartRecommendations() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="rec-engine-loading">
            <div class="rec-brain-icon"><i class="fas fa-brain"></i></div>
            <div class="rec-loading-text">Analyzing your music taste...</div>
            <div class="rec-loading-subtext">Running 12 recommendation modules</div>
        </div>
    `;

    const profile = getUserProfile();
    const tasteVector = buildTasteVector();
    const hour = new Date().getHours();
    const currentMood = detectCurrentMood();

    // Gather candidate songs from multiple sources
    let candidates = [];

    // Source 1: Build queries from taste vector
    const topGenres = Object.keys(tasteVector.genre_vector)
        .sort((a, b) => tasteVector.genre_vector[b] - tasteVector.genre_vector[a])
        .slice(0, 3);
    const topMoods = tasteVector.preferred_moods.slice(0, 2);

    const queries = [];
    // Taste-based queries
    topGenres.forEach(g => {
        const genreQueries = {
            'bollywood': 'Bollywood Top Hits', 'pop': 'Global Pop Hits',
            'edm': 'EDM Dance Hits', 'hiphop': 'Hip Hop Rap Hits',
            'punjabi': 'Punjabi Top Hits', 'lofi': 'Lofi Chill Beats',
            'rock': 'Rock Music Hits', 'classical': 'Classical Ghazal Hits',
            'south_indian': 'South Indian Pan India Hits'
        };
        queries.push(genreQueries[g] || 'Top Music Hits');
    });
    // Mood-based queries
    topMoods.forEach(m => {
        const moodQueries = {
            'happy': 'Happy Upbeat Songs', 'sad': 'Sad Emotional Songs',
            'chill': 'Chill Lofi Relaxing', 'romantic': 'Romantic Love Songs',
            'aggressive': 'High Energy Workout Songs', 'neutral': 'Popular Hit Songs'
        };
        queries.push(moodQueries[m] || 'Top Hit Songs');
    });
    // Artist-based queries
    tasteVector.top_artists.slice(0, 3).forEach(a => queries.push(`${a} best hits`));

    // Fetch candidates in parallel
    const fetchPromises = queries.map(q => getAudioData(q).catch(() => []));
    const fetchResults = await Promise.all(fetchPromises);
    fetchResults.forEach(data => candidates = candidates.concat(data));

    // Remove duplicates
    candidates = candidates.filter((v, i, a) => a.findIndex(t => t.title === v.title) === i);

    if (candidates.length === 0) {
        resultsDiv.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:40px;">Could not generate recommendations. Try playing some songs first!</p>';
        return;
    }

    // Score all candidates
    candidates.forEach(song => {
        analyzeSongFeatures(song);
        song.finalScore = calculateFinalRecommendationScore(song, profile, hour);
        song.discoveryScore = getDiscoveryScore(song);
        song.trendScore = calculateTrendingScore(song);
        song.moodScore = getMoodBasedScore(song, currentMood);
    });

    // Sort by final score
    candidates.sort((a, b) => b.finalScore - a.finalScore);

    // Apply 70/30 safe/discovery split
    const safeCount = Math.floor(candidates.length * 0.7);
    const safeSongs = candidates.filter(s => s.discoveryScore < 0.5).slice(0, safeCount);
    const discoverySongs = candidates.filter(s => s.discoveryScore >= 0.5)
        .sort((a, b) => b.discoveryScore - a.discoveryScore)
        .slice(0, candidates.length - safeCount);

    // Merge and smart shuffle
    let finalPlaylist = [...safeSongs, ...discoverySongs];
    finalPlaylist = smartShuffle(finalPlaylist);

    // Limit to top 50
    finalPlaylist = finalPlaylist.slice(0, 50);

    // Save recommendation history
    recommendationHistory.push({
        timestamp: Date.now(),
        mood: currentMood,
        songCount: finalPlaylist.length,
        topGenres,
        topMoods
    });
    SmartEngine.batchedSetItem('proMusicRecHistory', JSON.stringify(recommendationHistory.slice(-20)));

    // Render the recommendation dashboard
    renderRecommendationDashboard(finalPlaylist, tasteVector, currentMood, profile);
}

function renderRecommendationDashboard(songs, tasteVector, currentMood, profile) {
    const resultsDiv = document.getElementById('results');

    // Get mood display info
    const moodInfo = {
        'energetic': { icon: 'fa-bolt', color: '#fbbf24', label: 'Energetic' },
        'focused': { icon: 'fa-crosshairs', color: '#60a5fa', label: 'Focused' },
        'happy': { icon: 'fa-face-smile', color: '#34d399', label: 'Happy' },
        'chill': { icon: 'fa-cloud-moon', color: '#a78bfa', label: 'Chill' },
        'party': { icon: 'fa-champagne-glasses', color: '#f472b6', label: 'Party' },
        'sad': { icon: 'fa-cloud-rain', color: '#93c5fd', label: 'Melancholic' },
        'workout': { icon: 'fa-dumbbell', color: '#ef4444', label: 'Workout' },
        'neutral': { icon: 'fa-music', color: '#1db954', label: 'Vibing' }
    };
    const mood = moodInfo[currentMood] || moodInfo['neutral'];

    // Get top genres for display
    const topGenres = Object.keys(tasteVector.genre_vector)
        .sort((a, b) => tasteVector.genre_vector[b] - tasteVector.genre_vector[a])
        .slice(0, 5);

    let html = `
        <div class="rec-dashboard">
            <!-- Header Section -->
            <div class="rec-header">
                <div class="rec-header-content">
                    <div class="rec-mood-badge" style="--mood-color: ${mood.color};">
                        <i class="fas ${mood.icon}"></i>
                        <span>${mood.label} Mode</span>
                    </div>
                    <h1 class="rec-title">Smart Recommendations</h1>
                    <p class="rec-subtitle">Personalized by AI analysis of your ${Object.keys(playHistory).length} plays, ${likedSongs.length} likes & listening patterns</p>
                </div>
            </div>

            <!-- Taste Profile Cards -->
            <div class="rec-taste-section">
                <h2 class="rec-section-title"><i class="fas fa-dna"></i> Your Taste DNA</h2>
                <div class="rec-taste-cards">
                    <!-- Genre Distribution -->
                    <div class="rec-taste-card">
                        <div class="rec-taste-card-header">
                            <i class="fas fa-compact-disc"></i>
                            <span>Genre Profile</span>
                        </div>
                        <div class="rec-genre-bars">
                            ${topGenres.map(g => {
                                const pct = Math.round((tasteVector.genre_vector[g] || 0) * 100);
                                const genreLabels = { bollywood: 'Bollywood', pop: 'Pop', edm: 'EDM', hiphop: 'Hip-Hop', punjabi: 'Punjabi', lofi: 'Lo-Fi', rock: 'Rock', classical: 'Classical', south_indian: 'South Indian' };
                                return `<div class="rec-genre-bar-item">
                                    <div class="rec-genre-label">
                                        <span>${genreLabels[g] || g}</span>
                                        <span>${pct}%</span>
                                    </div>
                                    <div class="rec-genre-bar-track">
                                        <div class="rec-genre-bar-fill" style="width: ${pct}%;"></div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Energy & Mood -->
                    <div class="rec-taste-card">
                        <div class="rec-taste-card-header">
                            <i class="fas fa-heart-pulse"></i>
                            <span>Energy & Mood</span>
                        </div>
                        <div class="rec-stat-grid">
                            <div class="rec-stat-item">
                                <div class="rec-stat-circle" style="--progress: ${Math.round(tasteVector.energy_preference * 100)}%;">
                                    <span>${Math.round(tasteVector.energy_preference * 100)}%</span>
                                </div>
                                <p>Energy</p>
                            </div>
                            <div class="rec-stat-item">
                                <div class="rec-stat-circle" style="--progress: ${Math.round(tasteVector.danceability_preference * 100)}%;">
                                    <span>${Math.round(tasteVector.danceability_preference * 100)}%</span>
                                </div>
                                <p>Dance</p>
                            </div>
                            <div class="rec-stat-item">
                                <div class="rec-stat-circle" style="--progress: ${Math.round((1 - tasteVector.skip_rate) * 100)}%;">
                                    <span>${Math.round((1 - tasteVector.skip_rate) * 100)}%</span>
                                </div>
                                <p>Enjoy Rate</p>
                            </div>
                        </div>
                        <div class="rec-mood-tags">
                            ${tasteVector.preferred_moods.map(m => {
                                const moodLabels = { happy: 'Happy', sad: 'Sad', chill: 'Chill', romantic: 'Romantic', aggressive: 'Intense', neutral: 'Balanced' };
                                return `<span class="rec-mood-tag">${moodLabels[m] || m}</span>`;
                            }).join('')}
                        </div>
                    </div>

                    <!-- Listening Patterns -->
                    <div class="rec-taste-card">
                        <div class="rec-taste-card-header">
                            <i class="fas fa-clock"></i>
                            <span>When You Listen</span>
                        </div>
                        <div class="rec-time-chart">
                            ${['morning', 'afternoon', 'evening', 'night', 'latenight'].map(t => {
                                const total = Object.values(tasteVector.listening_time_patterns).reduce((a, b) => a + b, 0) || 1;
                                const pct = Math.round((tasteVector.listening_time_patterns[t] / total) * 100);
                                const timeLabels = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night', latenight: 'Late Night' };
                                const timeIcons = { morning: 'fa-sun', afternoon: 'fa-cloud-sun', evening: 'fa-sunset', night: 'fa-moon', latenight: 'fa-star' };
                                return `<div class="rec-time-bar">
                                    <i class="fas ${timeIcons[t] || 'fa-clock'}"></i>
                                    <div class="rec-time-bar-track">
                                        <div class="rec-time-bar-fill" style="width: ${pct}%;"></div>
                                    </div>
                                    <span>${pct}%</span>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recommended Playlist -->
            <div class="rec-playlist-section">
                <div class="rec-playlist-header">
                    <div>
                        <h2 class="rec-section-title"><i class="fas fa-wand-magic-sparkles"></i> Your Personal Mix</h2>
                        <p class="rec-playlist-meta">${songs.length} songs curated by 12 AI modules | 70% favorites + 30% discovery</p>
                    </div>
                    <button class="rec-play-all-btn" onclick="playRecommendedPlaylist()">
                        <i class="fas fa-play"></i> Play All
                    </button>
                </div>
    `;

    // Song list
    html += `<div class="song-list-container">`;
    html += `<div class="rec-list-header">
        <span class="rec-col-num">#</span>
        <span class="rec-col-title">Title</span>
        <span class="rec-col-score">Match</span>
        <span class="rec-col-type">Type</span>
    </div>`;

    songs.forEach((song, index) => {
        const isLiked = likedSongs.some(s => s.title === song.title && s.artist === song.artist);
        const matchPct = Math.round((song.finalScore || 0) * 100);
        const isDiscovery = (song.discoveryScore || 0) >= 0.5;
        const matchColor = matchPct >= 80 ? '#1db954' : matchPct >= 60 ? '#fbbf24' : '#60a5fa';

        html += `
            <div class="song-list-row rec-song-row" onclick="playRecommendedSong(${index})" id="rec-row-${index}">
                <span class="song-num" style="width: 30px; color: var(--text-muted); font-size: 14px; font-weight:600;">${index + 1}</span>
                <img src="${song.image}" loading="lazy">
                <div class="song-list-info">
                    <h4>${song.title}</h4>
                    <p>${song.artist}</p>
                </div>
                <div class="rec-match-badge" style="--match-color: ${matchColor};">
                    ${matchPct}%
                </div>
                <div class="rec-type-badge ${isDiscovery ? 'rec-discovery' : 'rec-safe'}">
                    <i class="fas ${isDiscovery ? 'fa-compass' : 'fa-heart'}"></i>
                    ${isDiscovery ? 'New' : 'Safe'}
                </div>
            </div>
        `;
    });

    html += `</div></div></div>`;
    resultsDiv.innerHTML = html;

    // Store for playback
    window.recommendedPlaylistData = songs;
}

function playRecommendedPlaylist() {
    if (window.recommendedPlaylistData && window.recommendedPlaylistData.length > 0) {
        currentPlaylist = window.recommendedPlaylistData;
        updateQueueUI();
        playSongByIndex(0);
        showToast(`Playing ${currentPlaylist.length} recommended songs!`);
    }
}

function playRecommendedSong(index) {
    if (window.recommendedPlaylistData) {
        currentPlaylist = window.recommendedPlaylistData;
        updateQueueUI();
        playSongByIndex(index);
    }
}

// Enhanced getUserProfile with full taste data
function getUserProfile() {
    const historyVals = Object.values(playHistory);
    const artists = {};
    const keywords = {};
    historyVals.forEach(s => {
        artists[s.artist] = (artists[s.artist] || 0) + (s.playCount || 1);
        const words = (s.title + " " + s.artist).split(' ');
        words.forEach(w => {
            if(w.length > 3) keywords[w.toLowerCase()] = (keywords[w.toLowerCase()] || 0) + (s.playCount || 1);
        });
    });
    
    const topArtists = Object.keys(artists).sort((a,b) => artists[b] - artists[a]).slice(0, 10);
    const topKeywords = Object.keys(keywords).sort((a,b) => keywords[b] - keywords[a]).slice(0, 15);
    
    return { topArtists, topKeywords, historyVals };
}

// Enhanced calculateSongScore using the full recommendation engine
function calculateSongScore(song, userProfile, hour) {
    // Use the full recommendation engine score
    return calculateFinalRecommendationScore(song, userProfile, hour);
}

