/* ========================================= */
/* DeltaMusic PWA Logic (Android 1:1 Port)   */
/* ========================================= */

const UI = {
    screens: {
        library: document.getElementById('screen-library'),
        download: document.getElementById('screen-download'),
        executor: document.getElementById('screen-executor')
    },
    navItems: document.querySelectorAll('.nav-item'),
    toast: document.getElementById('global-toast'),

    // Library
    library: {
        subTabsBtns: document.querySelectorAll('.sub-tab-btn'),
        subScreens: {
            tracks: document.getElementById('subtab-tracks'),
            artists: document.getElementById('subtab-artists'),
            foryou: document.getElementById('subtab-foryou'),
            yourchart: document.getElementById('subtab-yourchart'),
            online: document.getElementById('subtab-online')
        },
        lists: {
            tracks: document.getElementById('local-tracks-list'),
            artists: document.getElementById('artists-list'),
            foryou: document.getElementById('foryou-list'),
            online: document.getElementById('online-results-list')
        },
        search: {
            container: document.getElementById('library-search-container'),
            input: document.getElementById('library-search-input')
        },
        btnShuffle: document.getElementById('btn-toggle-shuffle'),
        btnChart: document.getElementById('btn-play-chart'),
        chartSpinner: document.querySelector('.chart-spinner')
    },

    // Download
    download: {
        input: document.getElementById('import-input'),
        btnRun: document.getElementById('btn-run-import'),
        statusBox: document.getElementById('import-status'),
        statusText: document.getElementById('import-status-text'),
        progressCont: document.getElementById('import-progress-container'),
        progressFill: document.getElementById('import-progress-fill'),
        results: document.getElementById('import-results')
    },

    // Executor
    executor: {
        artist: document.getElementById('exec-artist'),
        password: document.getElementById('exec-password'),
        photo: document.getElementById('exec-photo'),
        title: document.getElementById('exec-title'),
        url: document.getElementById('exec-url'),
        btnRun: document.getElementById('btn-run-executor'),
        statusMsg: document.getElementById('exec-status'),
        logs: document.getElementById('executor-results')
    },

    // Player
    player: {
        audio: document.getElementById('audio-player'),
        mini: document.getElementById('player-mini'),
        full: document.getElementById('player-full'),

        miniTitle: document.getElementById('mini-title'),
        miniArtist: document.getElementById('mini-artist'),
        btnMiniPlay: document.getElementById('btn-mini-play'),
        iconMiniPlay: document.getElementById('icon-mini-play'),

        fullTitle: document.getElementById('full-title'),
        fullArtist: document.getElementById('full-artist'),
        btnFullPlay: document.getElementById('btn-full-play'),
        iconFullPlay: document.getElementById('icon-full-play'),
        btnFullPrev: document.getElementById('btn-full-prev'),
        btnFullNext: document.getElementById('btn-full-next'),
        btnFullCollapse: document.getElementById('btn-full-collapse'),
        btnFullClose: document.getElementById('btn-full-close'),

        seekbar: document.getElementById('player-seekbar'),
        timeCurrent: document.getElementById('time-current'),
        timeDuration: document.getElementById('time-duration')
    }
};

window.addEventListener('error', function (e) {
    if (UI.toast) {
        UI.toast.textContent = "JS ERR: " + e.message + " at " + e.filename + ":" + e.lineno;
        UI.toast.classList.remove('hidden');
    }
});
window.addEventListener('unhandledrejection', function (event) {
    if (UI.toast) {
        UI.toast.textContent = "PROMISE REJ: " + event.reason;
        UI.toast.classList.remove('hidden');
    }
});

const CONFIG = {
    PROXY: "https://corsproxy.io/?",
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw0d4RGncqnwKla0E7YK06xyAD2He5-w-08DZ1QvkbEofRnEg8pv73jLDtdJaXBbucrFA/exec",
    DB_NAME: "DeltaMusicDB",
    DB_VERSION: 2, // Incremented due to schema update
    STORE_NAME: "tracks"
};

let db;
let currentPlaylist = [];
let currentIndex = -1;
let isShuffle = false;
let currentBlobUrl = null;

// ==========================================
// IndexedDB (Room equivalent)
// ==========================================
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            // Mirroring Android Track data class mapping: id, title, artist, coverPath, filePath, genre
            if (!database.objectStoreNames.contains(CONFIG.STORE_NAME)) {
                const store = database.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id' });
                store.createIndex('artist', 'artist', { unique: false });
                store.createIndex('genre', 'genre', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (e) => reject(e);
    });
}

