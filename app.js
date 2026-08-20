// ===== APP STATE =====
let currentSatker = null;
let currentAssets = []; // Assets for current satker
let allAssets = {}; // All assets grouped by satker
let verifications = {}; // Verifications grouped by satker
let currentAsset = null;
let currentPhoto = null;

const SATKER_MAP = {
    sekretariat: 'Sekretariat Jendral',
    pendidikan: 'Pendidikan Islam',
    bimas: 'Bimbingan Masyarakat Islam'
};

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupDragDrop();
    setupFormListeners();
    loadDarkMode();
});

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

function saveData() {
    localStorage.setItem('allAssets', JSON.stringify(allAssets));
    localStorage.setItem('verifications', JSON.stringify(verifications));
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
}

function goBack() {
    showPage('satker');
}

// ===== NAVIGATION =====
function showPage(page) {
    // Hide all screens
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
        // Hide all pages
        document.querySelectorAll('.pages-container .page').forEach(p => p.classList.remove('active'));
        // Show target page
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) targetPage.classList.add('active');

        // Update bottom nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (navItem) navItem.classList.add('active');

        // Load data for specific pages
        if (page === 'history') filterHistory();
        if (page === 'home') renderUnverifiedList();
    }
}

// ===== SEARCH ASSET =====
function searchAsset() {
    const kodeBarang = document.getElementById('inputKodeBarang').value.trim();
    const nup = document.getElementById('inputNUP').value.trim();

    if (!kodeBarang || !nup) {
        showToast('Masukkan Kode Barang dan NUP!', 'error');
        return;
    }

    // Find asset
    const asset = currentAssets.find(a =>
        a.kodeBarang === kodeBarang && a.nup === nup
    );

    if (!asset) {
        showToast('Aset tidak ditemukan! Import data SIMAN dulu.', 'error');
        return;
    }

    currentAsset = asset;
    renderAssetDetail(asset);
    showPage('detail');
}

function renderAssetDetail(asset) {
    const container = document.getElementById('assetDetail');
    const statusClass = asset.statusBMN === 'Aktif' ? 'aktif' : 'tidak-aktif';

    // Find existing verification
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

    // Pre-fill form if verification exists
    if (existingVerification) {
        document.getElementById('inputLokasi').value = existingVerification.lokasi || '';
        const kondisiRadio = document.querySelector(`input[name="kondisi"][value="${existingVerification.kondisiAktual}"]`);
        if (kondisiRadio) kondisiRadio.checked = true;
        document.getElementById('inputCatatan').value = existingVerification.catatan || '';
        if (existingVerification.foto) {
            showPhotoPreview(existingVerification.foto);
        }
    } else {
        // Reset form
        document.getElementById('inputLokasi').value = '';
        document.querySelectorAll('input[name="kondisi"]').forEach(r => r.checked = false);
        document.getElementById('inputCatatan').value = '';
        resetPhoto();
    }

    // Update location autocomplete
    updateLocationAutocomplete();
}

// ===== EDIT / DELETE VERIFICATION =====
function editVerification() {
    if (!currentAsset) return;
    showToast('Edit mode - ubah data lalu klik Simpan Verifikasi', 'info');
    // Scroll to form
    const form = document.getElementById('verifyForm');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
}

function deleteVerification() {
    if (!currentAsset) return;

    document.getElementById('modalTitle').textContent = 'Hapus Verifikasi?';
    document.getElementById('modalMessage').textContent = `Verifikasi untuk \"${currentAsset.namaBarang || currentAsset.kodeBarang}\" akan dihapus.`;
    document.getElementById('modalConfirm').onclick = () => {
        verifications[currentSatker] = (verifications[currentSatker] || []).filter(v =>
            !(v.kodeBarang === currentAsset.kodeBarang && v.nup === currentAsset.nup)
        );
        saveData();
        updateStats();
        renderRecentList();
        renderUnverifiedList();
        closeModal();
        showToast('Verifikasi berhasil dihapus!', 'info');
        // Re-render detail to remove verification banner
        renderAssetDetail(currentAsset);
    };
    document.getElementById('confirmModal').classList.add('show');
}

