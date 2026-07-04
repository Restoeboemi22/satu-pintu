
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

(async () => {
    try {
        console.log("Listing users with default parameters...");
        const listUsersResult = await admin.auth().listUsers();
        console.log(`SUCCESS! Found ${listUsersResult.users.length} users.`);
    } catch (error) {
        console.error("FAILED:", error.code, error.message);
    }
    process.exit(0);
})();