function getAllTracks() {
    if (!db) return Promise.resolve([]);
    return new Promise((resolve) => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readonly');
        const store = tx.objectStore(CONFIG.STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
    });
}

function saveTrack(track) {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        const store = tx.objectStore(CONFIG.STORE_NAME);
        store.put(track);
        tx.oncomplete = () => resolve();
    });
}

function deleteTrack(id) {
    if (!db) return Promise.resolve();
    return new Promise((resolve) => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        const store = tx.objectStore(CONFIG.STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
    });
}

// ==========================================
// Initialization & Navigation
// ==========================================
async function initApp() {
    setupNavigation();
    setupLibraryTabs();
    setupPlayerControls();
    setupDownloadTab();
    setupExecutorTab();

    try {
        await initDB();

        // Load initial data
        loadLocalTracks();
    } catch (e) {
        showToast("Database initialization error.");
        console.error(e);
    }
}

function setupNavigation() {
    UI.navItems.forEach(item => {
        item.addEventListener('click', () => {
            UI.navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            Object.values(UI.screens).forEach(screen => screen.classList.remove('active'));
            const target = document.getElementById(item.dataset.target);
            target.classList.add('active');

            if (item.dataset.target === 'screen-library') {
                loadLocalTracks(); // Refresh on open
            }
        });
    });
}

// ==========================================
// Library Tab UI & Logic
// ==========================================
function setupLibraryTabs() {
    UI.library.subTabsBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Activate button
            UI.library.subTabsBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Activate sub-screen
            Object.values(UI.library.subScreens).forEach(screen => screen.classList.remove('active'));
            const targetId = `subtab-${btn.dataset.subtab}`;
            document.getElementById(targetId).classList.add('active');

            // Toggle Search bar visibility (Only visible on Online)
            if (btn.dataset.subtab === 'online') {
                UI.library.search.container.style.display = 'block';
                // Trigger default load if empty
                if (UI.library.lists.online.innerHTML.trim() === '') {
                    searchOnline("");
                }
            } else {
                UI.library.search.container.style.display = 'none';
            }

            // Trigger loads based on tab
            switch (btn.dataset.subtab) {
                case 'tracks': loadLocalTracks(); break;
                case 'artists': loadArtistsView(); break;
                case 'foryou': loadForYouView(); break;
            }
        });
    });

    // Search input bounce
    let debounceTimer;
    UI.library.search.input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                searchOnline(query);
            }
        }, 1000);
    });

    // Shuffle Toggle
    UI.library.btnShuffle.addEventListener('click', () => {
        isShuffle = !isShuffle;
        UI.library.btnShuffle.classList.toggle('active', isShuffle);
        showToast(isShuffle ? "Shuffle Enabled" : "Shuffle Disabled");
    });

    // Chart Play
    UI.library.btnChart.addEventListener('click', playYourChart);
}

// 1. Tracks View
async function loadLocalTracks() {
    const tracks = await getAllTracks();
    const sorted = tracks.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));

    const container = UI.library.lists.tracks;
    container.innerHTML = '';

    if (sorted.length === 0) {
        container.innerHTML = `<div class="empty-state">Library is empty.</div>`;
        return;
    }

    sorted.forEach((t, i) => {
        const el = createTrackRow(t, false, () => playTrackList(sorted, i), async (e) => {
            e.stopPropagation();
            if (confirm('Delete track?')) {
                await deleteTrack(t.id);
                loadLocalTracks();
                showToast('Deleted');
            }
        });
        container.appendChild(el);
    });
}

// 2. Artists View
async function loadArtistsView() {
    const tracks = await getAllTracks();
    const container = UI.library.lists.artists;
    container.innerHTML = '';

    if (tracks.length === 0) {
        container.innerHTML = `<div class="empty-state">No artists found.</div>`;
        return;
    }

    const artistMap = {};
    tracks.forEach(t => {
        if (!artistMap[t.artist]) artistMap[t.artist] = [];
        artistMap[t.artist].push(t);
    });

    Object.keys(artistMap).sort().forEach(artistName => {
        const artistTracks = artistMap[artistName];

        const group = document.createElement('div');
        group.className = 'artist-group';

        const header = document.createElement('div');
        header.className = 'artist-group-header';
        header.innerHTML = `
            <div class="artist-group-avatar">
                <span class="material-symbols-outlined">person</span>
            </div>
            <div class="artist-group-name">${artistName}</div>
        `;
        group.appendChild(header);

        artistTracks.forEach((t, i) => {
            group.appendChild(createTrackRow(t, false, () => playTrackList(artistTracks, i)));
        });

        container.appendChild(group);
    });
}

