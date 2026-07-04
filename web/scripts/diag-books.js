/**
 * Diagnostic Script: Check Firestore Books Collection
 * 
 * This script verifies:
 * 1. Connection to Firestore
 * 2. Existence of 'books' collection
 * 3. Document count and sample data
 * 4. Data structure compatibility with Android app
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase Configuration (from apps/web/src/lib/firebase.ts)
const firebaseConfig = {
    apiKey: "AIzaSyDhNn60YGopgeG5heXpcEFFZ6qX5HB3ho0",
    authDomain: "smpn3pacet-app.firebaseapp.com",
    databaseURL: "https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smpn3pacet-app",
    storageBucket: "smpn3pacet-app.firebasestorage.app",
    messagingSenderId: "786816320664",
    appId: "1:786816320664:web:e8823c4d1451a03101bced"
};

async function diagnoseBooksCollection() {
    console.log('🔍 Firestore Books Collection Diagnostic\n');
    console.log('='.repeat(60));

    try {
        // Initialize Firebase
        console.log('📡 Connecting to Firebase...');
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        console.log('✅ Connected to project:', firebaseConfig.projectId);
        console.log('');

        // Query books collection
        console.log('📚 Querying "books" collection...');
        const booksRef = collection(db, 'books');
        const snapshot = await getDocs(booksRef);

        console.log('');
        console.log('='.repeat(60));
        console.log('📊 RESULTS');
        console.log('='.repeat(60));

        if (snapshot.empty) {
            console.log('❌ ISSUE FOUND: Books collection is EMPTY');
            console.log('');
            console.log('This explains why the Android app receives no data!');
            console.log('');
            console.log('💡 SOLUTION OPTIONS:');
            console.log('   A. Migrate web app to use Firestore (recommended)');
            console.log('   B. Migrate Android app to use Realtime Database');
            console.log('   C. Seed Firestore with initial book data');
            console.log('');
        } else {
            console.log(`✅ Found ${snapshot.size} book(s) in Firestore`);
            console.log('');

            // Display sample documents
            console.log('📄 Sample Documents:');
            console.log('-'.repeat(60));

            let count = 0;
            snapshot.forEach((doc) => {
                if (count < 3) { // Show first 3 documents
                    console.log(`\nDocument ID: ${doc.id}`);
                    const data = doc.data();
                    console.log('Data:', JSON.stringify(data, null, 2));

                    // Verify compatibility with Android Book model
                    const requiredFields = ['title', 'author', 'category', 'stock'];
                    const missingFields = requiredFields.filter(field => !data[field] && !data.judul && !data.penulis && !data.kategori);

                    if (missingFields.length > 0) {
                        console.log('⚠️  Missing fields:', missingFields.join(', '));
                    }
                    count++;
                }
            });

            if (snapshot.size > 3) {
                console.log(`\n... and ${snapshot.size - 3} more document(s)`);
            }

            console.log('');
            console.log('✅ Android app should be able to read this data');
        }

        console.log('='.repeat(60));

    } catch (error) {
        console.error('');
        console.error('='.repeat(60));
        console.error('❌ ERROR OCCURRED');
        console.error('='.repeat(60));
        console.error('Error:', error.message);
        console.error('');

        if (error.code === 'permission-denied') {
            console.error('🔒 PERMISSION DENIED');
            console.error('');
            console.error('This means Firestore Security Rules are blocking access.');
            console.error('');
            console.error('💡 SOLUTION:');
            console.error('   1. Open Firebase Console');
            console.error('   2. Go to Firestore Database → Rules');
            console.error('   3. Add read permission for books collection:');
            console.error('');
            console.error('   match /books/{bookId} {');
            console.error('     allow read: if true; // or if request.auth != null;');
            console.error('   }');
        }

        console.error('='.repeat(60));
    }
}

// Run diagnostic
diagnoseBooksCollection()
    .then(() => {
        console.log('\n✅ Diagnostic complete');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Diagnostic failed:', error);
        process.exit(1);
    });
