
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
    apiKey: "AIzaSyDhNn60YGopgeG5heXpcEFFZ6qX5HB3ho0",
    authDomain: "smpn3pacet-app.firebaseapp.com",
    projectId: "smpn3pacet-app",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

(async () => {
    console.log("Testing Client SDK Auth...");
    const testEmail = "client_test_" + Date.now() + "@example.com";
    const testPass = "password123";

    try {
        console.log(`Creating user: ${testEmail}`);
        const userCred = await createUserWithEmailAndPassword(auth, testEmail, testPass);
        console.log("SUCCESS! User created. UID:", userCred.user.uid);
    } catch (error) {
        console.log("FAILED to create user:", error.code, error.message);
    }
})();
