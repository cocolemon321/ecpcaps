import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore"; // Optimized imports

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAqEefB5cZ1jVzeqdhxfRYHUzOqgyUqieo",
  authDomain: "ecp-caps.firebaseapp.com",
  projectId: "ecp-caps",
  storageBucket: "ecp-caps.firebasestorage.app",
  messagingSenderId: "1040391525167",
  appId: "1:1040391525167:web:c4b9bff139a86daacf47da",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // ✅ Initialize Firebase Auth
const db = getFirestore(app); // ✅ Initialize Firestore

// Fetch ride history for all approved users
const getRideHistory = async () => {
  const rideHistoryData = [];
  try {
    // Get all approved users
    const approvedUsersSnapshot = await getDocs(collection(db, "approved_users"));

    // Loop through each approved user document
    for (const userDoc of approvedUsersSnapshot.docs) {
      const userData = userDoc.data();

      // Fetch the rideHistory sub-collection for each user
      const rideHistorySnapshot = await getDocs(collection(userDoc.ref, "rideHistory"));
      
      // Loop through each ride in the rideHistory sub-collection
      for (const rideDoc of rideHistorySnapshot.docs) {
        const rideData = rideDoc.data();

        // Ensure ride data has the necessary fields
        if (rideData?.timestamp && typeof rideData.amountPaid === "number") {
          const ride = {
            id: rideDoc.id, // Use document ID as ride ID
            amountPaid: rideData.amountPaid,
            timestamp: rideData.timestamp.toDate(), // Convert timestamp to a JavaScript Date object
          };
          rideHistoryData.push(ride); // Add ride data to array
        } else {
          console.warn(`Ride data missing required fields (rideId: ${rideDoc.id})`);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching ride history:", error.message);
  }
  return rideHistoryData;
};

// Export functions for use elsewhere in your application
export { auth, db, signInWithEmailAndPassword, getRideHistory }; // ✅ Ensure getRideHistory is exported
