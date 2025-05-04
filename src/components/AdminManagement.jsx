import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  // remove onSnapshot
} from "firebase/firestore";
import axios from "axios";
import Layout from "./Layout";
import ContentHeader from "./ContentHeader";
import "../styles/AdminManagement.css";
import { FaPlus, FaEdit, FaTrashAlt } from "react-icons/fa";

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

  useEffect(() => {
    fetchAdmins();
  }, []);

  // Update the fetchAdmins function to also fetch stations and combine the data
  const fetchAdmins = async () => {
    try {
      // First fetch stations
      const stationsSnapshot = await getDocs(collection(db, "stations"));
      const stationsMap = {};
      stationsSnapshot.docs.forEach((doc) => {
        stationsMap[doc.id] = {
          stationName: doc.data().stationName,
          stationAddress: doc.data().stationAddress,
        };
      });
      setStations(stationsMap);

      // Then fetch admins
      const adminsSnapshot = await getDocs(collection(db, "admins"));
      const allAdmins = adminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        stationDetails: doc.data().stationAssignedTo
          ? stationsMap[doc.data().stationAssignedTo]
          : null,
      }));
      setAdmins(allAdmins);
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const handleUpdateAdminRole = async (adminId, newRole) => {
    try {
      const adminRef = doc(db, "admins", adminId);
      await updateDoc(adminRef, { roles: [newRole] });
      // Remove the fetchAdmins() call since updates are automatic
      alert("Role updated successfully!");
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update admin role. Please try again.");
    }
  };

  // Add this new function to handle role editing
  const handleEditRole = (adminId, currentRole) => {
    setEditingRole({
      adminId,
      role: currentRole || "station_manager",
    });
  };

  // Add this function to handle role save
  const handleSaveRole = async () => {
    try {
      await handleUpdateAdminRole(editingRole.adminId, editingRole.role);
      setEditingRole({ adminId: null, role: "" });
    } catch (error) {
      console.error("Error saving role:", error);
    }
  };

  // Upload profile photo to AWS S3
  const uploadProfilePhotoToAWS = async (file) => {
    const formData = new FormData();
    formData.append("profilePhoto", file);

    try {
      const response = await axios.post(
        "http://192.168.6.200:4000/api/upload-profile-photo", // Replace with your AWS endpoint
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return response.data.profilePhotoUrl;
    } catch (error) {
      console.error("Error uploading to AWS:", error);
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

    let uploadedImageUrl = "";
    if (profileImage) {
      uploadedImageUrl = await uploadProfilePhotoToAWS(profileImage);
      if (!uploadedImageUrl) {
        alert("Failed to upload profile image.");
        return;
      }
    }

    try {
      const response = await axios.post(
        "http://localhost:4001/api/create-admin",
        {
          name,
          email,
          password,
          roles: [], // Send selected role as an array
          profilePhoto: uploadedImageUrl || "",
          status: "Active",
          stationAssignedTo: null,
        }
      );

      if (response.data.success) {
        alert("Admin added successfully!");
        setName("");
        setEmail("");
        setPassword("");
        setProfileImage(null);
        setImageUrl("");
        setShowModal(false);
      } else {
        alert("Error: " + response.data.message);
      }
    } catch (error) {
      console.error("Error creating admin:", error);
      alert("There was an error creating the admin. Please try again.");
    }
  };

  // Handle delete admin
  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm("Are you sure you want to delete this admin?")) return;

    try {
      await deleteDoc(doc(db, "admins", adminId));
      // Remove the fetchAdmins() call since updates are automatic
    } catch (error) {
      console.error("Error deleting admin:", error);
    }
  };

  // Toggle the admin's status
  const handleToggleStatus = async (adminId, currentStatus) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";

    try {
      const adminRef = doc(db, "admins", adminId);
      await updateDoc(adminRef, { status: newStatus });
      // Manually fetch admins after update
      await fetchAdmins();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update admin status. Please try again.");
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

    // Upload new image to AWS S3
    const uploadedImageUrl = await uploadProfilePhotoToAWS(editProfileImage);
    if (!uploadedImageUrl) {
      alert("Failed to upload new profile image.");
      return;
    }

    try {
      // Update Firestore document for this admin
      const adminRef = doc(db, "admins", editingAdmin.id);
      await updateDoc(adminRef, { profilePhoto: uploadedImageUrl });
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
                <div className="admin-photo">
                  <div className="status-dot-container">
                    <span
                      className={`status-dot ${
                        admin.status === "Active" ? "active" : "inactive"
                      }`}
                    />
                    <div className="status-tooltip">Status: {admin.status}</div>
                  </div>
                  {admin.profilePhoto ? (
                    <img src={admin.profilePhoto} alt="Admin" />
                  ) : (
                    <div className="placeholder">No Image</div>
                  )}
                </div>
                <div className="admin-info">
                  <h4>{admin.name}</h4>
                  <p>{admin.email}</p>
                  <p className="role-text">
                    Role: {admin.roles?.[0] || "Unassigned"}
                  </p>
                  <p className="station-text">
                    {admin.stationAssignedTo ? (
                      <span className="station-assigned">
                        Station:
                        {admin.stationDetails?.stationName || "Loading..."}
                      </span>
                    ) : (
                      <span className="station-unassigned">
                        📍 No Station Assigned
                      </span>
                    )}
                  </p>
                </div>
                <div className="admin-actions">
                  <button
                    className="edit-btn"
                    onClick={() => handleOpenEditModal(admin)}
                  >
                    <FaEdit />
                  </button>

                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteAdmin(admin.id)}
                  >
                    <FaTrashAlt />
                  </button>
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
      </div>
    </Layout>
  );
};

export default AdminManagement;
