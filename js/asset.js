// ===== SEARCH ASSET =====
let pendingDetailAsset = null;

function searchAsset() {
    const kodeBarang = document.getElementById('inputKodeBarang').value.trim();
    const nup = document.getElementById('inputNUP').value.trim();

    if (!kodeBarang || !nup) {
        showToast('Masukkan Kode Barang dan NUP!', 'error');
        return;
    }

    const asset = currentAssets.find(a =>
        a.kodeBarang === kodeBarang && a.nup === nup
    );

    if (!asset) {
        showToast('Aset tidak ditemukan! Import data SIMAN dulu.', 'error');
        return;
    }

    currentAsset = asset;
    pendingDetailAsset = asset;
    showPage('detail');
}

function renderAssetDetail(asset) {
    const container = document.getElementById('assetDetail');
    const statusClass = asset.statusBMN === 'Aktif' ? 'aktif' : 'tidak-aktif';

    const existingVerification = (verifications[currentSatker] || []).find(v =>
        v.kodeBarang === asset.kodeBarang && v.nup === asset.nup
    );

    container.innerHTML = `
        <span class="asset-badge ${statusClass}">${asset.statusBMN || 'Aktif'}</span>
        <h3>${escapeHtml(asset.namaBarang || 'Tanpa Nama')}</h3>
        <p class="asset-subtitle">${escapeHtml(asset.merk || '')} ${escapeHtml(asset.tipe || '')}</p>
        <div class="detail-grid">
            <div class="detail-item">
                <span class="di-label">Kode Barang</span>
                <span class="di-value">${escapeHtml(asset.kodeBarang || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="di-label">NUP</span>
                <span class="di-value">${escapeHtml(asset.nup || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="di-label">Kondisi</span>
                <span class="di-value">${escapeHtml(asset.kondisi || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="di-label">Nilai Buku</span>
                <span class="di-value">Rp ${formatNumber(asset.nilaiBuku || 0)}</span>
            </div>
            <div class="detail-item full-width">
                <span class="di-label">Jenis BMN</span>
                <span class="di-value">${escapeHtml(asset.jenisBMN || '-')}</span>
            </div>
        </div>
        ${existingVerification ? `
            <div class="verified-banner">
                <div class="verified-info">
                    <strong><i class="fas fa-check-circle"></i> Sudah Diverifikasi</strong>
                    <p>Lokasi: ${escapeHtml(existingVerification.lokasi || '-')} | Kondisi: ${escapeHtml(existingVerification.kondisiAktual || '-')}</p>
                </div>
                <div class="verified-actions">
                    <button class="btn btn-sm btn-primary" onclick="editVerification()">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteVerification()">
                        <i class="fas fa-trash"></i> Hapus
                    </button>
                </div>
            </div>
        ` : ''}
    `;

    if (existingVerification) {
        document.getElementById('inputLokasi').value = existingVerification.lokasi || '';
        const kondisiRadio = document.querySelector(`input[name="kondisi"][value="${existingVerification.kondisiAktual}"]`);
        if (kondisiRadio) kondisiRadio.checked = true;
        document.getElementById('inputCatatan').value = existingVerification.catatan || '';
        if (existingVerification.foto) {
            showPhotoPreview(existingVerification.foto);
        }
    } else {
        document.getElementById('inputLokasi').value = '';
        document.querySelectorAll('input[name="kondisi"]').forEach(r => r.checked = false);
        document.getElementById('inputCatatan').value = '';
        resetPhoto();
    }

    updateLocationAutocomplete();
}

