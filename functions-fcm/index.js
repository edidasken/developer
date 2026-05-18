const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

// Fires on every new FlockChat message.
// Sends an FCM push to each other participant whose user doc has a valid fcmToken.
exports.onFlockChatMessage = onDocumentCreated(
  'conversations/{convId}/messages/{msgId}',
  async (event) => {
    const msg  = event.data.data();
    const db   = admin.firestore();

    const senderId   = msg.sender   || msg.uid || '';
    const senderName = msg.senderName || msg.displayName || 'Someone';
    const body       = (msg.body || msg.text || '').slice(0, 140);
    const convId     = event.params.convId;

    if (!body) return null;

    const convSnap = await db.collection('conversations').doc(convId).get();
    if (!convSnap.exists) return null;
    const participants = convSnap.data().participants || [];
    const convName     = convSnap.data().name || convSnap.data().title || 'FlockChat';

    const recipients = participants.filter(uid => uid !== senderId);
    if (!recipients.length) return null;

    const tokenDocs = await Promise.all(
      recipients.map(uid => db.collection('users').doc(uid).get())
    );

    const tokens = [];
    const uidByToken = {};
    for (const doc of tokenDocs) {
      if (!doc.exists) continue;
      const token = doc.data()?.fcmToken;
      if (token && typeof token === 'string') {
        tokens.push(token);
        uidByToken[token] = doc.id;
      }
    }
    if (!tokens.length) return null;

    const response = await admin.messaging().sendEachForMulticast({
      notification: { title: convName, body: `${senderName}: ${body}` },
      data: { conversationId: convId, channelId: convId, sender: senderId },
      tokens,
    });

    // Remove stale tokens
    const stale = response.responses
      .map((r, i) => (!r.success && (
        r.error?.code === 'messaging/invalid-registration-token' ||
        r.error?.code === 'messaging/registration-token-not-registered'
      )) ? tokens[i] : null)
      .filter(Boolean);

    if (stale.length) {
      const batch = db.batch();
      for (const token of stale) {
        const uid = uidByToken[token];
        if (uid) batch.update(db.collection('users').doc(uid), {
          fcmToken: admin.firestore.FieldValue.delete()
        });
      }
      await batch.commit();
    }

    console.log(`[FCM] sent=${response.successCount} failed=${response.failureCount} conv=${convId}`);
    return null;
  }
);
