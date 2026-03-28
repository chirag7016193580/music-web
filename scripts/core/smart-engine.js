// ==========================================
// SMART PERFORMANCE ENGINE v2.0
// PC + Phone Smooth Experience Engine
// ==========================================
const SmartEngine = (() => {
    // --- 1. DEVICE DETECTION ---
    const ua = navigator.userAgent || '';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const screenW = window.screen?.width || window.innerWidth;
    const screenH = window.screen?.height || window.innerHeight;
    const deviceMemory = navigator.deviceMemory || 4; // GB
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const isLowEnd = (deviceMemory <= 2 || hardwareConcurrency <= 2);
    const isMidRange = (deviceMemory <= 4 && hardwareConcurrency <= 4);

    // --- 2. QUALITY TIER (auto-detected) ---
    let qualityTier = 'high'; // high / medium / low
    if (isMobile && isLowEnd) qualityTier = 'low';
    else if (isMobile && isMidRange) qualityTier = 'medium';
    else if (isMobile) qualityTier = 'medium';
    // PC stays 'high'

    const config = {
        high:   { particles: 50, particleConnDist: 120, visualizerFPS: 60, imgQuality: '500x500', scrollDebounce: 16, saveInterval: 5000, cacheMax: 200, queueBatchSize: 100, animationsEnabled: true, blurEnabled: true },
        medium: { particles: 25, particleConnDist: 80,  visualizerFPS: 30, imgQuality: '300x300', scrollDebounce: 32, saveInterval: 8000, cacheMax: 100, queueBatchSize: 50,  animationsEnabled: true, blurEnabled: true },
        low:    { particles: 10, particleConnDist: 0,   visualizerFPS: 15, imgQuality: '150x150', scrollDebounce: 50, saveInterval: 15000, cacheMax: 50,  queueBatchSize: 30,  animationsEnabled: false, blurEnabled: false }
    };

    let settings = { ...config[qualityTier] };

    // --- 3. NETWORK DETECTION ---
    let connectionType = 'good'; // good / slow / offline
    function detectNetwork() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!navigator.onLine) { connectionType = 'offline'; return; }
        if (conn) {
            const ect = conn.effectiveType;
            if (ect === 'slow-2g' || ect === '2g') connectionType = 'slow';
            else if (ect === '3g') connectionType = 'slow';
            else connectionType = 'good';
            // Downlink-based detection
            if (conn.downlink && conn.downlink < 1) connectionType = 'slow';
        } else {
            connectionType = 'good';
        }
        // On slow network, reduce image quality further
        if (connectionType === 'slow' && qualityTier !== 'low') {
            settings.imgQuality = '150x150';
            settings.cacheMax = 50;
        }
    }
    detectNetwork();
    if (navigator.connection) {
        navigator.connection.addEventListener('change', detectNetwork);
    }
    window.addEventListener('online', () => { connectionType = 'good'; detectNetwork(); });
    window.addEventListener('offline', () => { connectionType = 'offline'; });

    // --- 4. BATTERY DETECTION ---
    let isLowBattery = false;
    let isBatteryCharging = true;
    async function detectBattery() {
        try {
            if ('getBattery' in navigator) {
                const battery = await navigator.getBattery();
                const update = () => {
                    isLowBattery = battery.level < 0.15 && !battery.charging;
                    isBatteryCharging = battery.charging;
                    if (isLowBattery) {
                        // Aggressive power saving
                        settings.particles = Math.min(settings.particles, 5);
                        settings.visualizerFPS = Math.min(settings.visualizerFPS, 10);
                        settings.particleConnDist = 0;
                        settings.animationsEnabled = false;
                    }
                };
                battery.addEventListener('levelchange', update);
                battery.addEventListener('chargingchange', update);
                update();
            }
        } catch(e) {}
    }
    detectBattery();

    // --- 5. THROTTLE & DEBOUNCE UTILITIES ---
    function throttle(fn, limit) {
        let last = 0, timer = null;
        return function(...args) {
            const now = Date.now();
            const remaining = limit - (now - last);
            if (remaining <= 0) {
                if (timer) { clearTimeout(timer); timer = null; }
                last = now;
                fn.apply(this, args);
            } else if (!timer) {
                timer = setTimeout(() => {
                    last = Date.now();
                    timer = null;
                    fn.apply(this, args);
                }, remaining);
            }
        };
    }

    function debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // --- 6. SMART LOCALSTORAGE (Batched Writes) ---
    const pendingWrites = new Map();
    let writeTimer = null;

    function batchedSetItem(key, val) {
        pendingWrites.set(key, val);
        if (!writeTimer) {
            writeTimer = setTimeout(flushWrites, settings.saveInterval);
        }
    }

    function flushWrites() {
        writeTimer = null;
        pendingWrites.forEach((val, key) => {
            try { localStorage.setItem(key, String(val)); } catch(e) {}
        });
        pendingWrites.clear();
    }

    // Flush on page hide (critical for mobile)
    function emergencyFlush() {
        if (pendingWrites.size > 0) {
            pendingWrites.forEach((val, key) => {
                try { localStorage.setItem(key, String(val)); } catch(e) {}
            });
            pendingWrites.clear();
        }
        if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    }
    window.addEventListener('pagehide', emergencyFlush);
    window.addEventListener('beforeunload', emergencyFlush);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') emergencyFlush();
    });

    // --- 7. LRU CACHE for API ---
    class LRUCache {
        constructor(maxSize) {
            this.maxSize = maxSize;
            this.cache = new Map();
        }
        has(key) { return this.cache.has(key); }
        get(key) {
            if (!this.cache.has(key)) return undefined;
            const val = this.cache.get(key);
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, val);
            return val;
        }
        set(key, val) {
            if (this.cache.has(key)) this.cache.delete(key);
            else if (this.cache.size >= this.maxSize) {
                // Evict oldest (first entry)
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(key, val);
        }
        clear() { this.cache.clear(); }
        get size() { return this.cache.size; }
    }

    // --- 8. SMART IMAGE LOADER (IntersectionObserver) ---
    let imageObserver = null;
    function initImageObserver() {
        if (!('IntersectionObserver' in window)) return;
        imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const dataSrc = img.getAttribute('data-src');
                    if (dataSrc) {
                        img.src = dataSrc;
                        img.removeAttribute('data-src');
                    }
                    imageObserver.unobserve(img);
                }
            });
        }, { rootMargin: '200px 0px', threshold: 0.01 });
    }
    initImageObserver();

    function observeImage(img) {
        if (imageObserver && img) imageObserver.observe(img);
    }

    function optimizeImageUrl(url) {
        if (!url || url.includes('placeholder')) return url;
        // Optimize based on quality tier
        if (qualityTier === 'low') {
            return url.replace(/\d+x\d+bb/, '150x150bb').replace(/500x500/, '150x150').replace(/300x300/, '150x150');
        } else if (qualityTier === 'medium') {
            return url.replace(/500x500/, '300x300');
        }
        return url;
    }

    // --- 9. FRAME BUDGET MANAGER ---
    let lastFrameTime = 0;
    let frameBudgetMs = 1000 / settings.visualizerFPS;
    let isPageVisible = true;

    document.addEventListener('visibilitychange', () => {
        isPageVisible = document.visibilityState === 'visible';
    });

    function shouldRenderFrame(now) {
        if (!isPageVisible) return false;
        if (now - lastFrameTime < frameBudgetMs) return false;
        lastFrameTime = now;
        return true;
    }

    // --- 10. REQUESTIDLECALLBACK POLYFILL ---
    const rIC = window.requestIdleCallback || function(cb) {
        return setTimeout(() => {
            const start = Date.now();
            cb({ didTimeout: false, timeRemaining: () => Math.max(0, 50 - (Date.now() - start)) });
        }, 1);
    };

    function scheduleIdle(fn) {
        rIC(fn, { timeout: 2000 });
    }

    // --- 11. DOM RECYCLER for Queue Items ---
    const domPool = {
        _pool: [],
        get(tag) {
            if (this._pool.length > 0) {
                const el = this._pool.pop();
                el.innerHTML = '';
                el.className = '';
                el.removeAttribute('style');
                el.onclick = null;
                return el;
            }
            return document.createElement(tag || 'div');
        },
        release(el) {
            if (el && this._pool.length < 200) {
                el.onclick = null;
                this._pool.push(el);
            }
        }
    };

    // --- 12. SMOOTH SCROLL HELPER ---
    const smoothScrollRow = throttle(function(container, direction) {
        if (!container) return;
        const scrollAmount = isMobile ? 250 : 350;
        container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    }, settings.scrollDebounce);

    // --- 13. PERFORMANCE MONITOR ---
    let fps = 60, fpsFrames = 0, fpsLastCheck = performance.now();
    function updateFPS() {
        fpsFrames++;
        const now = performance.now();
        if (now - fpsLastCheck >= 1000) {
            fps = fpsFrames;
            fpsFrames = 0;
            fpsLastCheck = now;
            // Auto-downgrade if FPS is consistently low
            if (fps < 20 && qualityTier !== 'low') {
                qualityTier = 'low';
                Object.assign(settings, config['low']);
                frameBudgetMs = 1000 / settings.visualizerFPS;
                console.log('[SmartEngine] Auto-downgraded to LOW quality (FPS:', fps, ')');
            } else if (fps < 35 && qualityTier === 'high') {
                qualityTier = 'medium';
                Object.assign(settings, config['medium']);
                frameBudgetMs = 1000 / settings.visualizerFPS;
                console.log('[SmartEngine] Auto-downgraded to MEDIUM quality (FPS:', fps, ')');
            }
        }
    }

    // --- 14. PREFETCH MANAGER ---
    const prefetchedUrls = new Set();
    function prefetchAudio(url) {
        if (!url || prefetchedUrls.has(url) || connectionType === 'slow') return;
        if (prefetchedUrls.size > 5) prefetchedUrls.clear(); // Limit prefetch count
        try {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'fetch';
            link.href = url;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
            prefetchedUrls.add(url);
        } catch(e) {}
    }

    // --- 15. TOUCH OPTIMIZATION ---
    // Passive event listeners for smooth scrolling on mobile
    function addPassiveListener(el, event, handler) {
        if (el) el.addEventListener(event, handler, { passive: true });
    }

    // --- PUBLIC API ---
    console.log(`[SmartEngine v2.0] Device: ${isMobile ? 'Mobile' : 'PC'} | Quality: ${qualityTier.toUpperCase()} | RAM: ${deviceMemory}GB | Cores: ${hardwareConcurrency} | Network: ${connectionType}`);

    return {
        isMobile, isIOS, isAndroid, isSafari, isLowEnd, isMidRange,
        qualityTier, settings, connectionType,
        isLowBattery: () => isLowBattery,
        isPageVisible: () => isPageVisible,
        throttle, debounce,
        batchedSetItem, flushWrites, emergencyFlush,
        LRUCache,
        observeImage, optimizeImageUrl, initImageObserver,
        shouldRenderFrame, updateFPS,
        rIC, scheduleIdle,
        domPool,
        smoothScrollRow,
        prefetchAudio,
        addPassiveListener,
        getFPS: () => fps,
        getConfig: () => settings,
        // Allow manual quality override
        setQuality(tier) {
            if (config[tier]) {
                qualityTier = tier;
                Object.assign(settings, config[tier]);
                frameBudgetMs = 1000 / settings.visualizerFPS;
                console.log(`[SmartEngine] Quality set to ${tier.toUpperCase()}`);
            }
        }
    };
})();

