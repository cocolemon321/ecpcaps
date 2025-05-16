import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getAuth } from "firebase/auth";

export const logAdminAction = async (params) => {
  console.log("logAdminAction called with:", params); // DEBUG LOG
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    let adminId = null;
    let adminName = null;
    if (user) {
      adminId = user.uid;
      // Fetch super admin name from super_admins collection
      const superAdminDoc = await getDoc(doc(db, "super_admins", user.uid));
      if (superAdminDoc.exists()) {
        adminName = superAdminDoc.data().name;
      }
    }
    await addDoc(collection(db, "admin_logs"), {
      timestamp: serverTimestamp(),
      adminId,
      adminName,
      actionType: params.actionType,
      details: params.details,
      targetCollection: params.targetCollection || null,
      targetId: params.targetId || null,
    });
    console.log("Log written to Firestore"); // DEBUG LOG
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}; 