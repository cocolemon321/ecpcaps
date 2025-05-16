import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  onSnapshot,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import Layout from "./Layout";
import ContentHeader from "./ContentHeader";
import "../styles/AdminManagement.css";
import {
  FaPlus,
  FaEdit,
  FaTrashAlt,
  FaPencilAlt,
  FaCamera,
  FaUserTag,
  FaUserTimes,
} from "react-icons/fa";
import dayjs from "dayjs";
import { logAdminAction } from "../utils/logAdminAction";

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState("station_manager");

  // State for editing admin's photo
  const [isEditing, setIsEditing] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [editProfileImage, setEditProfileImage] = useState(null);

  // Add this new state for role editing
  const [editingRole, setEditingRole] = useState({ adminId: null, role: "" });

  // First, add a new state for stations
  const [stations, setStations] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    onBreak: 0,
  });

  // Add new state for dropdown
  const [showOptions, setShowOptions] = useState(null);

  // Keep the ADMIN_STATUSES constant for reference:
  const ADMIN_STATUSES = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    ON_BREAK: "On Break",
  };

  // Keep the STATUS_COLORS for styling reference:
  const STATUS_COLORS = {
    Active: "#4CAF50", // Green
    Inactive: "#F44336", // Red
    "On Break": "#FFC107", // Yellow/Amber
  };

  // Update the calculateStats function
  const calculateStats = (adminsList) => {
    const stats = {
      total: adminsList.length,
      active: 0,
      inactive: 0,
      onBreak: 0,
    };

    adminsList.forEach((admin) => {
      switch (admin.status) {
        case ADMIN_STATUSES.ACTIVE:
          stats.active++;
          break;
        case ADMIN_STATUSES.INACTIVE:
          stats.inactive++;
          break;
        case ADMIN_STATUSES.ON_BREAK:
          stats.onBreak++;
          break;
        default:
          stats.inactive++; // Default to inactive if status is undefined
          break;
      }
    });

    return stats;
  };

  useEffect(() => {
    // First fetch stations
    const fetchStations = async () => {
      const stationsSnapshot = await getDocs(collection(db, "stations"));
      const stationsMap = {};
      stationsSnapshot.docs.forEach((doc) => {
        stationsMap[doc.id] = {
          stationName: doc.data().stationName,
          stationAddress: doc.data().stationAddress,
        };
      });
      setStations(stationsMap);
      return stationsMap;
    };

    // Set up real-time listener for admins
    const setupAdminsListener = (stationsMap) => {
      const adminsRef = collection(db, "admins");
      return onSnapshot(adminsRef, (snapshot) => {
        const allAdmins = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          stationDetails: doc.data().stationAssignedTo
            ? stationsMap[doc.data().stationAssignedTo]
            : null,
        }));
        setAdmins(allAdmins);
        setStats(calculateStats(allAdmins));
      });
    };

    // Initialize everything
    fetchStations().then((stationsMap) => {
      const unsubscribe = setupAdminsListener(stationsMap);
      return () => unsubscribe(); // Cleanup on component unmount
    });
  }, []);

  // Update the role update function
  const handleUpdateAdminRole = async (adminId, newRole) => {
    try {
      const adminRef = doc(db, "admins", adminId);
      await updateDoc(adminRef, {
        roles: [newRole],
        updatedAt: new Date(),
      });

      // Fetch admin name for logging
      const adminDoc = await getDoc(adminRef);
      const adminName = adminDoc.exists() ? adminDoc.data().name : adminId;

      await logAdminAction({
        actionType: "UPDATE_ROLE",
        details: `Updated role for admin: ${adminName} to ${newRole}`,
        targetCollection: "admins",
        targetId: adminId,
      });

      alert("Role updated successfully!");
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update admin role. Please try again.");
    }
  };

  // Update the role edit function
  const handleEditRole = (adminId, currentRole) => {
    setEditingRole({
      adminId,
      role: currentRole || "Station Manager", // Set default role if none exists
    });
  };

  // Update the role save function
  const handleSaveRole = async () => {
    if (!editingRole.adminId || !editingRole.role) {
      alert("Please select a role");
      return;
    }

    try {
      await handleUpdateAdminRole(editingRole.adminId, editingRole.role);
      // Reset editing state
      setEditingRole({ adminId: null, role: "" });
    } catch (error) {
      console.error("Error saving role:", error);
      alert("Failed to save role changes");
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          const maxDimension = 800; // Maximum dimension for the image

          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob with 60% quality
          canvas.toBlob(
            (blob) => {
              resolve(blob);
            },
            "image/jpeg",
            0.6
          );
        };
      };
    });
  };

  const uploadProfilePhoto = async (file) => {
    if (!file) return null;

    try {
      // Compress the image
      const compressedBlob = await compressImage(file);

      // Create a unique filename
      const filename = `admin_profiles/${Date.now()}_${file.name}`;

      // Get Firebase Storage reference
      const storage = getStorage();
      const storageRef = ref(storage, filename);

      // Upload the compressed image
      await uploadBytes(storageRef, compressedBlob);

      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  // Handle Create Admin
  const handleCreateAdmin = async (e) => {
    e.preventDefault();

    if (!name || !email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      // First create the user in Firebase Authentication
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Upload profile photo if exists
      let uploadedImageUrl = "";
      if (profileImage) {
        uploadedImageUrl = await uploadProfilePhoto(profileImage);
        if (!uploadedImageUrl) {
          alert("Failed to upload profile image.");
          return;
        }
      }

      // Create the admin document in Firestore
      const adminData = {
        uid: user.uid,
        name,
        email,
        roles: [selectedRole],
        profilePhoto: uploadedImageUrl || "",
        status: "Active",
        stationAssignedTo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(collection(db, "admins"), adminData);
      await logAdminAction({
        actionType: "CREATE_ADMIN",
        details: `Created admin: ${adminData.name}`,
        targetCollection: "admins",
        targetId: docRef.id,
      });

      alert("Admin added successfully!");
      setName("");
      setEmail("");
      setPassword("");
      setProfileImage(null);
      setImageUrl("");
      setShowModal(false);
    } catch (error) {
      console.error("Error creating admin:", error);
      alert(
        error.message ||
          "There was an error creating the admin. Please try again."
      );
    }
  };

  // Replace handleDeleteAdmin with handleDeactivateAdmin
  const handleDeactivateAdmin = async (adminId) => {
    if (!window.confirm("Are you sure you want to deactivate this admin?"))
      return;

    try {
      const adminRef = doc(db, "admins", adminId);
      await updateDoc(adminRef, {
        isDeactivated: true,
        status: "Inactive",
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      });
      // Fetch admin name for logging
      const adminDoc = await getDoc(adminRef);
      const adminName = adminDoc.exists() ? adminDoc.data().name : adminId;
      await logAdminAction({
        actionType: "DEACTIVATE_ADMIN",
        details: `Deactivated admin: ${adminName}`,
        targetCollection: "admins",
        targetId: adminId,
      });
      alert("Admin account has been deactivated");
    } catch (error) {
      console.error("Error deactivating admin:", error);
      alert("Failed to deactivate admin account");
    }
  };

  // Open the edit modal for a specific admin
  const handleOpenEditModal = (admin) => {
    setEditingAdmin(admin);
    setIsEditing(true);
    setEditProfileImage(null);
    setSelectedRole(admin.roles[0]); // Reset any previously selected file
  };

  // Handle updating the admin's profile photo
  const handleUpdateAdminPhoto = async (e) => {
    e.preventDefault();

    if (!editProfileImage) {
      alert("Please select a new profile image.");
      return;
    }

    // Upload new image to Firebase Storage
    const uploadedImageUrl = await uploadProfilePhoto(editProfileImage);
    if (!uploadedImageUrl) {
      alert("Failed to upload new profile image.");
      return;
    }

    try {
      // Update Firestore document for this admin
      const adminRef = doc(db, "admins", editingAdmin.id);
      await updateDoc(adminRef, { profilePhoto: uploadedImageUrl });
      // Fetch admin name for logging
      const adminDoc = await getDoc(adminRef);
      const adminName = adminDoc.exists()
        ? adminDoc.data().name
        : editingAdmin.id;
      await logAdminAction({
        actionType: "UPDATE_PROFILE_PHOTO",
        details: `Updated profile photo for admin: ${adminName}`,
        targetCollection: "admins",
        targetId: editingAdmin.id,
      });
      alert("Profile photo updated successfully!");
      // Close the edit modal
      setIsEditing(false);
      setEditingAdmin(null);
      setEditProfileImage(null);
    } catch (error) {
      console.error("Error updating admin profile photo:", error);
      alert("Failed to update admin profile photo. Please try again.");
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingAdmin(null);
    setEditProfileImage(null);
  };

  return (
    <Layout>
      <ContentHeader title="Admin Management" />
      <div className="admin-management-container">
        {/* Add Stats Cards */}
        <div className="stats-container">
          <div className="stat-card">
            <h3>Total Admins</h3>
            <p>{stats.total}</p>
          </div>
          <div className="stat-card active">
            <h3>Active</h3>
            <p>{stats.active}</p>
          </div>
          <div className="stat-card break">
            <h3>On Break</h3>
            <p>{stats.onBreak}</p>
          </div>
          <div className="stat-card inactive">
            <h3>Inactive</h3>
            <p>{stats.inactive}</p>
          </div>
        </div>

        <div className="admin-management-header">
          <h2>Admin Creation</h2>
          <button
            className="btn-create-admin"
            onClick={() => setShowModal(true)}
          >
            <FaPlus /> Create New Admin Account
          </button>
        </div>

        {/* Admin Gallery (Grid View) */}
        <div className="admin-gallery">
          {admins.length > 0 ? (
            admins.map((admin) => (
              <div key={admin.id} className="admin-card">
                {/* Move edit container before admin photo */}
                <div className="edit-container">
                  <button
                    className="edit-toggle"
                    onClick={() =>
                      setShowOptions(showOptions === admin.id ? null : admin.id)
                    }
                  >
                    <FaPencilAlt />
                  </button>

                  {showOptions === admin.id && (
                    <div className="edit-options">
                      <button
                        onClick={() => {
                          handleOpenEditModal(admin);
                          setShowOptions(null);
                        }}
                      >
                        <FaCamera /> Change Photo
                      </button>
                      <button
                        onClick={() => {
                          handleEditRole(admin.id, admin.roles?.[0]);
                          setShowOptions(null);
                        }}
                      >
                        <FaUserTag /> Change Role
                      </button>
                      <button
                        onClick={() => {
                          handleDeactivateAdmin(admin.id);
                          setShowOptions(null);
                        }}
                        className="deactivate-btn"
                      >
                        <FaUserTimes /> Deactivate Admin
                      </button>
                    </div>
                  )}
                </div>

                {/* Admin photo section */}
                <div className="admin-photo">
                  <div className="status-dot-container">
                    <span
                      className={`status-dot ${admin.status?.toLowerCase()}`}
                      style={{
                        backgroundColor:
                          STATUS_COLORS[admin.status] || STATUS_COLORS.Inactive,
                      }}
                    />
                    <div className="status-tooltip">
                      {admin.status || "Inactive"} • Last updated:{" "}
                      {admin.statusUpdatedAt
                        ? dayjs(admin.statusUpdatedAt.toDate()).format(
                            "MMM D, HH:mm"
                          )
                        : "Not available"}
                    </div>
                  </div>
                  {admin.profilePhoto ? (
                    <img src={admin.profilePhoto} alt="Admin" />
                  ) : (
                    <div className="placeholder">No Image</div>
                  )}
                </div>

                {/* Admin info section */}
                <div className="admin-info">
                  <h4>{admin.name}</h4>
                  <p>{admin.email}</p>
                  <div className="role-badge">
                    {admin.roles?.[0] || "No Role"}
                  </div>
                  <div className="station-info">
                    {admin.stationDetails ? (
                      <span className="station-name">
                        📍 {admin.stationDetails.stationName}
                      </span>
                    ) : (
                      <span className="no-station">No Station Assigned</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>No admins found</p>
          )}
        </div>

        {/* Create Admin Modal */}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Create Admin Account</h3>
              <form onSubmit={handleCreateAdmin}>
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role:</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)} // Capture the role selection
                  >
                    <option value="Station Manager">Station Manager</option>
                    <option value="User Support">User Support</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password:</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Profile Picture:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setProfileImage(e.target.files[0])}
                  />
                </div>
                {profileImage && (
                  <div className="preview-image">
                    <img
                      src={URL.createObjectURL(profileImage)}
                      alt="Preview"
                    />
                  </div>
                )}
                <button type="submit" className="btn-create">
                  Create
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Admin Photo Modal */}
        {isEditing && editingAdmin && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Edit Profile Photo for {editingAdmin.name}</h3>
              <form onSubmit={handleUpdateAdminPhoto}>
                <div className="form-group">
                  <label>New Profile Picture:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditProfileImage(e.target.files[0])}
                  />
                </div>
                {editProfileImage && (
                  <div className="preview-image">
                    <img
                      src={URL.createObjectURL(editProfileImage)}
                      alt="Preview"
                    />
                  </div>
                )}
                <button type="submit" className="btn-update">
                  Update Photo
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Admin Role Modal */}
        {editingRole.adminId && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Change Admin Role</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveRole();
                }}
              >
                <div className="form-group">
                  <label>Select Role:</label>
                  <select
                    value={editingRole.role}
                    onChange={(e) =>
                      setEditingRole({
                        ...editingRole,
                        role: e.target.value,
                      })
                    }
                  >
                    <option value="Station Manager">Station Manager</option>
                    <option value="User Support">User Support</option>
                  </select>
                </div>
                <div className="button-group">
                  <button type="submit" className="btn-update">
                    Save Role
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setEditingRole({ adminId: null, role: "" })}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminManagement;
