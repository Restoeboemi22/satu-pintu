
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

(async () => {
    try {
        console.log(`Diagnostic for project: ${serviceAccount.project_id}`);
        const auth = admin.auth();

        console.log("Attempting to get project config...");
        // This is a bit of a hack but might reveal if Identity Platform is used
        try {
            const tenantManager = auth.tenantManager();
            const listTenants = await tenantManager.listTenants(5);
            console.log("SUCCESS listing tenants. Count:", listTenants.tenants.length);
            listTenants.tenants.forEach(t => console.log("- Tenant:", t.tenantId, t.displayName));
        } catch (e) {
            console.log("Tenant listing failed (possibly not using Identity Platform):", e.code, e.message);
        }

    } catch (error) {
        console.error("DIAGNOSTIC FAILED:", error.code, error.message);
    }
    process.exit(0);
})();
