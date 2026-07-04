
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
        const app = admin.app();
        console.log(`App Name: ${app.name}`);
        console.log(`Project ID from options: ${app.options.projectId}`);

        const listUsersResult = await admin.auth().listUsers(1);
        console.log("SUCCESS! listUsers worked.");
    } catch (error) {
        console.error("FAILED:", error.code, error.message);
    }
    process.exit(0);
})();
