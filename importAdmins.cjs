// importAdmins.cjs
const admin = require("firebase-admin");
const serviceAccount = require("./secretkey.json"); // Path to your downloaded key
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// Initialize Admin SDK using service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();
const auth = getAuth();

async function migrateAdmins() {
  try {
    const adminsSnapshot = await db.collection("admins").get();
    for (const docRef of adminsSnapshot.docs) {
      const adminData = docRef.data();
      const password = adminData.password; // Plaintext or temp password

      try {
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: adminData.name,
        });

        await db.collection("admins").doc(docRef.id).update({
          uid: userRecord.uid,
          // Optionally remove the plaintext password field
        });

        console.log(
          `Successfully created user for ${email} with UID: ${userRecord.uid}`
        );
      } catch (err) {
        console.error(`Error creating user for ${email}:`, err);
      }
    }
    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

migrateAdmins();