// 3. For You View (Google Sheets Fetch)
async function loadForYouView() {
    const container = UI.library.lists.foryou;

    // Only load once to prevent spamming
    if (container.innerHTML.trim() !== '') return;

    container.innerHTML = `<div class="spinner-container"><div class="loading-spinner"></div></div>`;

    try {
        // App Scripts sometimes return JSONP or 302 redirects containing JSON text. Better to remove corsproxy for raw GET if it supports CORS inherently (like macro exec).
        // The script URL originally provided is an exec endpoint. 
        const fetchUrl = `${CONFIG.SCRIPT_URL}?action=getCards`;

        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error("Network response was not ok");
        const json = await response.json();

        container.innerHTML = '';
        if (!json || json.length === 0) {
            container.innerHTML = `<div class="empty-state">No recommendation data from spreadsheet.</div>`;
            return;
        }

        // Shuffle list simulating Daily Seed
        const shuffled = json.sort(() => 0.5 - Math.random());

        shuffled.forEach(artistData => {
            const card = document.createElement('div');
            card.className = 'artist-media-card';

            const lastPhoto = (artistData.photos && artistData.photos.length > 0) ? artistData.photos[artistData.photos.length - 1] : null;
            const photoHtml = lastPhoto
                ? `<img src="${lastPhoto}" class="artist-media-photo" crossorigin="anonymous">`
                : `<div class="artist-media-photo"><span class="material-symbols-outlined">person</span></div>`;

            let tracksHtml = '';
            artistData.tracks.forEach((t, i) => {
                tracksHtml += `
                    <div class="track-row" onclick="downloadAndPlayRemote('${t.title.replace(/'/g, "\\'")}', '${artistData.name.replace(/'/g, "\\'")}', '${t.url}')">
                        <div class="track-cover gradient-cover online"><span class="material-symbols-outlined">public</span></div>
                        <div class="track-info">
                            <div class="track-title">${t.title}</div>
                            <div class="track-artist">${artistData.name}</div>
                        </div>
                        <button class="track-action color-pink"><span class="material-symbols-outlined">cloud_download</span></button>
                    </div>
                 `;
            });

            card.innerHTML = `
                ${photoHtml}
                <div class="artist-media-content">
                    <div class="artist-media-title">${artistData.name}</div>
                    <div class="track-list">${tracksHtml}</div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (e) {
        container.innerHTML = `<div class="empty-state">Failed to load data.</div>`;
        console.error("Sheets error: ", e);
    }
}

// 4. Your Chart
async function playYourChart() {
    UI.library.chartSpinner.classList.remove('hidden');
    const container = UI.library.lists.foryou;
    let allTracks = [];

    // Pull from ForYou if loaded
    const nodes = container.querySelectorAll('.track-row');
    if (nodes.length > 0) {
        // Fake parsing out of DOM for quick mock 
        // In real Android this mixes search history with Sheets API
        // Here we just fetch random online subset
        try {
            const hitmotop = await fetchHitmotopDirect("scandroid"); // mock generic query
            allTracks = [...hitmotop];
        } catch (e) { }
    } else {
        allTracks = await fetchHitmotopDirect(""); // default chart
    }

    UI.library.chartSpinner.classList.add('hidden');

    if (allTracks.length > 0) {
        const shuffled = allTracks.sort(() => 0.5 - Math.random()).slice(0, 20);
        playTrackList(shuffled, 0);
        showToast("Playing Your Chart");
    } else {
        showToast("Chart data unavailable right now.");
    }
}

// 5. Online View (Hitmotop Text Search)
async function searchOnline(query) {
    const container = UI.library.lists.online;
    container.innerHTML = `<div class="spinner-container"><div class="loading-spinner"></div></div>`;

    try {
        const results = await fetchHitmotopDirect(query);
        container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = `<div class="empty-state">No results found online.</div>`;
            return;
        }

        results.forEach((t, i) => {
            const el = createTrackRow(t, true, () => playTrackList(results, i), (e) => {
                e.stopPropagation();
                downloadAndSaveRemoteTrack(t);
            });
            container.appendChild(el);
        });

    } catch (e) {
        container.innerHTML = `<div class="empty-state">Network Error.</div>`;
    }
}

function createTrackRow(track, isOnline, onClick, onAction) {
    const row = document.createElement('div');
    row.className = 'track-row ripple';
    row.onclick = onClick;

    const iconBase = isOnline ? 'public' : 'music_note';
    const bgClass = isOnline ? 'gradient-cover online' : 'gradient-cover';

    // Original allowed Blobs for local. For offline PWA, filePath could be a blob 
    const isBlob = track.blob;

    const actionHtml = isOnline
        ? `<button class="track-action color-pink"><span class="material-symbols-outlined">cloud_download</span></button>`
        : `<button class="track-action color-red"><span class="material-symbols-outlined">delete</span></button>`;

    row.innerHTML = `
        <div class="track-cover ${bgClass}"><span class="material-symbols-outlined">${iconBase}</span></div>
        <div class="track-info">
            <div class="track-title">${track.title}</div>
            <div class="track-artist">${track.artist}</div>
        </div>
        ${actionHtml}
    `;

    const btnAction = row.querySelector('.track-action');
    if (btnAction && onAction) {
        btnAction.onclick = onAction;
    } else if (btnAction) {
        btnAction.style.display = 'none';
    }

    return row;
}

// ==========================================
// Downloader Helpers
// ==========================================
async function fetchHitmotopDirect(query) {
    let target = `https://rus.hitmotop.com/search?q=${encodeURIComponent(query)}`;
    if (!query) target = `https://rus.hitmos.fm/collection/7270195`; // Default

    const url = CONFIG.PROXY + encodeURIComponent(target);
    const res = await fetch(url);
    const html = await res.text();

    const regex = /<li class="tracks__item">.*?<div class="track__title"[^>]*>\s*([^<]+?)\s*<\/div>.*?<div class="track__full-artist"[^>]*>\s*([^<]+?)\s*<\/div>.*?<a class="track__download-btn"[^>]*href="([^"]+?\.mp3)"/gs;
    const items = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        items.push({
            id: 'net_' + Math.random().toString(36).substr(2, 9),
            title: match[1].trim(),
            artist: match[2].trim(),
            filePath: match[3],
            genre: 'Online',
            isOnline: true
        });
    }
    return items;
}