// ===== SAVE VERIFICATION =====
function saveVerification() {
    if (!currentAsset) return;

    const lokasi = document.getElementById('inputLokasi').value.trim();
    const kondisi = document.querySelector('input[name="kondisi"]:checked')?.value;
    const catatan = document.getElementById('inputCatatan').value.trim();

    if (!lokasi) {
        showToast('Masukkan lokasi ruangan!', 'error');
        return;
    }

    if (!kondisi) {
        showToast('Pilih kondisi aset!', 'error');
        return;
    }

    const verification = {
        id: Date.now(),
        kodeBarang: currentAsset.kodeBarang,
        nup: currentAsset.nup,
        namaBarang: currentAsset.namaBarang,
        merk: currentAsset.merk,
        tipe: currentAsset.tipe,
        kondisiSiman: currentAsset.kondisi,
        kondisiAktual: kondisi,
        lokasi: lokasi,
        foto: currentPhoto,
        catatan: catatan,
        tanggalVerifikasi: new Date().toISOString(),
        satker: currentSatker
    };

    // Remove existing verification for this asset
    verifications[currentSatker] = (verifications[currentSatker] || []).filter(v =>
        !(v.kodeBarang === currentAsset.kodeBarang && v.nup === currentAsset.nup)
    );

    // Add new verification
    verifications[currentSatker].unshift(verification);

    saveData();
    updateStats();
    renderRecentList();

    showSuccessModal('Verifikasi berhasil disimpan!');
}

// ===== UPDATE STATS =====
function updateStats() {
    const total = currentAssets.length;
    const verified = verifications[currentSatker]?.length || 0;
    const unverified = total - verified;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statVerified').textContent = verified;
    document.getElementById('statUnverified').textContent = unverified > 0 ? unverified : 0;

    // Dashboard stats
    const dashTotal = document.getElementById('dashTotal');
    const dashVerified = document.getElementById('dashVerified');
    const dashUnverified = document.getElementById('dashUnverified');
    const dashProblem = document.getElementById('dashProblem');

    if (dashTotal) dashTotal.textContent = total;
    if (dashVerified) dashVerified.textContent = verified;
    if (dashUnverified) dashUnverified.textContent = unverified > 0 ? unverified : 0;

    // Count problem assets (rusak)
    const problemCount = verifications[currentSatker]?.filter(v =>
        v.kondisiAktual === 'Rusak Ringan' || v.kondisiAktual === 'Rusak Berat'
    ).length || 0;
    if (dashProblem) dashProblem.textContent = problemCount;

    // Progress bar
    const progressPercent = total > 0 ? Math.round((verified / total) * 100) : 0;
    const progressFill = document.getElementById('progressFill');
    const progressPercentText = document.getElementById('progressPercent');
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressPercentText) progressPercentText.textContent = `${progressPercent}%`;

    // Kondisi stats
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

// ===== RENDER RECENT LIST =====
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

    // Show last 5
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
    const allLocations = (verifications[currentSatker] || [])
        .map(v => v.lokasi)
        .filter(l => l && l.trim())
        .filter((v, i, a) => a.indexOf(v) === i) // unique
        .sort();

    datalist.innerHTML = allLocations.map(l => `<option value="${escapeHtml(l)}">`).join('');
}

// ===== PHOTO HANDLING =====
function triggerCamera() {
    document.getElementById('inputFoto').click();
}

function handlePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        currentPhoto = e.target.result;
        showPhotoPreview(currentPhoto);
    };
    reader.readAsDataURL(file);
}

function showPhotoPreview(src) {
    const preview = document.getElementById('photoPreview');
    const actions = document.getElementById('photoActions');
    preview.innerHTML = `<img src="${src}" alt="Foto Aset">`;
    preview.onclick = null;
    actions.classList.remove('hidden');
}

function removePhoto() {
    currentPhoto = null;
    resetPhoto();
}

function resetPhoto() {
    const preview = document.getElementById('photoPreview');
    const actions = document.getElementById('photoActions');
    preview.innerHTML = `
        <i class="fas fa-camera"></i>
        <span>Ketik untuk ambil foto</span>
    `;
    preview.onclick = triggerCamera;
    actions.classList.add('hidden');
    document.getElementById('inputFoto').value = '';
}

