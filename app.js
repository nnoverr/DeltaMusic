/* ========================================= */
/* DeltaMusic PWA Logic (Android 1:1 Port)   */
/* ========================================= */

const CONFIG = {
    PROXIES: [
        "https://api.allorigins.win/raw?url=",
        "https://api.codetabs.com/v1/proxy?quest=",
        "https://corsproxy.org/?",
        "https://corsproxy.io/?",
        "https://thingproxy.freeboard.io/fetch/"
    ],
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw0d4RGncqnwKla0E7YK06xyAD2He5-w-08DZ1QvkbEofRnEg8pv73jLDtdJaXBbucrFA/exec",
    DB_NAME: "DeltaMusicDB",
    DB_VERSION: 3,
    STORE_NAME: "tracks"
};

// --- UTILS ---
async function fetchWithRetry(url, options = {}, isText = false) {
    let lastError;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Priority 1: Local Proxy (if available)
    if (isLocal) {
        try {
            const res = await fetch("/api/proxy?url=" + encodeURIComponent(url), options);
            if (res.ok) return isText ? res.text() : res;
        } catch (e) { console.warn("Local proxy failed..."); }
    }

    // Priority 2: Random rotation of public proxies
    const shuffledProxies = [...CONFIG.PROXIES].sort(() => Math.random() - 0.5);

    for (const proxy of shuffledProxies) {
        try {
            const needsEncoding = proxy.includes('allorigins') || proxy.includes('codetabs');
            const proxiedUrl = proxy + (needsEncoding ? encodeURIComponent(url) : url);

            const res = await fetch(proxiedUrl, options);
            if (res.ok) {
                if (isText) {
                    let text = await res.text();
                    // Handle AllOrigins JSON wrapper
                    if (proxy.includes('allorigins')) {
                        try {
                            const json = JSON.parse(text);
                            if (json.contents) text = json.contents;
                        } catch (e) { }
                    }
                    return text;
                }
                return res;
            }
            console.warn(`Proxy ${proxy} returned ${res.status}`);
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${proxy} failed:`, e);
        }
    }

    // Priority 3: Final attempt via direct fetch
    try {
        const res = await fetch(url, options);
        if (res.ok) return isText ? res.text() : res;
    } catch (e) { }

    throw lastError || new Error("All proxies failed");
}

let db;
let playlist = [];
let curIdx = -1;
let isShuffle = false;
let blobUrl = null;
let UI = {};

// --- DATABASE ---
function initDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
        req.onupgradeneeded = (e) => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(CONFIG.STORE_NAME)) {
                const s = d.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'id' });
                s.createIndex('artist', 'artist', { unique: false });
            }
        };
        req.onsuccess = (e) => { db = e.target.result; res(); };
        req.onerror = rej;
    });
}
function getAllTracks() {
    return new Promise(res => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readonly');
        const req = tx.objectStore(CONFIG.STORE_NAME).getAll();
        req.onsuccess = () => res(req.result || []);
    });
}
function saveTrack(t) {
    return new Promise(res => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.objectStore(CONFIG.STORE_NAME).put(t);
        tx.oncomplete = () => res();
    });
}
function deleteTrack(id) {
    return new Promise(res => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        tx.objectStore(CONFIG.STORE_NAME).delete(id);
        tx.oncomplete = () => res();
    });
}

// --- TOAST ---
function showToast(msg) {
    if (UI.toast) {
        UI.toast.textContent = msg;
        UI.toast.classList.remove('hidden');
        setTimeout(() => UI.toast.classList.add('hidden'), 3000);
    }
}

// --- NAVIGATION ---
function initNav() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            UI.screens.forEach(s => s.classList.remove('active'));
            const targetId = item.dataset.target;
            const target = document.getElementById(targetId);
            if (target) {
                target.classList.add('active');
                if (targetId === 'screen-library') loadTracks();
            }
        });
    });

    UI.library.tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            UI.library.tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            UI.library.subScreens.forEach(s => s.classList.remove('active'));
            const subId = btn.dataset.subtab;
            const subtab = document.getElementById(`subtab-${subId}`);
            if (subtab) subtab.classList.add('active');

            UI.library.search.container.classList.toggle('hidden', subId !== 'online');

            if (subId === 'online' && !UI.library.lists.online.hasChildNodes()) searchOnline("");
            if (subId === 'tracks') loadTracks();
            if (subId === 'artists') loadArtists();
            if (subId === 'foryou') loadForYou();
        });
    });
}

// --- LOGIC ---
async function loadTracks() {
    const tracks = await getAllTracks();
    const sorted = tracks.sort((a, b) => a.artist.localeCompare(b.artist));
    UI.library.lists.tracks.innerHTML = sorted.length ? '' : '<div style="text-align:center; padding:40px; opacity:0.5;">No tracks in library</div>';
    sorted.forEach((t, i) => {
        UI.library.lists.tracks.appendChild(createRow(t, false, () => playList(sorted, i), async (e) => {
            e.stopPropagation();
            if (confirm('Delete?')) { await deleteTrack(t.id); loadTracks(); showToast('Deleted'); }
        }));
    });
}

async function loadArtists() {
    const tracks = await getAllTracks();
    const cont = UI.library.lists.artists;
    cont.innerHTML = '';
    const map = {};
    tracks.forEach(t => { if (!map[t.artist]) map[t.artist] = []; map[t.artist].push(t); });
    Object.keys(map).sort().forEach(art => {
        const g = document.createElement('div'); g.className = 'artist-group';
        g.innerHTML = `<div class="artist-group-header"><div class="artist-group-avatar"><span class="material-symbols-outlined">person</span></div><div class="artist-group-name">${art}</div></div>`;
        map[art].forEach((t, i) => g.appendChild(createRow(t, false, () => playList(map[art], i))));
        cont.appendChild(g);
    });
}

async function loadForYou() {
    const cont = UI.library.lists.foryou;
    if (cont.hasChildNodes() && cont.children.length > 1) return;
    cont.innerHTML = '<div style="display:flex; justify-content:center; padding:40px;"><div class="loading-spinner"></div></div>';
    try {
        const text = await fetchWithRetry(`${CONFIG.SCRIPT_URL}?action=getCards`, {}, true);
        const data = JSON.parse(text);
        cont.innerHTML = '';
        data.sort(() => 0.5 - Math.random()).forEach(item => {
            const card = document.createElement('div'); card.className = 'artist-media-card';
            const photo = (item.photos && item.photos.length) ? item.photos[item.photos.length - 1] : null;
            const photoHtml = photo ? `<img src="${photo}" class="artist-media-photo">` : `<div class="artist-media-photo" style="display:flex; align-items:center; justify-content:center;"><span class="material-symbols-outlined" style="font-size:48px; opacity:0.3;">person</span></div>`;
            let rows = '';
            item.tracks.forEach(t => {
                const sT = t.title.replace(/'/g, "\\'");
                const sA = item.name.replace(/'/g, "\\'");
                rows += `<div class="track-row" onclick="playRemote('${sT}', '${sA}', '${t.url}')">
                    <div class="track-cover gradient-cover online"><span class="material-symbols-outlined">public</span></div>
                    <div class="track-info"><div class="track-title">${t.title}</div><div class="track-artist">${item.name}</div></div>
                    <button class="track-action color-pink" onclick="event.stopPropagation(); window.dlSaveTarget('${sT}', '${sA}', '${t.url}')"><span class="material-symbols-outlined">cloud_download</span></button>
                </div>`;
            });
            card.innerHTML = `${photoHtml}<div class="artist-media-content"><div class="artist-media-title">${item.name}</div><div class="track-list">${rows}</div></div>`;
            cont.appendChild(card);
        });
    } catch (e) { cont.innerHTML = '<div style="text-align:center; padding:40px; opacity:0.5;">Recommendations unavailable</div>'; }
}
window.dlSaveTarget = (t, a, u) => dlSave({ title: t, artist: a, filePath: u });

async function searchOnline(q) {
    UI.library.lists.online.innerHTML = '<div style="display:flex; justify-content:center; padding:40px;"><div class="loading-spinner"></div></div>';
    try {
        const res = await fetchMuzofond(q);
        UI.library.lists.online.innerHTML = '';
        if (!res.length) {
            UI.library.lists.online.innerHTML = '<div style="text-align:center; padding:40px; opacity:0.5;">No tracks found</div>';
            return;
        }
        res.forEach((t, i) => {
            UI.library.lists.online.appendChild(createRow(t, true, () => playList(res, i), (e) => { e.stopPropagation(); dlSave(t); }));
        });
    } catch (e) { UI.library.lists.online.innerHTML = '<div style="text-align:center; padding:40px; opacity:0.5;">Search failed. Try again.</div>'; }
}

async function fetchMuzofond(q) {
    const target = q ? `https://muzofond.fm/search/${encodeURIComponent(q)}` : `https://muzofond.fm/`;
    const html = await fetchWithRetry(target, {}, true);
    const items = [];
    const blocks = html.split('<li class="item"');
    for (let i = 1; i < blocks.length; i++) {
        const b = blocks[i];
        const u = /data-url="([^"]+)"/.exec(b), a = /<span class="artist">([^<]+)<\/span>/.exec(b), t = /<span class="track">([^<]+)<\/span>/.exec(b);
        if (u && a && t) items.push({ id: 'net_' + Math.random().toString(36).slice(2), title: t[1].trim(), artist: a[1].trim(), filePath: u[1], isOnline: true });
    }
    return items;
}

