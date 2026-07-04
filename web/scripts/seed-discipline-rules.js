
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const rulesData = require('./data/discipline_rules.json');

// LOAD SERVICE ACCOUNT
let SERVICE_ACCOUNT_PATH = path.join(__dirname, '../service-account.json');
if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error("Error: service-account.json not found!");
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

// INITIALIZE FIREBASE
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://smpn3pacet-app-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
}

const db = admin.database();

async function seedRules() {
    console.log("=== SEEDING DISCIPLINE RULES ===");
    console.log(`Found ${rulesData.length} rules to seed.`);

    const rulesRef = db.ref('discipline_rules');

    try {
        // Option 1: Overwrite all rules
        // await rulesRef.set(rulesData);
        
        // Option 2: Smart update (keep existing IDs, add new ones)
        // For simplicity and consistency, we will iterate and update based on ID
        
        // Retrieve existing rules to verify
        const snapshot = await rulesRef.once('value');
        const existingRules = snapshot.val() || [];
        
        // Convert array to map for easier checking if needed, but here we just push the clean list
        // Note: Firebase arrays with numeric keys can be tricky if sparse. 
        // Ideally, we use string keys or ensure the array is dense.
        // Our IDs are not sequential (1, 2, 11, 21...), so using them as array indices is bad.
        // Better to store as an object where key = id, or key = generated push ID.
        // However, the app expects a list. Let's stick to list structure but maybe re-index or use object with ID keys.
        
        // Let's check how the app consumes it.
        // Android: `snapshot.children.mapNotNull { it.getValue(DisciplineRule::class.java) }`
        // This handles both List (array) and Map (object) structures fine as long as the object inside has the fields.
        
        // Strategy: Use ID as the key in Firebase to prevent duplicates and allow easy updates.
        // e.g. discipline_rules/1: { ... }
        
        const updates = {};
        rulesData.forEach(rule => {
            const rulePayload = {
                ...rule,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            // Use rule ID as key
            updates[rule.id] = rulePayload;
        });

        await rulesRef.update(updates);
        console.log("✅ Successfully seeded rules!");
        
    } catch (error) {
        console.error("❌ Error seeding rules:", error);
    } finally {
        process.exit(0);
    }
}

seedRules();
