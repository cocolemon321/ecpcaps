const admin = require("firebase-admin");
const serviceAccount = require("./secretkey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateIsAvailableForBikes() {
  const bikesRef = db.collection("bikes");
  const snapshot = await bikesRef.get();
  
  // Create a batch to update multiple documents at once
  const batch = db.batch();
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Check if the 'isAvailable' field is undefined (i.e. missing)
    if (data.isAvailable === undefined) {
      // Update this document to set isAvailable to true
      batch.update(doc.ref, { isAvailable: true });
      console.log(`Document ${doc.id} will be updated.`);
    }
  });
  
  await batch.commit();
  console.log("All bikes missing 'isAvailable' have been updated to true.");
}

updateIsAvailableForBikes().catch(console.error);