async function dlSave(t) {
    showToast(`Downloading: ${t.title}...`);
    try {
        const res = await fetchWithRetry(t.filePath);
        const blob = await res.blob();
        await saveTrack({ id: 'loc_' + Date.now(), title: t.title, artist: t.artist, filePath: t.filePath, blob });
        showToast(`Saved ${t.title}`);
        if (document.getElementById('subtab-tracks').classList.contains('active')) loadTracks();
    } catch (e) { showToast('Download failed'); }
}

function playRemote(t, a, u) {
    const track = { id: 'tmp', title: t, artist: a, filePath: u, isOnline: true };
    playList([track], 0);
}

function createRow(t, online, onClick, onAction) {
    const r = document.createElement('div'); r.className = 'track-row'; r.onclick = onClick;
    const icon = online ? 'public' : 'music_note';
    const bg = online ? 'gradient-cover online' : 'gradient-cover';
    const action = online ? '<button class="track-action color-pink"><span class="material-symbols-outlined">cloud_download</span></button>' : '<button class="track-action color-red"><span class="material-symbols-outlined">delete</span></button>';
    r.innerHTML = `<div class="track-cover ${bg}"><span class="material-symbols-outlined">${icon}</span></div><div class="track-info"><div class="track-title">${t.title}</div><div class="track-artist">${t.artist}</div></div>${action}`;
    const btn = r.querySelector('.track-action');
    if (btn) btn.onclick = onAction;
    return r;
}

