// ===== APP STATE =====
let currentSatker = null;
let currentAssets = []; // Assets for current satker
let allAssets = {}; // All assets grouped by satker
let verifications = {}; // Verifications grouped by satker
let currentAsset = null;
let currentPhoto = null;
let firebaseApp = null;
let firebaseDb = null;
let isOnline = navigator.onLine;
let syncStatus = 'local'; // local | syncing | synced | error

const SATKER_MAP = {
    sekretariat: 'Sekretariat Jendral',
    pendidikan: 'Pendidikan Islam',
    bimas: 'Bimbingan Masyarakat Islam'
};

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    loadData();
    setupDragDrop();
    setupFormListeners();
    loadDarkMode();
    renderSyncIndicator();
    registerServiceWorker();
    setupInstallPrompt();
    hideSplashScreen();
});

// ===== SPLASH SCREEN =====
function hideSplashScreen() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    setTimeout(() => {
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 500);
    }, 1200);
}

// ===== SERVICE WORKER =====
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js').then(reg => {
        console.log('SW registered, scope:', reg.scope);
        setInterval(() => reg.update(), 30000);

        reg.addEventListener('updatefound', () => {
            const newSW = reg.installing;
            newSW.addEventListener('statechange', () => {
                if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBanner();
                }
            });
        });
    }).catch(err => {
        console.log('SW registration failed:', err);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}

function showUpdateBanner() {
    if (document.getElementById('updateBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'updateBanner';
    banner.className = 'update-banner';
    banner.innerHTML = `
        <div class="update-banner-content">
            <i class="fas fa-sync-alt"></i>
            <span>Versi baru tersedia!</span>
            <button class="btn btn-primary btn-sm" onclick="applyUpdate()">
                <i class="fas fa-redo"></i> Update
            </button>
        </div>
    `;
    document.body.appendChild(banner);
}

function applyUpdate() {
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg && reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }
}

// ===== PWA INSTALL PROMPT =====
let deferredPrompt = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        const banner = document.getElementById('installBanner');
        if (banner) banner.classList.add('hidden');
        showToast('Aplikasi berhasil diinstal!', 'success');
    });

    if (isIOS && !isStandalone && !localStorage.getItem('installDismissed')) {
        showInstallBanner();
    }
}

function showInstallBanner() {
    if (localStorage.getItem('installDismissed')) return;
    if (isStandalone) return;

    const banner = document.getElementById('installBanner');
    const hint = document.getElementById('installHint');
    const btn = document.getElementById('btnInstall');

    if (!banner) return;

    if (isIOS) {
        if (hint) hint.textContent = 'Tap \u203c bagikan\u203e lalu \u201cTambahkan ke Layar Utama\u201d';
        if (btn) btn.innerHTML = '<i class="fas fa-arrow-up"></i> Share';
    }

    banner.classList.remove('hidden');
}

function installApp() {
    if (isIOS) {
        showToast('Tap tombol Share (\u2212) di bawah, lalu pilih \u201cTambahkan ke Layar Utama\u201d', 'info');
        return;
    }

    if (!deferredPrompt) {
        showToast('Buka di Chrome/Edge Android untuk install otomatis', 'info');
        return;
    }

    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
            showToast('Menginstal aplikasi...', 'info');
        }
        deferredPrompt = null;
        const banner = document.getElementById('installBanner');
        if (banner) banner.classList.add('hidden');
    });
}

function dismissInstall() {
    localStorage.setItem('installDismissed', 'true');
    const banner = document.getElementById('installBanner');
    if (banner) banner.classList.add('hidden');
}

// ===== PUSH NOTIFICATIONS =====
function requestNotificationPermission() {
    if (!('Notification' in window)) return Promise.resolve('denied');
    if (Notification.permission === 'granted') return Promise.resolve('granted');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    return Notification.requestPermission();
}

function sendSyncNotification(assetName) {
    requestNotificationPermission().then(permission => {
        if (permission !== 'granted') return;

        try {
            const notif = new Notification('Terverifikasi ✓', {
                body: `${assetName} berhasil diverifikasi & disync ke cloud`,
                icon: 'icon-192.svg',
                badge: 'icon-192.svg',
                tag: 'verify-' + Date.now(),
                silent: true
            });
            setTimeout(() => notif.close(), 3000);
        } catch (e) {
            console.log('Notification not supported:', e);
        }
    });
}

// ===== DATA MANAGEMENT =====
function loadData() {
    try {
        allAssets = JSON.parse(localStorage.getItem('allAssets')) || { sekretariat: [], pendidikan: [], bimas: [] };
        verifications = JSON.parse(localStorage.getItem('verifications')) || { sekretariat: [], pendidikan: [], bimas: [] };
    } catch (e) {
        allAssets = { sekretariat: [], pendidikan: [], bimas: [] };
        verifications = { sekretariat: [], pendidikan: [], bimas: [] };
    }
}

function saveLocal() {
    localStorage.setItem('allAssets', JSON.stringify(allAssets));
    localStorage.setItem('verifications', JSON.stringify(verifications));
}

function saveData() {
    saveLocal();
    pushToFirebase();
}

// ===== SATKER SELECTION =====
function selectSatker(satker) {
    currentSatker = satker;
    currentAssets = allAssets[satker] || [];
    document.getElementById('headerSatkerName').textContent = SATKER_MAP[satker];
    unverifiedShowCount = 10;
    showPage('dashboard');
    updateStats();
    renderRecentList();
    renderUnverifiedList();
    forceLoadFromFirestore(satker);
}

function goBack() {
    showPage('satker');
}

// ===== NAVIGATION =====
function showPage(page) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    if (page === 'satker' || page === 'admin') {
        document.getElementById(`screen-${page}`).classList.add('active');
        if (page === 'admin') {
            document.getElementById('screen-admin').classList.add('active');
        } else {
            document.getElementById('screen-satker').classList.add('active');
        }
    } else {
        document.getElementById('screen-app').classList.add('active');
        document.querySelectorAll('.pages-container .page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) targetPage.classList.add('active');

        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navItem) navItem.classList.add('active');

        if (page === 'history') filterHistory();
        if (page === 'home') {
            renderUnverifiedList();
            clearSearchFields();
        }
    }
}

function clearSearchFields() {
    document.getElementById('inputKodeBarang').value = '';
    document.getElementById('inputNUP').value = '';
    document.getElementById('inputSearchName').value = '';
    const results = document.getElementById('searchNameResults');
    if (results) {
        results.classList.add('hidden');
        results.innerHTML = '';
    }
}

// ===== MODAL =====
function closeModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

function showSuccessModal(message) {
    document.getElementById('successMessage').textContent = message;
    document.getElementById('successModal').classList.add('show');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('show');
    showPage('home');
}

// ===== TOAST =====
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== DARK MODE =====
function loadDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    const toggle = document.getElementById('darkModeToggle');
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
    if (toggle) toggle.checked = isDark;
}

function toggleDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const isDark = toggle.checked;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('darkMode', isDark);
}

// ===== HELPERS =====
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num || 0);
}

function setupFormListeners() {
    const inputNUP = document.getElementById('inputNUP');
    if (inputNUP) {
        inputNUP.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchAsset();
            }
        });
    }
}

// ===== SERVICE WORKER (duplicate registration guard) =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}
