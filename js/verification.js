// ===== EDIT / DELETE VERIFICATION =====
function editVerification() {
    if (!currentAsset) return;
    showToast('Edit mode - ubah data lalu klik Simpan Verifikasi', 'info');
    const form = document.getElementById('verifyForm');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
}

function deleteVerification() {
    if (!currentAsset) return;

    document.getElementById('modalTitle').textContent = 'Hapus Verifikasi?';
    document.getElementById('modalMessage').textContent = `Verifikasi untuk "${currentAsset.namaBarang || currentAsset.kodeBarang}" akan dihapus.`;
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
        renderAssetDetail(currentAsset);
    };
    document.getElementById('confirmModal').classList.add('show');
}

// ===== SAVE VERIFICATION =====
function saveVerification() {
    try {
        if (!currentAsset) {
            showToast('Error: data aset tidak ditemukan. Coba cari ulang.', 'error');
            return;
        }

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

        verifications[currentSatker] = (verifications[currentSatker] || []).filter(v =>
            !(v.kodeBarang === currentAsset.kodeBarang && v.nup === currentAsset.nup)
        );

        verifications[currentSatker].unshift(verification);

        saveData();
        updateStats();
        renderRecentList();

        showSuccessModal('Verifikasi berhasil disimpan!');
        sendSyncNotification(currentAsset.namaBarang || currentAsset.kodeBarang);
    } catch (err) {
        console.error('saveVerification error:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// ===== HISTORY PAGE =====
function filterHistory() {
    const search = document.getElementById('historySearch').value.toLowerCase().trim();
    const kondisi = document.getElementById('filterKondisi').value;
    const sort = document.getElementById('filterSort').value;

    let verifs = verifications[currentSatker] || [];

    if (kondisi) {
        verifs = verifs.filter(v => v.kondisiAktual === kondisi);
    }

    if (search) {
        verifs = verifs.filter(v => {
            const haystack = [
                v.namaBarang, v.nup, v.kodeBarang, v.lokasi,
                v.merk, v.tipe, v.catatan, v.kondisiAktual
            ].join(' ').toLowerCase();
            return haystack.includes(search);
        });
    }

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
    const asset = currentAssets.find(a =>
        a.kodeBarang === kodeBarang && a.nup === nup
    );
    if (asset) {
        currentAsset = asset;
        pendingDetailAsset = asset;
        showPage('detail');
    } else {
        showToast('Aset tidak ditemukan di data', 'error');
    }
}