// --- PLAYER ---
function playList(list, i) { playlist = list; curIdx = i; playCur(); }
async function playCur() {
    const t = playlist[curIdx];
    UI.player.miniTitle.textContent = UI.player.fullTitle.textContent = t.title;
    UI.player.miniArtist.textContent = UI.player.fullArtist.textContent = t.artist;
    UI.player.mini.classList.remove('hidden');
    if (blobUrl) URL.revokeObjectURL(blobUrl);

    if (t.blob) {
        blobUrl = URL.createObjectURL(t.blob);
        UI.player.audio.src = blobUrl;
    } else {
        const shuffledProxies = [...CONFIG.PROXIES].sort(() => Math.random() - 0.5);
        for (const proxy of shuffledProxies) {
            const needsEncoding = proxy.includes('allorigins') || proxy.includes('codetabs');
            UI.player.audio.src = proxy + (needsEncoding ? encodeURIComponent(t.filePath) : t.filePath);
            break;
        }
    }
    UI.player.audio.play().catch(() => { });
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist });
    }
}
function playNext() { curIdx = isShuffle ? Math.floor(Math.random() * playlist.length) : (curIdx + 1) % playlist.length; playCur(); }
function playPrev() { curIdx = (curIdx - 1 + playlist.length) % playlist.length; playCur(); }

