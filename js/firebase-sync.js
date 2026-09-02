// ===== MERGE VERIFICATIONS (prevent onSnapshot overwriting newer local data) =====
function mergeVerifications(local, remote) {
    const merged = new Map();
    for (const item of remote) {
        merged.set(item.kodeBarang + '|' + item.nup, { ...item });
    }
    for (const item of local) {
        const key = item.kodeBarang + '|' + item.nup;
        const existing = merged.get(key);
        if (!existing) {
            // Only in local — keep it (pending push)
            merged.set(key, { ...item });
        } else if (!existing.tanggalVerifikasi || !item.tanggalVerifikasi ||
                   new Date(item.tanggalVerifikasi) >= new Date(existing.tanggalVerifikasi)) {
            // Local is newer or same — keep local (preserves foto!)
            merged.set(key, { ...item });
        }
        // else remote is newer — keep remote
    }
    return Array.from(merged.values());
}

// ===== FIREBASE INIT (Firestore) =====
function initFirebase() {
    try {
        if (typeof FIREBASE_CONFIG === 'undefined' || !CLOUD_SYNC_ENABLED) {
            console.log('Firebase: disabled (local mode)');
            return false;
        }
        if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
            console.log('Firebase: not configured yet');
            return false;
        }
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        firebaseDb = firebaseApp.firestore();
        console.log('Firestore: connected!');

        window.addEventListener('online', () => {
            isOnline = true;
            updateSyncStatus('syncing');
            // Re-sync current satker when coming online
            if (currentSatker) syncFromFirebase(currentSatker);
        });
        window.addEventListener('offline', () => {
            isOnline = false;
            updateSyncStatus('local');
        });

        listenToFirebase();
        return true;
    } catch (err) {
        console.error('Firebase init error:', err);
        return false;
    }
}

const CHUNK_SIZE = 2000;

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

// ===== LISTENERS (per-satker, never triggers push) =====
function listenToFirebase() {
    if (!firebaseDb) return;

    Object.keys(SATKER_MAP).forEach(satker => {
        firebaseDb.collection('verifications').doc(satker).onSnapshot((doc) => {
            if (doc.exists) {
                const remoteData = doc.data().items || [];
                const localData = verifications[satker] || [];
                const merged = mergeVerifications(localData, remoteData);
                const oldKey = JSON.stringify(localData);
                const newKey = JSON.stringify(merged);
                if (oldKey !== newKey) {
                    verifications[satker] = merged;
                    // CRITICAL: saveLocal() only — NEVER saveData() here to avoid infinite push loop
                    saveLocal();
                    // Re-render UI only if this is the active satker
                    if (satker === currentSatker) {
                        updateStats(); renderRecentList(); renderUnverifiedList();
                    }
                }
            }
        }, (err) => {
            console.error('Firestore verif listener error:', satker, err);
        });
    });

    console.log('Firestore: ready (verif=realtime, assets=manual)');
    cleanupOldFirestoreDocs();
}

function cleanupOldFirestoreDocs() {
    if (!firebaseDb) return;
    firebaseDb.collection('verifications').doc('allVerifications').delete().catch(() => {});
    firebaseDb.collection('assets').doc('allAssets').delete().catch(() => {});
}

// ===== PUSH — explicit satker parameter, NEVER uses currentSatker =====
function pushToFirebase(satker) {
    if (!satker) satker = currentSatker;
    if (!firebaseDb || !isOnline || !satker) {
        console.log('Push skipped:', { db: !!firebaseDb, online: isOnline, satker });
        return;
    }
    updateSyncStatus('syncing');

    // Snapshot data at call time — immune to global state changes during async
    const pushSatker = satker;
    const satkerAssets = allAssets[pushSatker] || [];
    const satkerVerifs = verifications[pushSatker] || [];
    console.log('Pushing:', pushSatker, satkerAssets.length, 'assets,', satkerVerifs.length, 'verifications');
    const chunks = chunkArray(satkerAssets, CHUNK_SIZE);

    const metaRef = firebaseDb.collection('assets').doc(pushSatker + '_meta');
    metaRef.get().then(() => {
        const writePromises = chunks.map((chunk, i) =>
            firebaseDb.collection('assets').doc(`${pushSatker}_${i}`).set({ items: chunk })
        );
        writePromises.push(metaRef.set({ chunkCount: chunks.length }));
        writePromises.push(
            firebaseDb.collection('verifications').doc(pushSatker).set({ items: satkerVerifs })
        );
        return Promise.all(writePromises);
    }).then(() => {
        console.log('Push OK:', pushSatker, '- chunks:', chunks.length, '- verifs:', satkerVerifs.length);
        updateSyncStatus('synced');
    }).catch(err => {
        console.error('Firestore push FAILED:', pushSatker, err.message, err);
        updateSyncStatus('error');
    });
}

