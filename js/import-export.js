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

            let finalData = [];
            let usedSheet = '';

            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const range = sheet['!ref'] || '';
                console.log(`Sheet '${sheetName}' range: ${range}`);

                let rawRows = [];
                try {
                    rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                } catch(e) {}

                let jsonRows = [];
                try {
                    jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                } catch(e) {}

                console.log(`  Sheet '${sheetName}': raw=${rawRows.length}, json=${jsonRows.length}`);

                if (jsonRows.length > 0) {
                    finalData = jsonRows;
                    usedSheet = sheetName;
                    console.log(`  Using JSON from '${sheetName}'. Cols:`, Object.keys(jsonRows[0] || {}));
                    break;
                }

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

            // ===== SATKER FILTER: auto-filter if Excel has a satker column =====
            if (finalData.length > 0 && currentSatker) {
                const cols = Object.keys(finalData[0]);
                const satkerCol = cols.find(c => c.toLowerCase().includes('satker'));
                if (satkerCol) {
                    const satkerPatterns = {
                        sekretariat: ['sekretariat', 'sekjen', 'sekretariat jendral', 'sekretariat jenderal'],
                        pendidikan: ['pendidikan', 'pendis', 'pendidikan islam'],
                        bimas: ['bimas', 'bimbingan masyarakat', 'bimbingan masyarakat islam']
                    };
                    const patterns = satkerPatterns[currentSatker] || [currentSatker];
                    const beforeCount = finalData.length;
                    finalData = finalData.filter(row => {
                        const val = String(row[satkerCol] || '').trim().toLowerCase();
                        return patterns.some(p => val.includes(p));
                    });
                    console.log(`Satker filter (${satkerCol}): ${beforeCount} → ${finalData.length} rows for '${currentSatker}'`);
                }
            }

            if (finalData.length === 0) {
                showImportProgress(false);
                showToast(`Tidak ada data untuk satker ${SATKER_MAP[currentSatker] || currentSatker} di file ini.`, 'error');
                return;
            }

            console.log(`Final: ${finalData.length} rows from sheet '${usedSheet}'`);
            showImportProgress(true, `Memproses ${finalData.length} data...`);

            let imported = 0;
            const newAssets = [];

            finalData.forEach((row, i) => {
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
                    'Tipe/Spesifikasi', 'Tipe_Spesifikasi', 'tipe_spesifikasi', 'Merk/Type'
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
                    'Status', 'status', 'STATUS', 'Status Barang', 'Status_Barang', 'Status Aset'
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

                if (!kodeBarang || !nup) return;

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

            const existing = allAssets[currentSatker] || [];
            const existingMap = {};
            existing.forEach(a => { existingMap[a.kodeBarang + '|' + a.nup] = a; });
            newAssets.forEach(a => { existingMap[a.kodeBarang + '|' + a.nup] = a; });
            allAssets[currentSatker] = Object.values(existingMap);
            currentAssets = allAssets[currentSatker];
            saveData();
            updateStats();
            renderRecentList();
            renderUnverifiedList();
            renderSyncIndicator();

            showImportProgress(false);

            if (imported === 0) {
                const keys = Object.keys(finalData[0] || {});
                showToast(`0 aset! Kolom: ${keys.slice(0,6).join(', ')}`, 'error');
            } else {
                const totalNow = allAssets[currentSatker].length;
                showToast(`${imported} aset diproses! Total: ${totalNow} aset (auto-dedup)`, 'success');
            }

            document.getElementById('fileInput').value = '';
        } catch (err) {
            showImportProgress(false);
            console.error('Import error:', err);
            showToast(`Gagal: ${err.message}`, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function findColumnValue(row, possibleNames) {
    const keys = Object.keys(row);

    for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== '' && row[name] !== null) {
            return row[name];
        }
    }
    for (const name of possibleNames) {
        const found = keys.find(k => k.toLowerCase() === name.toLowerCase());
        if (found && row[found] !== '' && row[found] !== null) {
            return row[found];
        }
    }
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
                new Date(verification.tanggalVerifikasi).toLocaleDateString('id-ID') : '',
            'Foto (Base64)': verification?.foto ? verification.foto.substring(0, 50) + '...' : ''
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

// ===== PDF EXPORT =====
function exportPDF() {
    const verifs = verifications[currentSatker] || [];
    const satkerName = SATKER_MAP[currentSatker];

    if (currentAssets.length === 0 && verifs.length === 0) {
        showToast('Tidak ada data untuk diexport!', 'error');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = 210;
        const margin = 15;
        let y = margin;

        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, pageW, 35, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Laporan Verifikasi Aset BMN', pageW / 2, 15, { align: 'center' });
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(satkerName, pageW / 2, 23, { align: 'center' });
        doc.setFontSize(9);
        doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageW / 2, 30, { align: 'center' });

        y = 45;

        const total = currentAssets.length;
        const verified = verifs.length;
        const baik = verifs.filter(v => v.kondisiAktual === 'Baik').length;
        const rusak = verifs.filter(v => v.kondisiAktual === 'Rusak Ringan' || v.kondisiAktual === 'Rusak Berat').length;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Ringkasan:', margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Total Aset: ${total}  |  Terverifikasi: ${verified}  |  Baik: ${baik}  |  Rusak: ${rusak}  |  Belum: ${total - verified}`, margin, y);
        y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        const verifiedAssets = verifs;

        if (verifiedAssets.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text('Belum ada aset yang diverifikasi.', pageW / 2, y + 20, { align: 'center' });
        }

        verifiedAssets.forEach((v, i) => {
            if (y > 240) {
                doc.addPage();
                y = margin;
            }

            const cardH = v.foto ? 62 : 30;
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(220, 220, 220);
            doc.roundedRect(margin, y, pageW - margin * 2, cardH, 3, 3, 'FD');

            doc.setFillColor(37, 99, 235);
            doc.circle(margin + 6, y + 6, 4, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(String(i + 1), margin + 6, y + 7.5, { align: 'center' });

            let ty = y + 5;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(v.namaBarang || 'Tanpa Nama', margin + 14, ty);
            ty += 5;

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`KB: ${v.kodeBarang || '-'}  |  NUP: ${v.nup || '-'}  |  ${v.merk || ''} ${v.tipe || ''}`, margin + 14, ty);
            ty += 5;

            const kondisiColor = v.kondisiAktual === 'Baik' ? [22, 163, 74] :
                               v.kondisiAktual === 'Rusak Ringan' ? [234, 179, 8] : [220, 38, 38];
            doc.setFillColor(...kondisiColor);
            doc.roundedRect(margin + 14, ty - 3, 28, 6, 1.5, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(v.kondisiAktual || '-', margin + 28, ty, { align: 'center' });

            doc.setTextColor(60, 60, 60);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(`Lokasi: ${v.lokasi || '-'}  |  ${v.tanggalVerifikasi ? new Date(v.tanggalVerifikasi).toLocaleDateString('id-ID') : '-'}`, margin + 46, ty);

            if (v.foto) {
                try {
                    doc.addImage(v.foto, 'JPEG', margin + 14, ty + 6, 40, 30);
                    if (v.catatan) {
                        doc.setFontSize(8);
                        doc.setTextColor(80, 80, 80);
                        doc.text('Catatan:', margin + 58, ty + 9);
                        const splitCatatan = doc.splitTextToSize(v.catatan, pageW - margin * 2 - 46);
                        doc.text(splitCatatan, margin + 58, ty + 14);
                    }
                } catch (e) {
                    console.log('Photo embed failed:', e);
                }
            }

            y += cardH + 4;
        });

        const footerY = doc.internal.pageSize.height - 10;
        doc.setFontSize(7);
        doc.setTextColor(180, 180, 180);
        doc.text('Generated by Verifikasi Aset BMN - Kementerian Agama RI', pageW / 2, footerY, { align: 'center' });

        const date = new Date().toISOString().split('T')[0];
        doc.save(`Laporan_Verifikasi_${satkerName.replace(/\s+/g, '_')}_${date}.pdf`);

        showToast('PDF berhasil diexport dengan foto!', 'success');
    } catch (err) {
        console.error('PDF export error:', err);
        showToast('Gagal export PDF: ' + err.message, 'error');
    }
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
