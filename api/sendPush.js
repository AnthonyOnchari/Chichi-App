import admin from 'firebase-admin';

function getFirebaseAdmin() {
    if (!admin.apps.length) {
        var serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
        if (!serviceAccount.project_id || !serviceAccount.private_key) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: 'https://chichi-001-default-rtdb.firebaseio.com'
        });
    }
    return admin;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        var body = req.body || {};
        if (!body.recipientUid || !body.title || !body.message) {
            return res.status(400).json({ error: 'recipientUid, title, and message are required' });
        }

        var firebaseAdmin = getFirebaseAdmin();
        var authorization = req.headers.authorization || '';
        if (!authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
        var decodedToken = await firebaseAdmin.auth().verifyIdToken(authorization.slice(7));
        if (decodedToken.uid !== body.senderUid) return res.status(403).json({ error: 'Invalid sender' });
        var snapshot = await firebaseAdmin.database().ref('users/' + body.recipientUid + '/fcmTokens').once('value');
        var tokens = Object.keys(snapshot.val() || {});
        if (!tokens.length) return res.status(200).json({ success: true, sent: 0 });

        var result = await firebaseAdmin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: { title: String(body.title).slice(0, 80), body: String(body.message).slice(0, 240) },
            data: { url: body.url || '/' }
        });

        var staleUpdates = {};
        result.responses.forEach(function(response, index) {
            if (!response.success && response.error && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].indexOf(response.error.code) !== -1) {
                staleUpdates[tokens[index]] = null;
            }
        });
        if (Object.keys(staleUpdates).length) {
            await firebaseAdmin.database().ref('users/' + body.recipientUid + '/fcmTokens').update(staleUpdates);
        }

        return res.status(200).json({ success: true, sent: result.successCount, failed: result.failureCount });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Push service unavailable' });
    }
}
