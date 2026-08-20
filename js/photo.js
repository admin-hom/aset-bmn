// ===== PHOTO HANDLING =====
function showPhotoOptions() {
    if (currentPhoto) return;
    showPhotoModal();
}

function showPhotoModal() {
    const existing = document.getElementById('photoModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'photoModal';
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-icon"><i class="fas fa-camera"></i></div>
            <h2>Ambil Foto</h2>
            <p>Pilih sumber foto aset</p>
            <div class="modal-actions" style="flex-direction: column; gap: 8px;">
                <button class="btn btn-primary btn-full" onclick="triggerCamera()">
                    <i class="fas fa-camera"></i> Ambil dari Kamera
                </button>
                <button class="btn btn-info btn-full" onclick="triggerGallery()">
                    <i class="fas fa-images"></i> Pilih dari Galeri
                </button>
                <button class="btn btn-secondary" onclick="closePhotoModal()">Batal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closePhotoModal() {
    const modal = document.getElementById('photoModal');
    if (modal) modal.remove();
}

function triggerCamera() {
    closePhotoModal();
    document.getElementById('inputFoto').click();
}

function triggerGallery() {
    closePhotoModal();
    document.getElementById('inputFotoGallery').click();
}

function handlePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;

    const originalSize = file.size;

    const reader = new FileReader();
    reader.onload = (e) => {
        compressPhoto(e.target.result, originalSize).then(compressed => {
            currentPhoto = compressed;
            showPhotoPreview(currentPhoto);
        });
    };
    reader.readAsDataURL(file);
}

// ===== PHOTO COMPRESSION =====
function compressPhoto(dataUrl, originalSize) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            const MAX_DIM = 1200;
            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height = Math.round((height / width) * MAX_DIM);
                    width = MAX_DIM;
                } else {
                    width = Math.round((width / height) * MAX_DIM);
                    height = MAX_DIM;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressed = canvas.toDataURL('image/jpeg', 0.7);
            const compressedSize = Math.round((compressed.length - 'data:image/jpeg;base64,'.length) * 0.75);

            const saved = originalSize - compressedSize;
            const percent = originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0;

            if (saved > 0) {
                showToast(`Foto dikompres: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (-${percent}%)`, 'info');
            }

            resolve(compressed);
        };
        img.src = dataUrl;
    });
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function showPhotoPreview(src) {
    const preview = document.getElementById('photoPreview');
    const actions = document.getElementById('photoActions');
    preview.innerHTML = `<img src="${src}" alt="Foto Aset">`;
    preview.onclick = null;
    actions.classList.remove('hidden');
    actions.querySelectorAll('.btn-primary, .btn-info').forEach(b => b.style.display = 'none');
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
    preview.onclick = showPhotoOptions;
    actions.classList.add('hidden');
    document.getElementById('inputFoto').value = '';
    document.getElementById('inputFotoGallery').value = '';
}
