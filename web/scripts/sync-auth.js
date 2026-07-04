
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// KONFIGURASI
const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
const DRY_RUN = process.argv.includes('--dry-run');

console.log("=== SINKRONISASI SISWA KE FIREBASE AUTH ===");
if (DRY_RUN) {
    console.log("MODE: DRY RUN (SIMULASI) - Tidak ada data yang akan diubah.");
} else {
    console.log("MODE: LIVE (EKSEKUSI) - Data akan ditulis ke Firebase Auth.");
}

// 1. Inisialisasi Firebase Admin
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("\n[ERROR] File service-account.json tidak ditemukan!");
    console.error(`Lokasi yang dicari: ${SERVICE_ACCOUNT_PATH}`);
    console.error("Silakan download private key dari Firebase Console -> Project Settings -> Service Accounts");
    console.error("Dan simpan file tersebut di folder 'apps/web' dengan nama 'service-account.json'.");
    process.exit(1);
}

try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    // 1. Setup Auth App (Clean, tanpa databaseURL)
    const authConfig = {
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    };
    if (admin.apps.length === 0) {
        admin.initializeApp(authConfig);
    }
    console.log(`[OK] Auth Admin diinisialisasi: ${serviceAccount.project_id}`);

    // 2. Setup Database App (Secondary)
    const dbConfig = {
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app"
    };
    let dbApp;
    try {
        dbApp = admin.initializeApp(dbConfig, 'dbApp');
    } catch (e) {
        dbApp = admin.app('dbApp');
    }
    console.log("[OK] DB Admin diinisialisasi.");

} catch (error) {
    console.error("[ERROR] Gagal inisialisasi Firebase:", error);
    process.exit(1);
}

// Gunakan instance terpisah
const auth = admin.auth(); // Default app
const db = admin.database(admin.app('dbApp')); // Secondary app

// 2. Fungsi Utama
async function syncStudents() {
    console.log("\nMemuat data siswa dari Realtime Database...");

    try {
        const snapshot = await db.ref('students').once('value');
        const data = snapshot.val();

        if (!data) {
            console.log("Tidak ada data siswa ditemukan di database.");
            return;
        }

        const rawList = Object.keys(data).map(key => ({ ...data[key], id: key }));
        console.log(`Ditemukan ${rawList.length} entri data mentah.`);

        // 3. Logika Deduplikasi (Porting dari useStudentStore.ts)
        // Kita butuh unique list of students based on NISN
        const studentMap = new Map();
        const noNisnList = [];

        rawList.forEach(student => {
            const nisn = student.nisn ? String(student.nisn).trim() : null;
            if (nisn) {
                if (studentMap.has(nisn)) {
                    // Merge logic sederhana untuk script ini: ambil yang datanya lebih lengkap
                    const existing = studentMap.get(nisn);
                    const mergedName = (existing.name || "").length > (student.name || "").length ? existing.name : student.name;
                    studentMap.set(nisn, { ...existing, ...student, name: mergedName, id: student.id }); // Prioritas ke data terbaru/terakhir di loop tapi nama terpanjang
                } else {
                    studentMap.set(nisn, student);
                }
            } else {
                noNisnList.push(student);
            }
        });

        const studentsToSync = [...studentMap.values()];
        console.log(`Total siswa unik dengan NISN: ${studentsToSync.length}`);

        if (noNisnList.length > 0) {
            console.log(`Peringatan: Ada ${noNisnList.length} siswa tanpa NISN yang akan diabaikan.`);
        }

        // 4. Proses Sinkronisasi ke Auth
        let createdCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        console.log("\nMemulai proses sinkronisasi user...");

        // SANITY CHECK
        try {
            console.log("Sanity Check Auth...");
            await auth.listUsers(1);
            console.log("Sanity Check OK.");
        } catch (e) {
            console.error("Sanity Check FAILED:", e.code, e.message);
            // Don't exit, let's see if loop fails too
        }

        for (const student of studentsToSync) {
            const nisn = String(student.nisn).trim();
            // Generate Username yang valid untuk email
            // Format Dashboard: snake_case (acselin_uke_dwinanta)
            let cleanUsername = (student.username || student.name || "user")
                .toLowerCase()
                .replace(/\s+/g, '_')   // Ganti spasi dengan underscore
                .replace(/[^a-z0-9_]/g, ''); // Hapus karakter selain a-z, 0-9, dan _

            if (cleanUsername.length < 3) cleanUsername = "student_" + nisn;

            const email = `${cleanUsername}@spentgapa.sch.id`;
            const password = nisn; // Password default adalah NISN
            const displayName = student.name || cleanUsername;
            const uid = student.id; // Gunakan ID dari database sebagai UID Auth agar konsisten

            // Validasi Password Firebase (Min 6 chars)
            if (password.length < 6) {
                console.log(`[SKIP] ${displayName} (${nisn}) - Password/NISN kurang dari 6 karakter.`);
                skippedCount++;
                continue;
            }

            if (DRY_RUN) {
                console.log(`[SIMULASI] Create/Update User: UID=${uid}, Email=${email}, Pass=${password}, Name=${displayName}`);
                createdCount++; // Anggap sukses
                continue;
            }

            try {
                // Cek apakah user sudah ada
                try {
                    await auth.getUser(uid);
                    // User ada, kita update profilnya (opsional, password tidak direset agar tidak ganggu user lama)
                    await auth.updateUser(uid, {
                        email: email,
                        emailVerified: true,
                        displayName: displayName
                        // Password tidak diupdate otomatis untuk user existing
                    });
                    process.stdout.write("."); // Progress dot
                    updatedCount++;
                } catch (getUserError) {
                    // Cek error code atau message
                    if (getUserError.code === 'auth/user-not-found' || getUserError.message.includes('no user record')) {
                        // User tidak ada, buat baru
                        await auth.createUser({
                            uid: uid,
                            email: email,
                            emailVerified: true,
                            password: password,
                            displayName: displayName,
                            disabled: false
                        });
                        process.stdout.write("+"); // Progress plus
                        createdCount++;
                    } else {
                        console.error(`\n[ERROR CHECK USER] Code: ${getUserError.code}, Message: ${getUserError.message}`);
                        throw getUserError;
                    }
                }
            } catch (err) {
                if (err.message.includes('configuration-not-found') || err.code === 'auth/configuration-not-found') {
                    console.error(`\n[ERROR FATAL] Email/Password Provider belum diaktifkan di Firebase Console untuk project ini.`);
                    console.error(`Gagal memproses user: ${displayName}`);
                    process.exit(1); // Stop early as it won't work for anything
                }
                console.error(`\n[GAGAL] ${displayName} (${email}): ${err.message}`);
                errorCount++;
            }
            // Delay safe
            await new Promise(r => setTimeout(r, 500));
        }

        console.log("\n\n=== LAPORAN PROSES ===");
        console.log(`Berhasil Dibuat Baru : ${createdCount}`);
        console.log(`Berhasil Diupdate    : ${updatedCount}`);
        console.log(`Gagal                : ${errorCount}`);
        console.log(`Dilewati (Invalid)   : ${skippedCount}`);

        if (DRY_RUN) {
            console.log("\n[INFO] Ini adalah simulasi. Jalankan tanpa flag --dry-run untuk eksekusi nyata.");
        } else {
            console.log("\n[SUCCESS] Sinkronisasi selesai.");
        }

    } catch (err) {
        console.error("\n[ERROR FATAL]", err);
    } finally {
        process.exit(0);
    }
}

syncStudents();
