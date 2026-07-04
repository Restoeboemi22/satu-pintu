/**
 * Seed Script: Populate Firestore Books Collection
 * 
 * This script populates the Firestore 'books' collection with initial book data
 * from the web app's mock data, enabling the Android app to read the data.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs } = require('firebase/firestore');

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDhNn60YGopgeG5heXpcEFFZ6qX5HB3ho0",
    authDomain: "smpn3pacet-app.firebaseapp.com",
    databaseURL: "https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smpn3pacet-app",
    storageBucket: "smpn3pacet-app.firebasestorage.app",
    messagingSenderId: "786816320664",
    appId: "1:786816320664:web:e8823c4d1451a03101bced"
};

// Initial book data (from useLibraryStore.ts)
const initialBooks = [
    { title: 'Laskar Pelangi', author: 'Andrea Hirata', category: 'Fiksi', stock: 5, available: 4 },
    { title: 'Bumi Manusia', author: 'Pramoedya Ananta Toer', category: 'Fiksi', stock: 3, available: 3 },
    { title: 'Matematika Kelas 8', author: 'Kemendikbud', category: 'Pelajaran', stock: 20, available: 15 },
    { title: 'Biologi Dasar', author: 'Campbell', category: 'Sains', stock: 10, available: 10 },
    { title: 'Sejarah Indonesia Modern', author: 'M.C. Ricklefs', category: 'Sejarah', stock: 4, available: 4 },
    { title: 'Harry Potter and the Sorcerers Stone', author: 'J.K. Rowling', category: 'Fiksi', stock: 7, available: 6 },
    { title: 'Atomic Habits', author: 'James Clear', category: 'Self Improvement', stock: 5, available: 2 },
];

async function seedBooks() {
    console.log('📚 Firestore Books Seeding Script\n');
    console.log('='.repeat(60));

    try {
        // Initialize Firebase
        console.log('📡 Connecting to Firebase...');
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        console.log('✅ Connected to project:', firebaseConfig.projectId);
        console.log('');

        // Check if books already exist
        console.log('🔍 Checking existing books...');
        const booksRef = collection(db, 'books');
        const existingSnapshot = await getDocs(booksRef);

        if (!existingSnapshot.empty) {
            console.log(`⚠️  Found ${existingSnapshot.size} existing book(s)`);
            console.log('');
            console.log('❓ Do you want to add more books or skip seeding?');
            console.log('   (This script will ADD books, not replace existing ones)');
            console.log('');
            console.log('💡 To proceed anyway, the script will continue in 3 seconds...');
            console.log('   Press Ctrl+C to cancel.');

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Seed books
        console.log('');
        console.log('📝 Adding books to Firestore...');
        console.log('-'.repeat(60));

        let successCount = 0;
        let errorCount = 0;

        for (const book of initialBooks) {
            try {
                const docRef = await addDoc(booksRef, book);
                console.log(`✅ Added: "${book.title}" (ID: ${docRef.id})`);
                successCount++;
            } catch (error) {
                console.error(`❌ Failed to add "${book.title}":`, error.message);
                errorCount++;
            }
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully added: ${successCount} book(s)`);
        if (errorCount > 0) {
            console.log(`❌ Failed: ${errorCount} book(s)`);
        }
        console.log('');

        // Verify final count
        const finalSnapshot = await getDocs(booksRef);
        console.log(`📚 Total books in Firestore: ${finalSnapshot.size}`);
        console.log('');
        console.log('✅ Seeding complete!');
        console.log('');
        console.log('💡 Next steps:');
        console.log('   1. Web app will now sync with Firestore');
        console.log('   2. Android app should now receive book data');
        console.log('   3. Test both apps to verify sync is working');

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
            console.error('Firestore Security Rules are blocking write access.');
            console.error('');
            console.error('💡 SOLUTION:');
            console.error('   1. Open Firebase Console');
            console.error('   2. Go to Firestore Database → Rules');
            console.error('   3. Add write permission (temporarily for seeding):');
            console.error('');
            console.error('   match /books/{bookId} {');
            console.error('     allow read: if true;');
            console.error('     allow write: if true; // Remove after seeding');
            console.error('   }');
        }

        console.error('='.repeat(60));
        throw error;
    }
}

// Run seeding
seedBooks()
    .then(() => {
        console.log('\n✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script failed:', error.message);
        process.exit(1);
    });
