
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

(async () => {
    try {
        console.log(`Checking project: ${serviceAccount.project_id}`);
        const listUsersResult = await admin.auth().listUsers(10);
        console.log(`Successfully listed ${listUsersResult.users.length} users.`);
        listUsersResult.users.forEach(user => {
            console.log(`- UID: ${user.uid}, Email: ${user.email}`);
        });
    } catch (error) {
        console.error("FAILED to list users:", error.code, error.message);
    }
    process.exit(0);
})();
