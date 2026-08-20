// ===== FIREBASE CONFIG =====
// Ganti dengan config Firebase project kamu
// Cara buat:
// 1. Buka https://console.firebase.google.com
// 2. Create Project → nama: aset-bmn-sync
// 3. Buat Realtime Database → Start in Test Mode
// 4. Copy config di bawah ini

const FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Aktifkan cloud sync?
// true = pakai Firebase (butuh internet)
// false = pakai localStorage saja (offline)
const CLOUD_SYNC_ENABLED = false;