function initPlayer() {
    const audio = UI.player.audio;
    audio.ontimeupdate = () => { if (audio.duration) { UI.player.seekbar.value = (audio.currentTime / audio.duration) * 100; UI.player.timeCurrent.textContent = fmt(audio.currentTime); } };
    audio.onloadedmetadata = () => { UI.player.timeDuration.textContent = fmt(audio.duration); };
    audio.onended = playNext;
    UI.player.seekbar.oninput = (e) => { if (audio.duration) audio.currentTime = audio.duration * (e.target.value / 100); };

    const toggle = () => audio.paused ? audio.play() : audio.pause();
    UI.player.btnMiniPlay.onclick = (e) => { e.stopPropagation(); toggle(); };
    UI.player.btnFullPlay.onclick = toggle;
    document.getElementById('btn-full-next').onclick = playNext;
    document.getElementById('btn-full-prev').onclick = playPrev;

    audio.onplay = () => UI.player.iconMiniPlay.textContent = UI.player.iconFullPlay.textContent = 'pause';
    audio.onpause = () => UI.player.iconMiniPlay.textContent = UI.player.iconFullPlay.textContent = 'play_arrow';

    UI.player.mini.onclick = () => UI.player.full.classList.remove('hidden');
    document.getElementById('btn-full-collapse').onclick = () => UI.player.full.classList.add('hidden');
    document.getElementById('btn-full-close').onclick = () => { audio.pause(); audio.src = ''; UI.player.mini.classList.add('hidden'); UI.player.full.classList.add('hidden'); };

    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', toggle);
        navigator.mediaSession.setActionHandler('pause', toggle);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
}

function fmt(s) { const m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ':' + (sec < 10 ? '0' : '') + sec; }

// --- IMPORT & EXECUTOR ---
function initForms() {
    const btnRunImport = document.getElementById('btn-run-import');
    if (btnRunImport) {
        btnRunImport.onclick = async () => {
            const val = document.getElementById('import-input').value.trim();
            if (!val) return;
            const log = document.getElementById('import-results'); log.innerHTML = '';
            document.getElementById('import-status').classList.remove('hidden');
            const fill = document.getElementById('import-progress-fill'); fill.style.width = '0%';

            let list = [];
            if (val.includes('data-title="')) {
                const re = /data-title="(.*?)".*?data-artist="(.*?)"/g; let m;
                while ((m = re.exec(val))) list.push({ title: m[1].trim(), artist: m[2].trim() });
            } else {
                val.split('\n').filter(l => l.trim()).forEach(l => {
                    const p = l.split('-'); if (p.length >= 2) list.push({ artist: p[0].trim(), title: p.slice(1).join('-').trim() });
                });
            }
            btnRunImport.disabled = true;
            for (let i = 0; i < list.length; i++) {
                const q = `${list[i].artist} ${list[i].title}`;
                document.getElementById('import-status-text').textContent = `Processing (${i + 1}/${list.length})`;
                try {
                    const res = await fetchMuzofond(q);
                    if (res.length) { await dlSave(res[0]); log.innerHTML += `<div style="font-size:12px; opacity:0.7;">✓ Saved: ${res[0].artist} - ${res[0].title}</div>`; }
                    else { log.innerHTML += `<div style="font-size:12px; color:#E57373;">✗ Not found: ${q}</div>`; }
                } catch (e) { log.innerHTML += `<div style="font-size:12px; color:#E57373;">✗ Error: ${q}</div>`; }
                fill.style.width = `${((i + 1) / list.length) * 100}%`;
                await new Promise(r => setTimeout(r, 800));
            }
            btnRunImport.disabled = false;
            document.getElementById('import-status').classList.add('hidden');
        };
    }

    const btnRunExecutor = document.getElementById('btn-run-executor');
    if (btnRunExecutor) {
        btnRunExecutor.onclick = async () => {
            btnRunExecutor.disabled = true;
            const resEl = document.getElementById('executor-results');
            const msg = (s, ok) => {
                const st = document.getElementById('exec-status'); st.textContent = s; st.className = ok ? 'hidden' : '';
                st.style.background = ok ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)';
                st.style.color = ok ? '#81C784' : '#E57373'; st.classList.remove('hidden');
                resEl.innerHTML = `<div style="font-size:12px; color:${ok ? '#81C784' : '#E57373'}">[${new Date().toLocaleTimeString()}] ${s}</div>` + resEl.innerHTML;
            };
            try {
                const payload = {
                    action: 'upload',
                    artist: document.getElementById('exec-artist').value.trim(),
                    password: document.getElementById('exec-password').value.trim(),
                    photoUrl: document.getElementById('exec-photo').value.trim(),
                    title: document.getElementById('exec-title').value.trim(),
                    url: document.getElementById('exec-url').value.trim()
                };
                const res = await fetch(CONFIG.SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
                const text = await res.text();
                if (text.includes('Success')) { msg("Success!", true); document.getElementById('exec-title').value = ''; document.getElementById('exec-url').value = ''; }
                else msg(text, false);
            } catch (e) { msg("Error", false); }
            btnRunExecutor.disabled = false;
        };
    }
}