// ===== EXCEL IMPORT =====
function setupDragDrop() {
    const dropzone = document.getElementById('dropzone');
    if (!dropzone) return;

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.background = 'var(--primary-light)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '';
        dropzone.style.background = '';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '';
        dropzone.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) processExcelFile(file);
    });
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (file) processExcelFile(file);
}

function processExcelFile(file) {
    if (!file.name.match(/\.xlsx?$/i)) {
        showToast('File harus berformat .xlsx atau .xls!', 'error');
        return;
    }

    // Check if XLSX library is loaded
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel belum ke-load! Refresh halaman.', 'error');
        return;
    }

    showImportProgress(true, 'Membaca file Excel...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            console.log('File size:', data.length, 'bytes');

            if (data.length < 100) {
                showImportProgress(false);
                showToast('File terlalu kecil atau corrupt!', 'error');
                return;
            }

            const workbook = XLSX.read(data, { type: 'array' });
            console.log('Sheets:', workbook.SheetNames);

            // Scan ALL sheets to find the one with asset data
            let finalData = [];
            let usedSheet = '';

            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const range = sheet['!ref'] || '';
                console.log(`Sheet '${sheetName}' range: ${range}`);

                // Read as raw array
                let rawRows = [];
                try {
                    rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                } catch(e) {}

                // Read as JSON
                let jsonRows = [];
                try {
                    jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                } catch(e) {}

                console.log(`  Sheet '${sheetName}': raw=${rawRows.length}, json=${jsonRows.length}`);

                // Try JSON first
                if (jsonRows.length > 0) {
                    finalData = jsonRows;
                    usedSheet = sheetName;
                    console.log(`  Using JSON from '${sheetName}'. Cols:`, Object.keys(jsonRows[0] || {}));
                    break;
                }

                // Try raw - scan for header
                if (rawRows.length > 1) {
                    const allKeywords = ['kode barang', 'kode_barang', 'nup', 'nama barang', 'nama', 'merk', 'kondisi', 'nilai', 'status', 'jenis', 'keterangan'];
                    let headerIdx = -1;
                    for (let r = 0; r < Math.min(30, rawRows.length); r++) {
                        const joined = rawRows[r].map(c => String(c||'').toLowerCase().trim()).join('||');
                        const matchCount = allKeywords.filter(kw => joined.includes(kw)).length;
                        if (matchCount >= 2) { headerIdx = r; break; }
                    }
                    if (headerIdx >= 0) {
                        const hdrs = rawRows[headerIdx].map(h => String(h||'').trim());
                        for (let r = headerIdx + 1; r < rawRows.length; r++) {
                            const row = rawRows[r];
                            if (!row.some(c => c !== '' && c != null)) continue;
                            const obj = {};
                            hdrs.forEach((h, ci) => { if (h) obj[h] = row[ci] || ''; });
                            finalData.push(obj);
                        }
                        if (finalData.length > 0) {
                            usedSheet = sheetName;
                            console.log(`  Using raw from '${sheetName}'. Header row ${headerIdx}, data: ${finalData.length}`);
                            break;
                        }
                    }
                }
            }

            if (finalData.length === 0) {
                showImportProgress(false);
                const sheetInfo = workbook.SheetNames.join(', ');
                showToast(`Gagal! 0 data di semua sheet (${sheetInfo}). Buka file di Excel dulu, pastikan ada data.`, 'error');
                return;
            }

            console.log(`Final: ${finalData.length} rows from sheet '${usedSheet}'`);

            showImportProgress(true, `Memproses ${finalData.length} data...`);

            // Map columns - much more flexible matching
            let imported = 0;
            const newAssets = [];

            finalData.forEach((row, i) => {
                // Very flexible column matching for SIMAN exports
                const kodeBarang = findColumnValue(row, [
                    'Kode Barang', 'kode_barang', 'kodeBarang', 'KodeBarang', 'KODE BARANG',
                    'Kode Barang BMN', 'KD.BRG', 'Kd Brg', 'KD BRG', 'KodeBRG', 'kodebrg',
                    'Kode Barang BMN', 'Kode_Brg', 'kode_brg'
                ]);
                const nup = findColumnValue(row, [
                    'NUP', 'nup', 'Nup', 'N.U.P', 'No. Urut', 'Nomor Urut', 'NOMOR URUT',
                    'No Urut', 'no_urut'
                ]);
                const namaBarang = findColumnValue(row, [
                    'Nama Barang', 'nama_barang', 'namaBarang', 'NamaBarang', 'NAMA BARANG',
                    'Nama', 'nama', 'NAMA', 'Nama_Brg', 'nama_brg'
                ]);
                const merk = findColumnValue(row, [
                    'Merk', 'merk', 'MERK', 'Merk/Type', 'Merk/Type/Merek', 'Merek',
                    'merek', 'MEREK', 'Brand', 'brand'
                ]);
                const tipe = findColumnValue(row, [
                    'Tipe', 'tipe', 'TIPE', 'Spesifikasi', 'spek', 'SPEK',
                    'Type', 'type', 'TYPE', 'Type/Spesifikasi', 'Spesifikasi/Type',
                    'Tipe/Spesifikasi', 'Tipe_Spesifikasi', 'tipe_spesifikasi',
                    'Merk/Type'
                ]);
                const kondisi = findColumnValue(row, [
                    'Kondisi', 'kondisi', 'KONDISI', 'Kondisi Barang', 'Kondisi_Barang',
                    'Kondisi BMN', 'Kondisi_Aset', ' kondisi'
                ]);
                const nilaiBuku = findColumnValue(row, [
                    'Nilai Buku', 'nilai_buku', 'nilaiBuku', 'NilaiBuku', 'NILAI BUKU',
                    'Nilai Perolehan', 'nilai_perolehan', 'NilaiPerolehan', 'NILAI PEROLEHAN',
                    'Nilai Akhir', 'nilai_akhir', 'Harga Perolehan', 'harga_perolehan',
                    'Nilai', 'nilai', 'NILAI'
                ]);
                const statusBMN = findColumnValue(row, [
                    'Status BMN', 'status_bmn', 'statusBMN', 'StatusBMN', 'STATUS BMN',
                    'Status', 'status', 'STATUS', 'Status Barang', 'Status_Barang',
                    'Status Aset'
                ]);
                const jenisBMN = findColumnValue(row, [
                    'Jenis BMN', 'jenis_bmn', 'jenisBMN', 'JenisBMN', 'JENIS BMN',
                    'Jenis', 'jenis', 'JENIS', 'Jenis Barang', 'Jenis_Barang',
                    'Jenis BMN/Barang', 'Jenis_Aset'
                ]);
                const umurAset = findColumnValue(row, [
                    'Umur Aset', 'umur_asset', 'umurAset', 'UmurAset', 'UMUR ASET',
                    'Umur', 'umur', 'UMUR', 'Umur Barang'
                ]);

                if (!kodeBarang || !nup) return; // Skip rows without key data

                newAssets.push({
                    id: Date.now() + i,
                    kodeBarang: String(kodeBarang).trim(),
                    nup: String(nup).trim(),
                    namaBarang: String(namaBarang || '-').trim(),
                    merk: String(merk || '').trim(),
                    tipe: String(tipe || '').trim(),
                    kondisi: String(kondisi || '-').trim(),
                    nilaiBuku: parseNumber(nilaiBuku),
                    statusBMN: String(statusBMN || 'Aktif').trim(),
                    jenisBMN: String(jenisBMN || '-').trim(),
                    umurAset: String(umurAset || '-').trim()
                });
                imported++;
            });

            // Add to current satker
            allAssets[currentSatker] = [...allAssets[currentSatker], ...newAssets];
            currentAssets = allAssets[currentSatker];
            saveData();
            updateStats();
            renderRecentList();

            showImportProgress(false);

            if (imported === 0) {
                const keys = Object.keys(finalData[0] || {});
                showToast(`0 aset! Kolom: ${keys.slice(0,6).join(', ')}`, 'error');
            } else {
                showToast(`${imported} aset berhasil diimport!`, 'success');
            }

            // Clear input
            document.getElementById('fileInput').value = '';        } catch (err) {
            showImportProgress(false);
            console.error('Import error:', err);
            showToast(`Gagal: ${err.message}`, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function findColumnValue(row, possibleNames) {
    const keys = Object.keys(row);
    
    // Pass 1: Exact match
    for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== '' && row[name] !== null) {
            return row[name];
        }
    }
    // Pass 2: Case-insensitive exact match
    for (const name of possibleNames) {
        const found = keys.find(k => k.toLowerCase() === name.toLowerCase());
        if (found && row[found] !== '' && row[found] !== null) {
            return row[found];
        }
    }
    // Pass 3: Contains/substring match (e.g. 'Kode Barang BMN' contains 'Kode Barang')
    for (const name of possibleNames) {
        const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = keys.find(k => {
            const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanKey === cleanName || cleanKey.includes(cleanName) || cleanName.includes(cleanKey);
        });
        if (found && row[found] !== '' && row[found] !== null) {
            return row[found];
        }
    }
    return null;
}

