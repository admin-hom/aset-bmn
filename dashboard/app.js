// ===== DASHBOARD VIEWER =====
// Read-only dashboard that loads data from Firestore

let firebaseDb = null;
let currentSatker = 'sekretariat';
let allAssets = {};
let verifications = {};

const SATKER_MAP = {
    sekretariat: 'Sekretariat Jendral',
    pendidikan: 'Pendidikan Islam',
    bimas: 'Bimbingan Masyarakat Islam'
};

const CHUNK_SIZE = 2000;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
});

function initFirebase() {
    try {
        firebaseDb = firebase.initializeApp(FIREBASE_CONFIG).firestore();
        console.log('Firestore connected');
        selectSatker('sekretariat');
    } catch (err) {
        console.error('Firebase init error:', err);
        document.getElementById('loading').innerHTML =
            '<p style="color:red;">Gagal koneksi Firestore</p>';
    }
}

// ===== SATKER SELECTION =====
function selectSatker(satker) {
    currentSatker = satker;

    // Update tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-satker="${satker}"]`).classList.add('active');

    // Show loading
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');

    loadData();
}

// ===== LOAD DATA FROM FIRESTORE =====
async function loadData() {
    try {
        // Load assets
        const metaDoc = await firebaseDb.collection('assets').doc(currentSatker + '_meta').get();
        const chunkCount = metaDoc.exists ? (metaDoc.data().chunkCount || 0) : 0;

        let assets = [];
        if (chunkCount > 0) {
            const chunkPromises = [];
            for (let i = 0; i < chunkCount; i++) {
                chunkPromises.push(
                    firebaseDb.collection('assets').doc(`${currentSatker}_${i}`).get()
                        .then(doc => doc.exists ? doc.data().items : [])
                        .catch(() => [])
                );
            }
            const chunks = await Promise.all(chunkPromises);
            assets = chunks.flat();
        }

        // Load verifications
        let verifs = [];
        const verifDoc = await firebaseDb.collection('verifications').doc(currentSatker).get();
        if (verifDoc.exists) {
            verifs = verifDoc.data().items || [];
        }

        allAssets[currentSatker] = assets;
        verifications[currentSatker] = verifs;

        renderDashboard();
    } catch (err) {
        console.error('Load error:', err);
        document.getElementById('loading').innerHTML =
            '<p style="color:red;">Gagal memuat data: ' + err.message + '</p>';
    }
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');

    const assets = allAssets[currentSatker] || [];
    const verifs = verifications[currentSatker] || [];
    const total = assets.length;
    const verified = verifs.length;
    const unverified = total - verified;

    const problemCount = verifs.filter(v =>
        v.kondisiAktual === 'Rusak Ringan' || v.kondisiAktual === 'Rusak Berat'
    ).length;

    // Stats
    document.getElementById('totalAssets').textContent = total;
    document.getElementById('verifiedAssets').textContent = verified;
    document.getElementById('unverifiedAssets').textContent = unverified > 0 ? unverified : 0;
    document.getElementById('problemAssets').textContent = problemCount;

    // Progress
    const percent = total > 0 ? Math.round((verified / total) * 100) : 0;
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = percent + '% (' + verified + '/' + total + ')';

    // Kondisi
    const baik = verifs.filter(v => v.kondisiAktual === 'Baik').length;
    const rusakRingan = verifs.filter(v => v.kondisiAktual === 'Rusak Ringan').length;
    const rusakBerat = verifs.filter(v => v.kondisiAktual === 'Rusak Berat').length;

    document.getElementById('kondisiStats').innerHTML = `
        <div class="kondisi-item">
            <span class="ki-dot baik"></span>
            <span class="ki-label">Baik</span>
            <span class="ki-count">${baik}</span>
        </div>
        <div class="kondisi-item">
            <span class="ki-dot rusak-ringan"></span>
            <span class="ki-label">Rusak Ringan</span>
            <span class="ki-count">${rusakRingan}</span>
        </div>
        <div class="kondisi-item">
            <span class="ki-dot rusak-berat"></span>
            <span class="ki-label">Rusak Berat</span>
            <span class="ki-count">${rusakBerat}</span>
        </div>
        <div class="kondisi-item">
            <span class="ki-dot belum"></span>
            <span class="ki-label">Belum Diverifikasi</span>
            <span class="ki-count">${unverified > 0 ? unverified : 0}</span>
        </div>
    `;

    // Unverified list
    const verifiedSet = new Set(verifs.map(v => v.kodeBarang + '|' + v.nup));
    const unverifiedAssets = assets.filter(a => !verifiedSet.has(a.kodeBarang + '|' + a.nup)).slice(0, 20);

    if (unverifiedAssets.length === 0) {
        document.getElementById('unverifiedList').innerHTML =
            '<div class="empty"><i class="fas fa-check-circle"></i> Semua aset sudah terverifikasi!</div>';
    } else {
        document.getElementById('unverifiedList').innerHTML = unverifiedAssets.map(a => `
            <div class="asset-item">
                <div class="ai-icon"><i class="fas fa-box-open"></i></div>
                <div class="ai-info">
                    <div class="ai-name">${esc(a.namaBarang || 'Tanpa Nama')}</div>
                    <div class="ai-detail">${esc(a.merk || '')} ${esc(a.tipe || '')} | KB: ${esc(a.kodeBarang)} | NUP: ${esc(a.nup)}</div>
                </div>
            </div>
        `).join('');
    }

    // Recent verifications
    const recent = verifs.slice(0, 10);
    if (recent.length === 0) {
        document.getElementById('recentList').innerHTML =
            '<div class="empty"><i class="fas fa-inbox"></i> Belum ada verifikasi</div>';
    } else {
        document.getElementById('recentList').innerHTML = recent.map(v => {
            let iconClass = 'baik';
            let icon = 'fa-check-circle';
            if (v.kondisiAktual === 'Rusak Ringan') { iconClass = 'rusak-ringan'; icon = 'fa-exclamation-circle'; }
            if (v.kondisiAktual === 'Rusak Berat') { iconClass = 'rusak-berat'; icon = 'fa-times-circle'; }
            const time = new Date(v.tanggalVerifikasi);
            const dateStr = time.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            return `
                <div class="asset-item">
                    <div class="ai-icon ${iconClass}"><i class="fas ${icon}"></i></div>
                    <div class="ai-info">
                        <div class="ai-name">${esc(v.namaBarang || 'Tanpa Nama')}</div>
                        <div class="ai-detail">${esc(v.lokasi || '-')} | ${v.kondisiAktual || '-'}</div>
                    </div>
                    <span class="ai-date">${dateStr}</span>
                </div>
            `;
        }).join('');
    }

    // Update sync status
    document.getElementById('syncStatus').innerHTML =
        '<i class="fas fa-cloud" style="color:#22c55e"></i> Synced';
}

