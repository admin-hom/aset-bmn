// ===== PAGE ROUTER =====
// Handles fetching page templates and rendering the app shell.
// Each page template is a standalone HTML fragment in pages/ directory.

const Router = {
    currentPage: null,
    _cache: {},

    async loadTemplate(page) {
        if (this._cache[page]) return this._cache[page];
        try {
            const resp = await fetch(`pages/${page}.html`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const html = await resp.text();
            this._cache[page] = html;
            return html;
        } catch (err) {
            console.error('Router: failed to load page:', page, err);
            return `<div class="empty-state"><p>Gagal memuat halaman: ${page}</p></div>`;
        }
    },

    async navigate(page) {
        const app = document.getElementById('app');
        if (!app) return;

        const APP_PAGES = ['home', 'verifikasi', 'detail', 'dashboard', 'import', 'settings', 'history'];
        const template = await this.loadTemplate(page);

        if (APP_PAGES.includes(page)) {
            // Render app shell: header + page content + bottom nav
            const satkerName = SATKER_MAP[currentSatker] || '';
            app.innerHTML = `
                <header class="app-header">
                    <button class="btn-icon" onclick="goBack()">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <div class="header-title">
                        <span id="headerSatkerName">${escapeHtml(satkerName)}</span>
                        <span id="syncIndicator" class="sync-indicator"></span>
                    </div>
                    <button class="btn-icon" onclick="showPage('home')">
                        <i class="fas fa-chart-pie"></i>
                    </button>
                </header>
                <div class="pages-container">
                    ${template}
                </div>
                <nav class="bottom-nav">
                    <button class="nav-item ${page === 'home' ? 'active' : ''}" onclick="showPage('home')" data-page="home">
                        <i class="fas fa-home"></i><span>Beranda</span>
                    </button>
                    <button class="nav-item ${page === 'verifikasi' ? 'active' : ''}" onclick="showPage('verifikasi')" data-page="verifikasi">
                        <i class="fas fa-clipboard-check"></i><span>Verifikasi</span>
                    </button>
                    <button class="nav-item ${page === 'import' ? 'active' : ''}" onclick="showPage('import')" data-page="import">
                        <i class="fas fa-file-import"></i><span>Import</span>
                    </button>
                    <button class="nav-item ${page === 'history' ? 'active' : ''}" onclick="showPage('history')" data-page="history">
                        <i class="fas fa-history"></i><span>Riwayat</span>
                    </button>
                    <button class="nav-item ${page === 'settings' ? 'active' : ''}" onclick="showPage('settings')" data-page="settings">
                        <i class="fas fa-cog"></i><span>Setting</span>
                    </button>
                </nav>
            `;
            renderSyncIndicator();
        } else {
            // Standalone page (satker, admin)
            app.innerHTML = template;
        }

        // Call page init function if it exists
        const initFn = `init_${page}`;
        if (typeof window[initFn] === 'function') {
            window[initFn]();
        }

        this.currentPage = page;
    }
};

// ===== PAGE INIT FUNCTIONS =====
// Called after a page template is injected into the DOM.

function init_home() {
    // Refresh currentAssets from allAssets
    if (currentSatker && allAssets[currentSatker]) {
        currentAssets = allAssets[currentSatker];
    }
    updateStats();
    renderUnverifiedList();
    renderRecentList();
    renderKondisiStats();
}

function init_verifikasi() {
    // Refresh currentAssets from allAssets (in case data loaded from Firestore)
    if (currentSatker && allAssets[currentSatker]) {
        currentAssets = allAssets[currentSatker];
    }
    setupFormListeners();
    clearSearchFields();
    renderUnverifiedList();
    renderRecentList();
}

function init_detail() {
    if (pendingDetailAsset) {
        renderAssetDetail(pendingDetailAsset);
        pendingDetailAsset = null;
    }
}

function init_dashboard() {
    updateStats();
}

function init_import() {
    setupDragDrop();
}

function init_settings() {
    loadDarkMode();
    renderSyncIndicator();
}

function init_history() {
    filterHistory();
}

function init_satker() {
    // Landing page — no init needed
}

function init_admin() {
    // Admin page — no init needed
}
