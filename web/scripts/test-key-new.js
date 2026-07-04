
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
    apiKey: "AIzaSyBwwna5SrM7pfhC7hL6_g8y63cAUu_8cpo",
    authDomain: "smpn3pacet-app.firebaseapp.com",
    projectId: "smpn3pacet-app",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

(async () => {
    console.log("Testing Client SDK Auth with Key from google-services.json...");
    const testEmail = "key_test_" + Date.now() + "@example.com";
    const testPass = "password123";

    try {
        console.log(`Creating user: ${testEmail}`);
        const userCred = await createUserWithEmailAndPassword(auth, testEmail, testPass);
        console.log("SUCCESS! User created. UID:", userCred.user.uid);
    } catch (error) {
        console.log("FAILED to create user:", error.code, error.message);
    }
    process.exit(0);
})();
