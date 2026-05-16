const admin = require('firebase-admin');
const serviceAccount = require('../church-firestore.firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function countSongs() {
  try {
    const churchesSnapshot = await db.collection('churches').get();
    
    for (const churchDoc of churchesSnapshot.docs) {
      console.log(`\nChurch: ${churchDoc.id}`);
      const songsSnapshot = await churchDoc.ref.collection('songs').get();
      console.log(`Total songs: ${songsSnapshot.size}`);
      
      if (songsSnapshot.size > 0) {
        console.log('\nFirst 5 songs:');
        songsSnapshot.docs.slice(0, 5).forEach(doc => {
          const data = doc.data();
          console.log(`  - ${data.title || 'Untitled'} by ${data.artist || 'Unknown'}`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

countSongs();
