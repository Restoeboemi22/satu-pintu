
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json.json');
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
}

const auth = admin.auth();

const testEmails = [
    'virdy_putri_harum_kusuma@spentgapa.sch.id',
    'zaini_ali_mahmud@spentgapa.sch.id',
    'zaverio_amsyar_raffasya@spentgapa.sch.id'
];

(async () => {
    for (const email of testEmails) {
        try {
            const user = await auth.getUserByEmail(email);
            console.log(`[FOUND] ${email}: UID=${user.uid}`);
        } catch (error) {
            console.log(`[NOT FOUND] ${email}: ${error.code}`);
        }
    }
    process.exit(0);
})();
