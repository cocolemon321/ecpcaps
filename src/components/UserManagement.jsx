import React, { useEffect, useState, useMemo } from "react";
import { auth, db } from "../firebase"; // Firestore & Authentication instance
import { collection, getDocs } from "firebase/firestore";
import Layout from "./Layout";
import ContentHeader from "./ContentHeader";
import "../styles/UserManagement.css";
import { FaCheck } from "react-icons/fa";

const UserManagement = () => {
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [registeredUsersSearch, setRegisteredUsersSearch] = useState("");
  const [registeredUsersPage, setRegisteredUsersPage] = useState(1);
  const itemsPerPage = 5; // Users per page

  useEffect(() => {
    fetchRegisteredUsers();
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

  const StatusIndicator = ({ status }) => {
    switch (status) {
      case "approved":
        return <FaCheck className="status-icon approved" title="Approved" />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <ContentHeader title="User Management" />
      <div className="user-management">
        <div className="section">
          <h2>Registered Users</h2>
          {/* Search Box */}
          <input
            type="text"
            placeholder="🔍 Search registered users..."
            value={registeredUsersSearch}
            onChange={(e) => setRegisteredUsersSearch(e.target.value)}
            className="search-box"
          />
          {/* User Table */}
          {filteredRegisteredUsers.length === 0 ? (
            <p>No registered users found.</p>
          ) : (
            <div className="user-list">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Profile Photo</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRegisteredUsers.map((user) => (
                    <tr key={user.uid}>
                      <td>
                        <StatusIndicator status={user.status} />
                      </td>
                      <td>
                        {user.profile_photo_url ? (
                          <img
                            src={user.profile_photo_url}
                            alt="Profile"
                            className="profile-thumbnail"
                          />
                        ) : (
                          <div className="no-photo">No Photo</div>
                        )}
                      </td>
                      <td>{`${user.first_name} ${user.middle_name} ${user.surname}`}</td>
                      <td>{user.email}</td>
                      <td>{user.address}</td>
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
