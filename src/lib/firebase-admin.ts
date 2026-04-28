import admin from 'firebase-admin';

if (!admin.apps.length) {
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (clientEmail && rawKey && projectId) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: rawKey.replace(/\\n/g, '\n'),
            }),
        });
    } else {
        // Fallback for environments with Application Default Credentials
        admin.initializeApp();
    }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
export default admin;