// --- INIT ---
function initApp() {
    UI = {
        navItems: document.querySelectorAll('.nav-item'),
        screens: document.querySelectorAll('.screen'),
        toast: document.getElementById('global-toast'),
        library: {
            tabs: document.querySelectorAll('.sub-tab-btn'),
            subScreens: document.querySelectorAll('.sub-screen'),
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
        player: {
            audio: document.getElementById('audio-player'),
            mini: document.getElementById('player-mini'),
            full: document.getElementById('player-full'),
            miniTitle: document.getElementById('mini-title'),
            miniArtist: document.getElementById('mini-artist'),
            fullTitle: document.getElementById('full-title'),
            fullArtist: document.getElementById('full-artist'),
            btnMiniPlay: document.getElementById('btn-mini-play'),
            iconMiniPlay: document.getElementById('icon-mini-play'),
            btnFullPlay: document.getElementById('btn-full-play'),
            iconFullPlay: document.getElementById('icon-full-play'),
            seekbar: document.getElementById('player-seekbar'),
            timeCurrent: document.getElementById('time-current'),
            timeDuration: document.getElementById('time-duration')
        }
    };

    initDB().then(() => loadTracks());
    initNav();
    initPlayer();
    initForms();

    const searchInput = document.getElementById('library-search-input');
    if (searchInput) {
        let deb;
        searchInput.oninput = (e) => {
            clearTimeout(deb);
            deb = setTimeout(() => searchOnline(e.target.value.trim()), 1000);
        };
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                clearTimeout(deb);
                searchOnline(e.target.value.trim());
            }
        };
    }
    const btnShuffle = document.getElementById('btn-toggle-shuffle');
    if (btnShuffle) {
        btnShuffle.onclick = () => { isShuffle = !isShuffle; UI.library.btnShuffle.classList.toggle('active', isShuffle); };
    }
    const btnPlayChart = document.getElementById('btn-play-chart');
    if (btnPlayChart) {
        btnPlayChart.onclick = async () => {
            UI.library.chartSpinner.classList.remove('hidden');
            try {
                const res = await fetchMuzofond("");
                UI.library.chartSpinner.classList.add('hidden');
                const s = res.sort(() => 0.5 - Math.random()).slice(0, 20);
                if (s.length) { playList(s, 0); showToast("Playing Your Chart"); }
                else showToast("Chart empty");
            } catch (e) {
                UI.library.chartSpinner.classList.add('hidden');
                showToast("Service error");
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', initApp);