async function downloadAndSaveRemoteTrack(trackInfo) {
    showToast(`Downloading: ${trackInfo.title}...`);
    try {
        const response = await fetch(CONFIG.PROXY + encodeURIComponent(trackInfo.filePath));
        if (!response.ok) throw new Error("fetch failed");
        const blob = await response.blob();

        const localTrack = {
            id: 'loc_' + Date.now(),
            title: trackInfo.title,
            artist: trackInfo.artist,
            filePath: trackInfo.filePath, // original URL tracking source
            genre: trackInfo.genre,
            blob: blob
        };

        await saveTrack(localTrack);
        showToast(`Saved ${trackInfo.title}`);

        // Refresh local UI if active
        if (document.getElementById('subtab-tracks').classList.contains('active')) {
            loadLocalTracks();
        }
    } catch (e) {
        showToast(`Error: ${e.message}`);
    }
}

async function downloadAndPlayRemote(title, artist, url) {
    const tempTrack = {
        id: 'temp_' + Date.now(),
        title: title,
        artist: artist,
        filePath: url,
        isOnline: true
    };
    playTrackList([tempTrack], 0);
    // In Android it technically downloads it. For PWA, playing stream directly is fine 
    downloadAndSaveRemoteTrack(tempTrack); // save in background
}

// ==========================================
// Download / Import Tab Logic (Yandex & Text)
// ==========================================
function setupDownloadTab() {
    UI.download.btnRun.addEventListener('click', async () => {
        const text = UI.download.input.value.trim();
        if (!text) {
            showToast("Input is empty.");
            return;
        }

        UI.download.statusBox.classList.remove('hidden');
        UI.download.progressCont.classList.remove('hidden');
        UI.download.progressFill.style.width = '0%';
        UI.download.results.innerHTML = '';

        UI.download.statusText.textContent = "Parsing...";
        UI.download.btnRun.disabled = true;

        try {
            let list = [];
            // Basic heuristic to differentiate HTML (Yandex) from Text (List)
            if (text.includes('data-title="') || text.includes('d-track__name')) {
                list = parseYandexHtml(text);
            } else {
                list = parseTextList(text);
            }

            if (list.length === 0) {
                logImp("No valid tracks parsed. Check format.");
                return;
            }

            logImp(`Parsed ${list.length} tracks. Commencing search and download.`);

            let successCount = 0;
            for (let i = 0; i < list.length; i++) {
                const query = `${list[i].artist} ${list[i].title}`;
                UI.download.statusText.textContent = `Processing (${i + 1}/${list.length}): ${query}`;

                const results = await fetchHitmotopDirect(query);
                if (results.length > 0) {
                    await downloadAndSaveRemoteTrack(results[0]);
                    successCount++;
                    logImp(`✓ Saved: ${results[0].artist} - ${results[0].title}`);
                } else {
                    logImp(`✗ Not found: ${query}`);
                }

                UI.download.progressFill.style.width = `${((i + 1) / list.length) * 100}%`;

                // Small delay to prevent rate limit (mirroring Android behavior)
                await new Promise(r => setTimeout(r, 800));
            }

            UI.download.statusText.textContent = `Completed! Saved ${successCount} tracks.`;

        } catch (e) {
            logImp(`Fatal Error: ${e.message}`);
            UI.download.statusText.textContent = "Error occurred.";
        } finally {
            UI.download.btnRun.disabled = false;
        }
    });
}

