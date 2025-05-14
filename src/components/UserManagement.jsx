import React, { useEffect, useState, useMemo } from "react";
import { auth, db } from "../firebase"; // Firestore & Authentication instance
import rawAddresses from "../assets/raw_addresses.json";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import Layout from "./Layout";
import ContentHeader from "./ContentHeader";
import "../styles/UserManagement.css";
import { FaCheck, FaTimes, FaClock } from "react-icons/fa";
import dayjs from "dayjs";

// Add this helper function at the top level
const isValidAddress = (address) => {
  return rawAddresses.some((item) =>
    item["Raw Address"].toLowerCase().includes(address.toLowerCase())
  );
};

const UserManagement = () => {
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [registeredUsersSearch, setRegisteredUsersSearch] = useState("");
  const [registeredUsersPage, setRegisteredUsersPage] = useState(1);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingUsersSearch, setPendingUsersSearch] = useState("");
  const [pendingUsersPage, setPendingUsersPage] = useState(1);
  const [stats, setStats] = useState({
    registered: 0,
    pending: 0,
    rejected: 0,
    total: 0,
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [flaggedUsers, setFlaggedUsers] = useState([]);
  const [flaggedUsersSearch, setFlaggedUsersSearch] = useState("");
  const [selectedReports, setSelectedReports] = useState(null);
  const itemsPerPage = 5; // Users per page

  useEffect(() => {
    fetchRegisteredUsers();
    fetchPendingUsers();
    fetchFlaggedUsers();
  }, []);

  // Fetch registered (approved) users from Firestore
  const fetchRegisteredUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "approved_users"));
      const usersList = querySnapshot.docs.map((doc) => ({
        uid: doc.id, // This is the user's UID
        ...doc.data(),
      }));
      setRegisteredUsers(usersList);
    } catch (error) {
      console.error("Error fetching registered users:", error);
    }
  };

  // Update the fetchPendingUsers function
  const fetchPendingUsers = async () => {
    try {
      // Get both pending_users and approved_users with isPending=true
      const [pendingSnapshot, approvedSnapshot] = await Promise.all([
        getDocs(collection(db, "pending_users")),
        getDocs(
          query(
            collection(db, "approved_users"),
            where("isPending", "==", true)
          )
        ),
      ]);

      const pendingUsers = pendingSnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));

      const pendingApprovedUsers = approvedSnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));

      setPendingUsers([...pendingUsers, ...pendingApprovedUsers]);
    } catch (error) {
      console.error("Error fetching pending users:", error);
    }
  };

  // Update the fetchFlaggedUsers function
  const fetchFlaggedUsers = async () => {
    try {
      // First fetch all admins
      const adminsSnapshot = await getDocs(collection(db, "admins"));
      const adminsMap = new Map();
      adminsSnapshot.docs.forEach((doc) => {
        const adminData = doc.data();
        // Store the admin data using their uid as key
        adminsMap.set(adminData.uid, {
          name: adminData.name,
          role: adminData.roles?.[0] || "Admin",
        });
      });

      // Then fetch reports
      const querySnapshot = await getDocs(collection(db, "user_reports"));
      const reports = querySnapshot.docs.map((doc) => {
        const reportData = doc.data();
        const adminInfo = adminsMap.get(reportData.reportedBy);

        return {
          id: doc.id,
          ...reportData,
          reportedByName: adminInfo
            ? `${adminInfo.name} (${adminInfo.role})`
            : "Unknown Admin",
          timestamp: reportData.createdAt?.toDate
            ? reportData.createdAt.toDate()
            : new Date(reportData.createdAt?.seconds * 1000),
          violationType: reportData.violationType || "Not Specified",
          details: reportData.details || "No details provided",
        };
      });

      const uniqueUserIds = [
        ...new Set(reports.map((report) => report.userId)),
      ];

      const flaggedUsersData = await Promise.all(
        uniqueUserIds.map(async (userId) => {
          const userDoc = await getDoc(doc(db, "approved_users", userId));
          const userData = userDoc.data();
          const userReports = reports.filter(
            (report) => report.userId === userId
          );

          return {
            uid: userId,
            ...userData,
            reports: userReports.map((report) => ({
              ...report,
              reportedBy: report.reportedByName,
              timestamp: report.timestamp,
              violationType: report.violationType,
              details: report.details,
            })),
            isBanned: userData?.isBanned || false,
          };
        })
      );

      setFlaggedUsers(flaggedUsersData);
    } catch (error) {
      console.error("Error fetching flagged users:", error);
    }
  };

  // Handle user actions (approve/reject)
  const handleUserAction = async (userId, action) => {
    try {
      const userRef = doc(db, "pending_users", userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();

      // Check if address is valid before approving
      if (action === "approve") {
        const addressValid = isValidAddress(userData.address);

        if (!addressValid) {
          if (
            !window.confirm(
              "This address is not in the validated list. Are you sure you want to approve this user?"
            )
          ) {
            return;
          }
        }

        // Move to approved_users collection
        await addDoc(collection(db, "approved_users"), {
          ...userData,
          status: "approved",
          approvedAt: new Date(),
          addressValidated: addressValid,
        });

        // Delete from pending
        await deleteDoc(userRef);
      } else if (action === "reject") {
        // Update status to rejected
        await updateDoc(userRef, {
          status: "rejected",
          rejectedAt: new Date(),
        });
      }

      // Refresh lists
      fetchRegisteredUsers();
      fetchPendingUsers();
    } catch (error) {
      console.error("Error processing user action:", error);
    }
  };

  const handleBanUser = async (userId, isBanned) => {
    try {
      const userRef = doc(db, "approved_users", userId);
      await updateDoc(userRef, {
        isBanned: isBanned,
        bannedAt: isBanned ? new Date() : null,
      });

      // Add notification for the user
      await addDoc(collection(db, "user_notifications"), {
        userId: userId,
        type: isBanned ? "account_banned" : "account_unbanned",
        title: isBanned ? "Account Banned" : "Account Reinstated",
        message: isBanned
          ? "Your account has been banned due to violations."
          : "Your account has been reinstated.",
        createdAt: new Date(),
        isRead: false,
      });

      // Refresh user lists
      fetchFlaggedUsers();
      fetchRegisteredUsers();
    } catch (error) {
      console.error("Error updating user ban status:", error);
    }
  };

  const handleViewReports = (user) => {
    setSelectedReports({
      userName: `${user.first_name} ${user.middle_name} ${user.surname}`,
      reports: user.reports.map((report) => {
        // Check if timestamp is already a Date object
        const timestamp =
          report.timestamp instanceof Date
            ? report.timestamp
            : report.timestamp?.toDate
            ? report.timestamp.toDate()
            : new Date(report.timestamp?.seconds * 1000);

        return {
          ...report,
          timestamp: timestamp,
        };
      }),
    });
  };

  const closeReportsModal = () => {
    setSelectedReports(null);
  };

  // Filter registered users based on search input
  const filteredRegisteredUsers = useMemo(() => {
    return registeredUsers.filter((user) =>
      `${user.first_name} ${user.middle_name} ${user.surname} ${user.email}`
        .toLowerCase()
        .includes(registeredUsersSearch.toLowerCase())
    );
  }, [registeredUsers, registeredUsersSearch]);

  // Pagination logic for registered users
  const totalRegisteredPages = Math.ceil(
    filteredRegisteredUsers.length / itemsPerPage
  );
  const paginatedRegisteredUsers = useMemo(() => {
    const startIndex = (registeredUsersPage - 1) * itemsPerPage;
    return filteredRegisteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRegisteredUsers, registeredUsersPage]);

  // Filter pending users based on search input
  const filteredPendingUsers = useMemo(() => {
    return pendingUsers.filter((user) =>
      `${user.first_name} ${user.middle_name} ${user.surname} ${user.email}`
        .toLowerCase()
        .includes(pendingUsersSearch.toLowerCase())
    );
  }, [pendingUsers, pendingUsersSearch]);

  // Add stat calculation effect
  useEffect(() => {
    const calculateStats = () => {
      setStats({
        registered: registeredUsers.length,
        pending: pendingUsers.length,
        rejected: pendingUsers.filter((user) => user.status === "rejected")
          .length,
        total: registeredUsers.length + pendingUsers.length,
      });
    };
    calculateStats();
  }, [registeredUsers, pendingUsers]);

  // Update the StatusIndicator component
  const StatusIndicator = ({ status, addressValidated, isPending }) => {
    if (status === "approved") {
      return (
        <div className="status-container">
          <FaCheck className="status-icon approved" title="Approved" />
          {/* Only show warning if isPending is true */}
          {isPending && !addressValidated && (
            <span
              className="warning-text"
              title="Address not in validated list"
            >
              ⚠️
            </span>
          )}
        </div>
      );
    } else if (status === "pending") {
      return <FaClock className="status-icon pending" title="Pending" />;
    }
    return null;
  };

  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  return (
    <Layout>
      <ContentHeader title="User Management" />

      {/* Add Image Modal */}
      {selectedImage && (
        <div className="image-modal" onClick={closeImageModal}>
          <img
            src={selectedImage}
            alt="Profile"
            className="modal-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Update the reports modal display */}
      {selectedReports && (
        <div className="modal-overlay" onClick={closeReportsModal}>
          <div
            className="modal-content reports-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Reports for {selectedReports.userName}</h3>
            <div className="reports-list">
              {selectedReports.reports.map((report, index) => (
                <div key={index} className="report-item">
                  <p className="report-date">
                    {dayjs(report.timestamp).isValid()
                      ? dayjs(report.timestamp).format("MMM D, YYYY HH:mm")
                      : "Date not available"}
                  </p>
                  <p className="report-violation">
                    <strong>Violation Type:</strong> {report.violationType}
                  </p>
                  <p className="report-details">
                    <strong>Details:</strong> {report.details}
                  </p>
                  <p className="report-status">
                    <strong>Status:</strong> {report.status}
                  </p>
                  <p className="report-reporter">
                    <strong>Reported by:</strong> {report.reportedBy}
                  </p>
                </div>
              ))}
            </div>
            <button className="close-btn" onClick={closeReportsModal}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className="user-management">
        {/* Stats Cards */}
        <div className="stats-container">
          <div className="stat-card">
            <h3>Registered Users</h3>
            <p>{stats.registered}</p>
          </div>
          <div className="stat-card">
            <h3>Pending Users</h3>
            <p>{stats.pending}</p>
          </div>
          <div className="stat-card">
            <h3>Rejected Users</h3>
            <p>{stats.rejected}</p>
          </div>
          <div className="stat-card total">
            <h3>Total Users</h3>
            <p>{stats.total}</p>
          </div>
        </div>

        {/* Pending Users Section */}
        <div className="section">
          <h2>Pending Users</h2>
          <input
            type="text"
            placeholder="🔍 Search pending users..."
            value={pendingUsersSearch}
            onChange={(e) => setPendingUsersSearch(e.target.value)}
            className="search-box"
          />
          {filteredPendingUsers.length === 0 ? (
            <p>No pending users found.</p>
          ) : (
            <div className="user-list">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Profile Photo</th>
                    <th>ID Photos</th>
                    <th>Name</th>
                    <th>Contact Info</th>
                    <th>Address</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPendingUsers.map((user) => (
                    <tr key={user.uid}>
                      <td>
                        <StatusIndicator
                          status={user.status}
                          addressValidated={user.addressValidated}
                        />
                      </td>
                      <td className="profile-column">
                        {user.profile_photo_url ? (
                          <img
                            src={user.profile_photo_url}
                            alt="Profile"
                            className="profile-thumbnail"
                            onClick={() =>
                              openImageModal(user.profile_photo_url)
                            }
                          />
                        ) : (
                          <div className="no-photo">No Photo</div>
                        )}
                      </td>
                      <td className="id-photos-column">
                        <div className="id-photos">
                          {user.frontIdUrl && (
                            <img
                              src={user.frontIdUrl}
                              alt="ID Front"
                              className="id-thumbnail"
                              onClick={() => openImageModal(user.frontIdUrl)}
                            />
                          )}
                          {user.backIdUrl && (
                            <img
                              src={user.backIdUrl}
                              alt="ID Back"
                              className="id-thumbnail"
                              onClick={() => openImageModal(user.backIdUrl)}
                            />
                          )}
                        </div>
                      </td>
                      <td>{`${user.first_name} ${user.middle_name} ${user.surname}`}</td>
                      <td>
                        <div className="contact-info">
                          <p>
                            <strong>Phone:</strong> {user.phone_number}
                          </p>
                          <p>
                            <strong>Email:</strong> {user.email}
                          </p>
                          <p>
                            <strong>ID Number:</strong> {user.id_number}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="address-info">
                          <p>{user.address}</p>
                          {!user.addressValidated && (
                            <span className="unvalidated-address">
                              ⚠️ Address not in validated list
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="action-buttons">
                        <button
                          onClick={() => handleUserAction(user.uid, "approve")}
                          className="approve-btn"
                        >
                          <FaCheck /> Approve
                        </button>
                        <button
                          onClick={() => handleUserAction(user.uid, "reject")}
                          className="reject-btn"
                        >
                          <FaTimes /> Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Flagged Users Section */}
        <div className="section">
          <h2>Flagged Users</h2>
          <input
            type="text"
            placeholder="🔍 Search flagged users..."
            value={flaggedUsersSearch}
            onChange={(e) => setFlaggedUsersSearch(e.target.value)}
            className="search-box"
          />
          {flaggedUsers.length === 0 ? (
            <p>No flagged users found.</p>
          ) : (
            <div className="user-list">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th className="profile-column">Profile Photo</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Reports</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedUsers
                    .filter((user) =>
                      `${user.first_name} ${user.middle_name} ${user.surname} ${user.email}`
                        .toLowerCase()
                        .includes(flaggedUsersSearch.toLowerCase())
                    )
                    .map((user) => (
                      <tr key={user.uid}>
                        <td>
                          {user.isBanned ? (
                            <span className="banned-badge">Banned</span>
                          ) : (
                            <span className="flagged-badge">Flagged</span>
                          )}
                        </td>
                        <td className="profile-column">
                          {user.profile_photo_url ? (
                            <img
                              src={user.profile_photo_url}
                              alt="Profile"
                              className="profile-thumbnail"
                              onClick={() =>
                                openImageModal(user.profile_photo_url)
                              }
                            />
                          ) : (
                            <div className="no-photo">No Photo</div>
                          )}
                        </td>
                        <td>{`${user.first_name} ${user.middle_name} ${user.surname}`}</td>
                        <td>{user.email}</td>
                        <td>
                          <button
                            className="view-reports-btn"
                            onClick={() => handleViewReports(user)}
                          >
                            View Reports ({user.reports.length})
                          </button>
                        </td>
                        <td>
                          <button
                            className={user.isBanned ? "unban-btn" : "ban-btn"}
                            onClick={() =>
                              handleBanUser(user.uid, !user.isBanned)
                            }
                          >
                            {user.isBanned ? "Unban User" : "Ban User"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Registered Users Section */}
        <div className="section">
          <h2>Registered Users</h2>
          <input
            type="text"
            placeholder="🔍 Search registered users..."
            value={registeredUsersSearch}
            onChange={(e) => setRegisteredUsersSearch(e.target.value)}
            className="search-box"
          />
          {filteredRegisteredUsers.length === 0 ? (
            <p>No registered users found.</p>
          ) : (
            <div className="user-list">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Profile Photo</th>
                    <th>ID Photos</th>
                    <th>Name</th>
                    <th>Contact Info</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRegisteredUsers.map((user) => (
                    <tr key={user.uid}>
                      <td>
                        <StatusIndicator
                          status={user.status}
                          addressValidated={user.addressValidated}
                          isPending={user.isPending || false}
                        />
                      </td>
                      <td className="profile-column">
                        {user.profile_photo_url ? (
                          <img
                            src={user.profile_photo_url}
                            alt="Profile"
                            className="profile-thumbnail"
                            onClick={() =>
                              openImageModal(user.profile_photo_url)
                            }
                          />
                        ) : (
                          <div className="no-photo">No Photo</div>
                        )}
                      </td>
                      <td className="id-photos-column">
                        <div className="id-photos">
                          {user.frontIdUrl && (
                            <img
                              src={user.frontIdUrl}
                              alt="ID Front"
                              className="id-thumbnail"
                              onClick={() => openImageModal(user.frontIdUrl)}
                            />
                          )}
                          {user.backIdUrl && (
                            <img
                              src={user.backIdUrl}
                              alt="ID Back"
                              className="id-thumbnail"
                              onClick={() => openImageModal(user.backIdUrl)}
                            />
                          )}
                        </div>
                      </td>
                      <td>{`${user.first_name} ${user.middle_name} ${user.surname}`}</td>
                      <td>
                        <div className="contact-info">
                          <p>
                            <strong>Phone:</strong> {user.phone_number}
                          </p>
                          <p>
                            <strong>Email:</strong> {user.email}
                          </p>
                          <p>
                            <strong>ID Number:</strong> {user.id_number}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="address-info">
                          <p>{user.address}</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              <div className="pagination">
                <button
                  disabled={registeredUsersPage === 1}
                  onClick={() =>
                    setRegisteredUsersPage(registeredUsersPage - 1)
                  }
                >
                  Previous
                </button>
                {Array.from({ length: totalRegisteredPages }, (_, index) => (
                  <button
                    key={index}
                    className={
                      registeredUsersPage === index + 1 ? "active" : ""
                    }
                    onClick={() => setRegisteredUsersPage(index + 1)}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  disabled={registeredUsersPage === totalRegisteredPages}
                  onClick={() =>
                    setRegisteredUsersPage(registeredUsersPage + 1)
                  }
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UserManagement;