// ===== SEARCH BY NAME =====
function searchByName() {
    const input = document.getElementById('inputSearchName');
    const container = document.getElementById('searchNameResults');
    if (!input || !container) return;

    const query = input.value.trim().toLowerCase();

    if (query.length < 2) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    const verifiedSet = new Set(
        (verifications[currentSatker] || []).map(v => v.kodeBarang + '|' + v.nup)
    );

    const results = currentAssets.filter(a => {
        const haystack = [a.namaBarang, a.merk, a.tipe, a.kodeBarang, a.nup, a.jenisBMN]
            .join(' ').toLowerCase();
        return haystack.includes(query);
    }).slice(0, 20);

    container.classList.remove('hidden');

    if (results.length === 0) {
        container.innerHTML = `<div class="snr-empty">Tidak ditemukan untuk "${escapeHtml(input.value.trim())}"</div>`;
        return;
    }

    container.innerHTML = results.map(a => {
        const isVerified = verifiedSet.has(a.kodeBarang + '|' + a.nup);
        const badgeClass = isVerified ? 'verified' : 'unverified';
        const badgeText = isVerified ? '✓ Verified' : 'Belum';

        return `
            <div class="snr-item" onclick="goVerifyAsset('${escapeHtml(a.kodeBarang)}', '${escapeHtml(a.nup)}')">
                <div class="snr-icon">
                    <i class="fas fa-box-open"></i>
                </div>
                <div class="snr-info">
                    <div class="snr-name">${escapeHtml(a.namaBarang || 'Tanpa Nama')}</div>
                    <div class="snr-detail">${escapeHtml(a.merk || '')} ${escapeHtml(a.tipe || '')} | KB: ${escapeHtml(a.kodeBarang)} | NUP: ${escapeHtml(a.nup)}</div>
                </div>
                <span class="snr-badge ${badgeClass}">${badgeText}</span>
            </div>
        `;
    }).join('');
}

// ===== UNVERIFIED LIST =====
let unverifiedShowCount = 10;

