// server.js
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

// Load your service account key JSON file
const serviceAccount = require("./secretkey.json");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

const app = express();

// Use JSON middleware and enable CORS if needed
app.use(express.json());
app.use(cors());

// Endpoint for creating a new admin
app.post("/api/create-admin", async (req, res) => {
  // TODO: Add your own authentication/authorization check here to ensure only super admins can call this endpoint.
  const { name, email, password, profilePhoto, stationAssignedTo, roles } = req.body;

  // Validate required fields
  if (!name || !email || !password || !roles) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  try {
    // Create a new user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Add admin data to Firestore including the Auth UID and roles
    await db.collection("admins").add({
      uid: userRecord.uid,
      name,
      email,
      profilePhoto: profilePhoto || "",
      status: "Active",
      stationAssignedTo: stationAssignedTo || null,
      roles: roles,  // Save the roles in Firestore
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error("Error creating admin:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// Start the server on port 4000 (or the port defined in process.env.PORT)
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