// ===== SYNC FROM FIRESTORE — explicit satker parameter =====
function syncFromFirebase(satker) {
    if (!satker) satker = currentSatker;
    if (!firebaseDb || !satker) return;
    updateSyncStatus('syncing');

    const syncSatker = satker;

    firebaseDb.collection('assets').doc(syncSatker + '_meta').get()
        .then((metaDoc) => {
            const chunkCount = metaDoc.exists ? (metaDoc.data().chunkCount || 0) : 0;
            if (chunkCount === 0) {
                allAssets[syncSatker] = [];
                return firebaseDb.collection('verifications').doc(syncSatker).get();
            }
            const promises = [];
            for (let i = 0; i < chunkCount; i++) {
                promises.push(
                    firebaseDb.collection('assets').doc(`${syncSatker}_${i}`).get()
                        .then(doc => doc.exists ? doc.data().items : [])
                        .catch(() => [])
                );
            }
            return Promise.all(promises).then(chunks => {
                allAssets[syncSatker] = chunks.flat();
                return firebaseDb.collection('verifications').doc(syncSatker).get();
            });
        })
        .then((verifDoc) => {
            if (verifDoc && verifDoc.exists) {
                const remoteVerifs = verifDoc.data().items || [];
                const localVerifs = verifications[syncSatker] || [];
                // MERGE instead of replace — local verifications (with foto) survive
                verifications[syncSatker] = mergeVerifications(localVerifs, remoteVerifs);
            }
            // Only update UI if this is the active satker
            if (syncSatker === currentSatker) {
                currentAssets = allAssets[syncSatker] || [];
                updateStats();
                renderRecentList();
                renderUnverifiedList();
            }
            saveLocal();
            updateSyncStatus('synced');
        })
        .catch(err => {
            console.error('Firestore sync error:', syncSatker, err);
            updateSyncStatus('error');
        });
}

// ===== FORCE LOAD — explicit satker, never pushes back =====
function forceLoadFromFirestore(satker) {
    if (!firebaseDb) return;
    updateSyncStatus('syncing');

    const loadSatker = satker;

    firebaseDb.collection('assets').doc(loadSatker + '_meta').get()
        .then((metaDoc) => {
            const chunkCount = metaDoc.exists ? (metaDoc.data().chunkCount || 0) : 0;
            if (chunkCount === 0) {
                console.log('Firestore: no meta for ' + loadSatker + ', keeping local data');
                return firebaseDb.collection('verifications').doc(loadSatker).get();
            }
            const promises = [];
            for (let i = 0; i < chunkCount; i++) {
                promises.push(
                    firebaseDb.collection('assets').doc(`${loadSatker}_${i}`).get()
                        .then(doc => doc.exists ? doc.data().items : [])
                        .catch(() => [])
                );
            }
            return Promise.all(promises).then(chunks => {
                allAssets[loadSatker] = chunks.flat();
                return firebaseDb.collection('verifications').doc(loadSatker).get();
            });
        })
        .then((verifDoc) => {
            if (verifDoc && verifDoc.exists) {
                const remoteVerifs = verifDoc.data().items || [];
                const localVerifs = verifications[loadSatker] || [];
                // MERGE instead of replace — local verifications (with foto) survive
                verifications[loadSatker] = mergeVerifications(localVerifs, remoteVerifs);
            }
            // Only update UI if this is still the active satker
            if (loadSatker === currentSatker) {
                currentAssets = allAssets[loadSatker] || [];
                updateStats();
                renderRecentList();
                renderUnverifiedList();
            }
            // CRITICAL: saveLocal() only — never pushToFirebase() here!
            saveLocal();
            updateSyncStatus('synced');
        })
        .catch(err => {
            console.error('Force load error:', loadSatker, err);
            updateSyncStatus('error');
        });
}

function updateSyncStatus(status) {
    syncStatus = status;
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;
    const labels = {
        local: '<i class="fas fa-cloud" style="color:var(--text-muted)"></i> <span style="color:var(--text-muted)">Local</span>',
        syncing: '<i class="fas fa-sync fa-spin" style="color:var(--warning)"></i> <span style="color:var(--warning)">Syncing...</span>',
        synced: '<i class="fas fa-cloud" style="color:var(--success)"></i> <span style="color:var(--success)">Synced</span>',
        error: '<i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i> <span style="color:var(--danger)">Error</span>'
    };
    indicator.innerHTML = labels[status] || labels.local;
}

function renderSyncIndicator() {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;
    if (firebaseDb) {
        updateSyncStatus('synced');
    } else {
        indicator.innerHTML = '<i class="fas fa-cloud" style="color:var(--text-muted)"></i> <span style="color:var(--text-muted)">Local</span>';
    }
    const statusEl = document.getElementById('firebaseStatus');
    if (statusEl && firebaseDb) {
        statusEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <i class="fas fa-check-circle" style="color:var(--success);font-size:1.2rem;"></i>
                <strong style="color:var(--success);">Firebase Connected</strong>
            </div>
            <p class="text-muted" style="font-size:0.85rem;">Data otomatis sync antar device.</p>
            <button class="btn btn-primary btn-full" onclick="syncFromFirebase()" style="margin-top:12px;">
                <i class="fas fa-sync"></i> Sync Manual
            </button>
        `;
    }
}

function testFirebaseConnection() {
    if (!firebaseDb) {
        showToast('Firebase belum dikonfigurasi! Edit firebase-config.js dulu.', 'error');
        return;
    }
    firebaseDb.ref('.info/connected').once('value', (snap) => {
        if (snap.val()) {
            showToast('Firebase connected! ✅', 'success');
        } else {
            showToast('Firebase unreachable ❌', 'error');
        }
    });
}