function renderUnverifiedList() {
    const container = document.getElementById('unverifiedList');
    const countEl = document.getElementById('unverifiedCount');
    const btnMore = document.getElementById('btnLoadMore');
    if (!container) return;

    const verifiedSet = new Set(
        (verifications[currentSatker] || []).map(v => v.kodeBarang + '|' + v.nup)
    );

    const unverified = currentAssets.filter(a => !verifiedSet.has(a.kodeBarang + '|' + a.nup));

    if (countEl) {
        countEl.textContent = unverified.length > 0 ? unverified.length : '';
    }

    if (unverified.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas fa-check-circle"></i>
                <p>Semua aset sudah terverifikasi!</p>
            </div>
        `;
        if (btnMore) btnMore.classList.add('hidden');
        return;
    }

    const showItems = unverified.slice(0, unverifiedShowCount);

    container.innerHTML = showItems.map(a => `
        <div class="unverified-item" onclick="goVerifyAsset('${escapeHtml(a.kodeBarang)}', '${escapeHtml(a.nup)}')">
            <div class="uv-icon">
                <i class="fas fa-box-open"></i>
            </div>
            <div class="uv-info">
                <div class="uv-name">${escapeHtml(a.namaBarang || 'Tanpa Nama')}</div>
                <div class="uv-detail">${escapeHtml(a.merk || '')} ${escapeHtml(a.tipe || '')} | KB: ${escapeHtml(a.kodeBarang)} | NUP: ${escapeHtml(a.nup)}</div>
            </div>
            <span class="uv-action">Verifikasi →</span>
        </div>
    `).join('');

    if (btnMore) {
        if (unverified.length > unverifiedShowCount) {
            btnMore.classList.remove('hidden');
            btnMore.innerHTML = `<i class="fas fa-arrow-down"></i> Tampilkan ${unverified.length - unverifiedShowCount} Lagi`;
        } else {
            btnMore.classList.add('hidden');
        }
    }
}

function loadMoreUnverified() {
    unverifiedShowCount += 20;
    renderUnverifiedList();
}

function goVerifyAsset(kodeBarang, nup) {
    document.getElementById('inputKodeBarang').value = kodeBarang;
    document.getElementById('inputNUP').value = nup;
    searchAsset();
}

// ===== RECENT LIST =====
function renderRecentList() {
    const container = document.getElementById('recentList');
    const verifs = verifications[currentSatker] || [];

    if (verifs.length === 0) {
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas fa-inbox"></i>
                <p>Belum ada verifikasi</p>
            </div>
        `;
        return;
    }

    const recent = verifs.slice(0, 5);
    container.innerHTML = recent.map(v => {
        let iconClass = 'good';
        let icon = 'fa-check-circle';
        if (v.kondisiAktual === 'Rusak Ringan') { iconClass = 'warning'; icon = 'fa-exclamation-circle'; }
        if (v.kondisiAktual === 'Rusak Berat') { iconClass = 'danger'; icon = 'fa-times-circle'; }

        const time = new Date(v.tanggalVerifikasi);
        const timeStr = time.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
                       time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="recent-item">
                <div class="ri-icon ${iconClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="ri-info">
                    <div class="ri-name">${escapeHtml(v.namaBarang || 'Tanpa Nama')}</div>
                    <div class="ri-detail">NUP: ${escapeHtml(v.nup)} | ${escapeHtml(v.lokasi || '-')}</div>
                </div>
                <span class="ri-time">${timeStr}</span>
            </div>
        `;
    }).join('');
}

// ===== LOCATION AUTOCOMPLETE =====
function updateLocationAutocomplete() {
    const datalist = document.getElementById('lokasiHistory');
    if (!datalist) return;
    const allLocations = (verifications[currentSatker] || [])
        .map(v => v.lokasi)
        .filter(l => l && l.trim())
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();

    datalist.innerHTML = allLocations.map(l => `<option value="${escapeHtml(l)}">`).join('');
}

// ===== STATS =====
function updateStats() {
    const total = currentAssets.length;
    const verified = verifications[currentSatker]?.length || 0;
    const unverified = total - verified;

    const statTotal = document.getElementById('statTotal');
    const statVerified = document.getElementById('statVerified');
    const statUnverified = document.getElementById('statUnverified');
    if (statTotal) statTotal.textContent = total;
    if (statVerified) statVerified.textContent = verified;
    if (statUnverified) statUnverified.textContent = unverified > 0 ? unverified : 0;

    const dashTotal = document.getElementById('dashTotal');
    const dashVerified = document.getElementById('dashVerified');
    const dashUnverified = document.getElementById('dashUnverified');
    const dashProblem = document.getElementById('dashProblem');

    if (dashTotal) dashTotal.textContent = total;
    if (dashVerified) dashVerified.textContent = verified;
    if (dashUnverified) dashUnverified.textContent = unverified > 0 ? unverified : 0;

    const problemCount = verifications[currentSatker]?.filter(v =>
        v.kondisiAktual === 'Rusak Ringan' || v.kondisiAktual === 'Rusak Berat'
    ).length || 0;
    if (dashProblem) dashProblem.textContent = problemCount;

    const progressPercent = total > 0 ? Math.round((verified / total) * 100) : 0;
    const progressFill = document.getElementById('progressFill');
    const progressPercentText = document.getElementById('progressPercent');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressPercentText) progressPercentText.textContent = `${progressPercent}%`;

    renderKondisiStats();
}

function renderKondisiStats() {
    const container = document.getElementById('kondisiStats');
    if (!container) return;

    const verifs = verifications[currentSatker] || [];
    const baik = verifs.filter(v => v.kondisiAktual === 'Baik').length;
    const rusakRingan = verifs.filter(v => v.kondisiAktual === 'Rusak Ringan').length;
    const rusakBerat = verifs.filter(v => v.kondisiAktual === 'Rusak Berat').length;
    const belum = currentAssets.length - verifs.length;

    container.innerHTML = `
        <div class="kondisi-item">
            <span class="ki-label"><span class="ki-dot baik"></span> Baik</span>
            <span class="ki-count">${baik}</span>
        </div>
        <div class="kondisi-item">
            <span class="ki-label"><span class="ki-dot rusak-ringan"></span> Rusak Ringan</span>
            <span class="ki-count">${rusakRingan}</span>
        </div>
        <div class="kondisi-item">
            <span class="ki-label"><span class="ki-dot rusak-berat"></span> Rusak Berat</span>
            <span class="ki-count">${rusakBerat}</span>
        </div>
        <div class="kondisi-item">
            <span class="ki-label"><span class="ki-dot belum"></span> Belum Diverifikasi</span>
            <span class="ki-count">${belum > 0 ? belum : 0}</span>
        </div>
    `;
}