function parseYandexHtml(html) {
    const list = [];
    // Strict Android Regex Port: data-title=\"(.*?)\".*?data-artist=\"(.*?)\"
    const regex = /data-title="(.*?)".*?data-artist="(.*?)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        list.push({ title: match[1].trim(), artist: match[2].trim() });
    }
    return list;
}

function parseTextList(text) {
    const lines = text.split('\n');
    const list = [];
    lines.forEach(line => {
        line = line.trim();
        if (!line) return;
        const parts = line.split('-');
        if (parts.length >= 2) {
            list.push({ artist: parts[0].trim(), title: parts.slice(1).join('-').trim() });
        }
    });
    return list;
}

function logImp(msg) {
    const div = document.createElement('div');
    div.className = 'track-row';
    div.style.padding = '8px 12px';
    div.style.fontSize = '12px';
    div.textContent = msg;
    UI.download.results.appendChild(div);
}

// ==========================================
// Executor Tab Logic (Google Sheets upload)
// ==========================================
function setupExecutorTab() {
    UI.executor.btnRun.addEventListener('click', async () => {
        const payload = {
            action: 'upload',
            artist: UI.executor.artist.value.trim(),
            password: UI.executor.password.value.trim(),
            photoUrl: UI.executor.photo.value.trim(),
            title: UI.executor.title.value.trim(),
            url: UI.executor.url.value.trim()
        };

        if (!payload.artist || !payload.password || !payload.title || !payload.url) {
            executorMsg("Please fill all required fields.", false);
            return;
        }

        UI.executor.btnRun.disabled = true;
        executorMsg("Sending to Google Server...", true);

        try {
            // Replicate Kotlin URLConnection behavior: 
            // We use POST to Google Scripts. Since GAS handles CORS poorly on POST without pre-flight,
            // we proxy exactly like Android `HttpURLConnection(scriptUrl)`.

            const response = await fetch(CONFIG.SCRIPT_URL, {
                method: 'POST',
                // Using NO-CORS or plain text prevents pre-flight blocks on Google Scripts
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const textResponse = await response.text();

            // "Success" or specific error from our apps script
            if (response.ok && textResponse.includes('Success')) {
                executorMsg("Successfully uploaded track layout!", true);
                UI.executor.title.value = '';
                UI.executor.url.value = '';
            } else {
                executorMsg(`Server Reject: ${textResponse}`, false);
            }
        } catch (e) {
            executorMsg(`Network Error: ${e.message}`, false);
        } finally {
            UI.executor.btnRun.disabled = false;
        }
    });
}

function executorMsg(msg, isSuccess) {
    UI.executor.statusMsg.textContent = msg;
    UI.executor.statusMsg.className = `exec-status-msg ${isSuccess ? 'success' : 'error'}`;

    // Add to log
    const li = document.createElement('div');
    li.style.fontSize = '12px';
    li.style.padding = '4px';
    li.style.color = isSuccess ? '#81C784' : '#E57373';
    li.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    UI.executor.logs.prepend(li);
}


// ==========================================
// Player Engine (Replicating PlaybackService)
// ==========================================
function setupPlayerControls() {
    UI.player.audio.addEventListener('timeupdate', () => {
        if (!UI.player.audio.duration) return;
        const pct = (UI.player.audio.currentTime / UI.player.audio.duration) * 100;
        UI.player.seekbar.value = pct;
        UI.player.timeCurrent.textContent = formatTime(UI.player.audio.currentTime);
    });

    UI.player.audio.addEventListener('loadedmetadata', () => {
        UI.player.timeDuration.textContent = formatTime(UI.player.audio.duration);
    });

    UI.player.audio.addEventListener('ended', playNext);

    UI.player.seekbar.addEventListener('input', (e) => {
        if (!UI.player.audio.duration) return;
        const seekTo = UI.player.audio.duration * (e.target.value / 100);
        UI.player.audio.currentTime = seekTo;
    });

    const togglePlay = () => {
        if (UI.player.audio.paused) UI.player.audio.play();
        else UI.player.audio.pause();
    };

    UI.player.audio.addEventListener('play', () => {
        UI.player.iconMiniPlay.textContent = 'pause';
        UI.player.iconFullPlay.textContent = 'pause';
        updateMediaSessionState(true);
    });
    UI.player.audio.addEventListener('pause', () => {
        UI.player.iconMiniPlay.textContent = 'play_arrow';
        UI.player.iconFullPlay.textContent = 'play_arrow';
        updateMediaSessionState(false);
    });

    UI.player.btnMiniPlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
    UI.player.btnFullPlay.addEventListener('click', togglePlay);
    UI.player.btnFullNext.addEventListener('click', playNext);
    UI.player.btnFullPrev.addEventListener('click', playPrev);

    // Expand / Collapse logic 
    // Android: clickable Surface toggles to full screen modal 
    UI.player.mini.addEventListener('click', () => {
        UI.player.mini.classList.add('hidden');
        UI.player.full.classList.remove('hidden');
    });

    UI.player.btnFullCollapse.addEventListener('click', () => {
        UI.player.full.classList.add('hidden');
        UI.player.mini.classList.remove('hidden');
    });

    UI.player.btnFullClose.addEventListener('click', () => {
        UI.player.audio.pause();
        UI.player.audio.src = '';
        UI.player.full.classList.add('hidden');
        UI.player.mini.style.display = 'none'; // Completely hide
    });

    // Setup Media Session API
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
}

function playTrackList(list, index) {
    if (!list || list.length === 0) return;
    currentPlaylist = list;
    currentIndex = index;
    loadAndPlayCurrent();
}

async function loadAndPlayCurrent() {
    UI.player.mini.style.display = 'flex'; // Ensure visible
    const track = currentPlaylist[currentIndex];

    UI.player.miniTitle.textContent = track.title;
    UI.player.miniArtist.textContent = track.artist;
    UI.player.fullTitle.textContent = track.title;
    UI.player.fullArtist.textContent = track.artist;

    // Revoke old blob to save memory
    if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
    }

    if (track.blob) {
        currentBlobUrl = URL.createObjectURL(track.blob);
        UI.player.audio.src = currentBlobUrl;
    } else if (track.isOnline) {
        // It's a remote Hitmotop URL, stream via proxy mapping  (Android plays directly, browsers need CORS for media src too sometimes)
        UI.player.audio.src = CONFIG.PROXY + encodeURIComponent(track.filePath);
    } else {
        // Fallback / legacy
        UI.player.audio.src = track.filePath;
    }

    try {
        await UI.player.audio.play();
    } catch (e) {
        console.error("Autoplay thwarted", e);
    }

    // Update MediaSession Meta
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: track.genre || 'DeltaMusic',
            artwork: [
                { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
            ]
        });
    }
}

function playNext() {
    if (currentPlaylist.length === 0) return;
    if (isShuffle) {
        currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
        currentIndex = (currentIndex + 1) % currentPlaylist.length;
    }
    loadAndPlayCurrent();
}

function playPrev() {
    if (currentPlaylist.length === 0) return;
    currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    loadAndPlayCurrent();
}

function updateMediaSessionState(isPlaying) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
}

// ==========================================
// Utilities
// ==========================================
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function showToast(msg) {
    UI.toast.textContent = msg;
    UI.toast.classList.remove('hidden');
    setTimeout(() => {
        UI.toast.classList.add('hidden');
    }, 3000);
}

// Bootstrap
document.addEventListener('DOMContentLoaded', initApp);
