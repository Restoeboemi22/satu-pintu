
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, child } = require('firebase/database');

// Config matching the project (using generic placeholder or env if available, 
// but for this script I'll assume standard emulator or existing config if I can find it. 
// Actually I don't have the firebase config keys here. 
// I will just simulate the parsing logic logic purely in JS without connecting to real DB 
// to prove the LOGIC is sound. Connecting to real DB requires credentials I might not want to hardcode or guess).

// Wait, I can't connect to real DB easily without config. 
// But I can simulate the "Fetch" result structure and pass it to the parser.

const mockSnapshotFromPortal = {
  "task-123": {
    "Judul Tugas": "yuk bisa",
    "Deskripsi & Instruksi": "Ini tugas cobaan",
    "Tanggal Pelaksanaan": "2026-01-30",
    "Poin Reward": 100
  }
};

console.log("1. Data Mentah dari Portal (Simulasi):");
console.log(JSON.stringify(mockSnapshotFromPortal, null, 2));

// The parsing logic from useLibraryStore.ts
const parsedTasks = Object.keys(mockSnapshotFromPortal).map(key => {
  const item = mockSnapshotFromPortal[key];
  
  // Helper to parse date string to timestamp
  const parseDate = (dateStr) => {
    if (typeof dateStr === 'number') return dateStr;
    if (!dateStr) return Date.now();
    // Try parsing "YYYY-MM-DD" or similar
    const parsed = new Date(dateStr).getTime();
    return isNaN(parsed) ? Date.now() : parsed;
  };

  return {
    id: key,
    // Handle multiple potential key formats (English, Indonesian, camelCase, lowerCase, Custom Portal)
    title: item.title || item.judul || item.Judul || item["Judul Tugas"] || "Tanpa Judul",
    description: item.description || item.deskripsi || item.Deskripsi || item["Deskripsi & Instruksi"] || item.instruction || "Tidak ada deskripsi",
    points: Number(item.points || item.poin || item.Poin || item["Poin Reward"] || item.reward || 0),
    // Map "Tanggal Pelaksanaan" to createdAt
    createdAt: parseDate(item.createdAt || item.date || item.tanggal || item.Tanggal || item["Tanggal Pelaksanaan"] || item.executionDate),
    // Default duration if not provided (Default 1 Jam Pelajaran = 45 Menit)
    durationMinutes: Number(item.durationMinutes || item.durasi || 45)
  };
});

console.log("\n2. Hasil Analisa Dashboard (Kode Baru):");
console.log(JSON.stringify(parsedTasks, null, 2));

console.log("\n3. Kesimpulan:");
if (parsedTasks[0].title === "yuk bisa") {
  console.log("SUKSES: Kode baru BERHASIL membaca format 'Judul Tugas'.");
} else {
  console.log("GAGAL: Kode baru masih belum bisa membaca format.");
}