function parseNumber(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseInt(String(val).replace(/[^\d]/g, '')) || 0;
}

function showImportProgress(show, message) {
    const el = document.getElementById('importProgress');
    const status = document.getElementById('importStatus');
    const fill = document.getElementById('importProgressFill');

    if (show) {
        el.classList.remove('hidden');
        status.textContent = message || 'Memproses...';
        fill.style.width = '70%';
    } else {
        fill.style.width = '100%';
        setTimeout(() => {
            el.classList.add('hidden');
            fill.style.width = '0%';
        }, 500);
    }
}

// ===== EXPORT EXCEL =====
function exportExcel() {
    const verifs = verifications[currentSatker] || [];

    if (currentAssets.length === 0 && verifs.length === 0) {
        showToast('Tidak ada data untuk diexport!', 'error');
        return;
    }

    // Merge data
    const exportData = currentAssets.map(asset => {
        const verification = verifs.find(v => v.kodeBarang === asset.kodeBarang && v.nup === asset.nup);
        return {
            'Kode Barang': asset.kodeBarang || '',
            'NUP': asset.nup || '',
            'Nama Barang': asset.namaBarang || '',
            'Merk': asset.merk || '',
            'Tipe': asset.tipe || '',
            'Jenis BMN': asset.jenisBMN || '',
            'Kondisi (SIMAN)': asset.kondisi || '',
            'Status BMN': asset.statusBMN || '',
            'Nilai Buku': asset.nilaiBuku || 0,
            'Umur Aset': asset.umurAset || '',
            'Status Verifikasi': verification ? 'Sudah' : 'Belum',
            'Lokasi Aktual': verification?.lokasi || '',
            'Kondisi Aktual': verification?.kondisiAktual || '',
            'Catatan': verification?.catatan || '',
            'Tanggal Verifikasi': verification?.tanggalVerifikasi ?
                new Date(verification.tanggalVerifikasi).toLocaleDateString('id-ID') : ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Verifikasi Aset');

    const satkerName = SATKER_MAP[currentSatker].replace(/\s+/g, '_');
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Verifikasi_Aset_${satkerName}_${date}.xlsx`);

    showToast('Excel berhasil diexport!', 'success');
}

// ===== ADMIN =====
function confirmClearData() {
    document.getElementById('modalTitle').textContent = 'Hapus Semua Data?';
    document.getElementById('modalMessage').textContent = 'Semua data aset dan verifikasi untuk satker ini akan dihapus. Tindakan ini tidak dapat dibatalkan.';
    document.getElementById('modalConfirm').onclick = () => {
        allAssets[currentSatker] = [];
        verifications[currentSatker] = [];
        currentAssets = [];
        saveData();
        updateStats();
        renderRecentList();
        closeModal();
        showToast('Semua data berhasil dihapus!', 'info');
    };
    document.getElementById('confirmModal').classList.add('show');
}

function exportFullBackup() {
    const backup = {
        allAssets,
        verifications,
        exportDate: new Date().toISOString()
    };
    const data = JSON.stringify(backup, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_aset_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Backup berhasil diunduh!', 'success');
}

function restoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (backup.allAssets && backup.verifications) {
                allAssets = backup.allAssets;
                verifications = backup.verifications;
                saveData();
                showToast('Backup berhasil direstore!', 'success');
            } else {
                showToast('Format file tidak valid!', 'error');
            }
        } catch (err) {
            showToast('Gagal membaca file!', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
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

// ===== HISTORY PAGE =====
function filterHistory() {
    const search = document.getElementById('historySearch').value.toLowerCase().trim();
    const kondisi = document.getElementById('filterKondisi').value;
    const sort = document.getElementById('filterSort').value;

    let verifs = verifications[currentSatker] || [];

    // Filter by kondisi
    if (kondisi) {
        verifs = verifs.filter(v => v.kondisiAktual === kondisi);
    }

    // Filter by search
    if (search) {
        verifs = verifs.filter(v => {
            const haystack = [
                v.namaBarang, v.nup, v.kodeBarang, v.lokasi,
                v.merk, v.tipe, v.catatan, v.kondisiAktual
            ].join(' ').toLowerCase();
            return haystack.includes(search);
        });
    }

    // Sort
    if (sort === 'newest') {
        verifs.sort((a, b) => new Date(b.tanggalVerifikasi) - new Date(a.tanggalVerifikasi));
    } else if (sort === 'oldest') {
        verifs.sort((a, b) => new Date(a.tanggalVerifikasi) - new Date(b.tanggalVerifikasi));
    } else if (sort === 'name') {
        verifs.sort((a, b) => (a.namaBarang || '').localeCompare(b.namaBarang || ''));
    }

    renderHistorySummary(verifs);
    renderHistoryList(verifs);
}

function renderHistorySummary(verifs) {
    const container = document.getElementById('historySummary');
    if (!container) return;

    const total = (verifications[currentSatker] || []).length;
    const baik = verifs.filter(v => v.kondisiAktual === 'Baik').length;
    const rusak = verifs.filter(v => v.kondisiAktual === 'Rusak Ringan' || v.kondisiAktual === 'Rusak Berat').length;

    container.innerHTML = `
        <span class="history-badge all">${verifs.length} / ${total} data</span>
        ${baik > 0 ? `<span class="history-badge baik"><i class="fas fa-check-circle"></i> ${baik} Baik</span>` : ''}
        ${rusak > 0 ? `<span class="history-badge rusak"><i class="fas fa-exclamation-circle"></i> ${rusak} Rusak</span>` : ''}
    `;
}

function renderHistoryList(verifs) {
    const container = document.getElementById('historyList');
    if (!container) return;

    if (verifs.length === 0) {
        container.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-inbox"></i>
                <p>Tidak ada data verifikasi</p>
            </div>
        `;
        return;
    }

    container.innerHTML = verifs.map(v => {
        let iconClass = 'baik';
        let icon = 'fa-check-circle';
        let kondisiClass = 'baik';
        if (v.kondisiAktual === 'Rusak Ringan') { iconClass = 'rusak-ringan'; icon = 'fa-exclamation-circle'; kondisiClass = 'rusak-ringan'; }
        if (v.kondisiAktual === 'Rusak Berat') { iconClass = 'rusak-berat'; icon = 'fa-times-circle'; kondisiClass = 'rusak-berat'; }

        const time = new Date(v.tanggalVerifikasi);
        const dateStr = time.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="history-item" onclick="viewHistoryDetail('${escapeHtml(v.kodeBarang)}', '${escapeHtml(v.nup)}')">
                <div class="hi-icon ${iconClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="hi-info">
                    <div class="hi-name">${escapeHtml(v.namaBarang || 'Tanpa Nama')}</div>
                    <div class="hi-detail">${escapeHtml(v.merk || '')} ${escapeHtml(v.tipe || '')} | NUP: ${escapeHtml(v.nup)}</div>
                    <div class="hi-detail"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(v.lokasi || '-')}</div>
                </div>
                <div class="hi-right">
                    <span class="hi-kondisi ${kondisiClass}">${escapeHtml(v.kondisiAktual)}</span>
                    <div class="hi-date">${dateStr}<br>${timeStr}</div>
                </div>
            </div>
        `;
    }).join('');
}

function viewHistoryDetail(kodeBarang, nup) {
    // Find the asset and show detail page
    const asset = currentAssets.find(a =>
        a.kodeBarang === kodeBarang && a.nup === nup
    );
    if (asset) {
        currentAsset = asset;
        renderAssetDetail(asset);
        showPage('detail');
    } else {
        showToast('Aset tidak ditemukan di data', 'error');
    }
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
    // Enter key on search inputs
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

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {
            // SW not available
        });
    });
}
