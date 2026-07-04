
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json.json');
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

console.log("Private Key Check:");
console.log(serviceAccount.private_key ? serviceAccount.private_key.substring(0, 50) + "..." : "MISSING");
console.log("Client Email:", serviceAccount.client_email);
console.log("Apps Count:", admin.apps.length);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const auth = admin.auth();

(async () => {
    console.log("Testing Admin SDK Connection (Retry)...");

    try {
        console.log("Attempting listUsers(1)...");
        const listUsersResult = await auth.listUsers(1);
        console.log("listUsers success. Users found:", listUsersResult.users.length);
    } catch (error) {
        console.log("listUsers FAILED:", error.code, error.message);
    }

    try {
        console.log("Attempting createUser (dummy)...");
        const user = await auth.createUser({
            uid: "test_user_debug_" + Date.now(),
            email: "test_debug_" + Date.now() + "@example.com"
        });
        console.log("createUser SUCCESS:", user.uid);
        // cleanup
        await auth.deleteUser(user.uid);
    } catch (error) {
        console.log("createUser FAILED:", error.code, error.message);
        // console.log("Full Error:", JSON.stringify(error, null, 2));
    }
})();
