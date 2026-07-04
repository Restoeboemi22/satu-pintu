const https = require('https');

// KONFIGURASI
const DATABASE_URL = "https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app";
const PATH = "/portal_inbox.json";

// DATA TUGAS YANG AKAN DIKIRIM (Simulasi dari Portal dengan Format Baru)
// Format: Judul Tugas, Deskripsi & Instruksi, Tanggal Pelaksanaan, Poin Reward
const newTask = {
  "Judul Tugas": "Tugas Review Buku Sejarah " + new Date().toLocaleTimeString(),
  "Deskripsi & Instruksi": "Baca buku sejarah minimal 20 halaman dan buat ringkasan singkat.",
  "Tanggal Pelaksanaan": new Date().toISOString().split('T')[0], // YYYY-MM-DD
  "Poin Reward": 75,
  // Field tambahan opsional (jika portal mengirimnya)
  durasi: 60
};

const data = JSON.stringify(newTask);

const url = new URL(DATABASE_URL + PATH);
const requestOptions = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log("Mengirim data ke:", DATABASE_URL + PATH);
console.log("Data Payload:", data);

const req = https.request(requestOptions, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`\nStatus: ${res.statusCode}`);
    console.log('Response:', responseData);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log("\n[SUKSES] Tugas berhasil dikirim ke Dashboard!");
      console.log("Silakan buka Dashboard -> Menu Perpustakaan -> Klik 'Ambil Tugas dari Portal'");
    } else {
      console.log("\n[GAGAL] Terjadi kesalahan saat mengirim.");
    }
  });
});

req.on('error', (error) => {
  console.error('[ERROR]', error);
});

req.write(data);
req.end();