// ===== HELPERS =====
function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== EXPORT EXCEL =====
function exportExcel() {
    const assets = allAssets[currentSatker] || [];
    const verifs = verifications[currentSatker] || [];
    if (assets.length === 0 && verifs.length === 0) {
        alert('Tidak ada data untuk diexport!');
        return;
    }

    const data = assets.map(asset => {
        const v = verifs.find(v => v.kodeBarang === asset.kodeBarang && v.nup === asset.nup);
        return {
            'Kode Barang': asset.kodeBarang || '',
            'NUP': asset.nup || '',
            'Nama Barang': asset.namaBarang || '',
            'Merk': asset.merk || '',
            'Tipe': asset.tipe || '',
            'Kondisi SIMAN': asset.kondisi || '',
            'Status Verifikasi': v ? 'Sudah' : 'Belum',
            'Lokasi': v?.lokasi || '',
            'Kondisi Aktual': v?.kondisiAktual || '',
            'Tanggal': v?.tanggalVerifikasi ? new Date(v.tanggalVerifikasi).toLocaleDateString('id-ID') : ''
        };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dashboard');
    const satkerName = SATKER_MAP[currentSatker].replace(/\s+/g, '_');
    XLSX.writeFile(wb, `Dashboard_${satkerName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ===== EXPORT PDF =====
function exportPDF() {
    const assets = allAssets[currentSatker] || [];
    const verifs = verifications[currentSatker] || [];
    if (assets.length === 0 && verifs.length === 0) {
        alert('Tidak ada data untuk diexport!');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const satkerName = SATKER_MAP[currentSatker];
        let y = 15;

        // Header
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text('Dashboard Aset BMN - ' + satkerName, 105, 18, { align: 'center' });

        y = 40;

        // Summary
        const total = assets.length;
        const verified = verifs.length;
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.text(`Total: ${total} | Verified: ${verified} | Unverified: ${total - verified}`, 15, y);
        y += 10;

        // List
        verifs.slice(0, 30).forEach((v, i) => {
            if (y > 270) { doc.addPage(); y = 15; }
            doc.setFontSize(8);
            doc.text(`${i + 1}. ${v.namaBarang || '-'} | ${v.lokasi || '-'} | ${v.kondisiAktual || '-'}`, 15, y);
            y += 5;
        });

        doc.save(`Dashboard_${satkerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
        alert('Gagal export PDF: ' + err.message);
    }
}