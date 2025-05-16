import React, { useEffect, useState } from "react";
import { FaBell, FaHistory } from "react-icons/fa";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import "../styles/ContentHeader.css";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const Header = () => {
  const [userName, setUserName] = useState("Loading...");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedActionType, setSelectedActionType] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Remove getAssetPath since we're using direct URL
  const profileImageUrl =
    "https://ecorideupload.s3.ap-southeast-2.amazonaws.com/uploads/profile/1742829316204_image.png";

  // Fetch notifications
  useEffect(() => {
    const notificationsRef = collection(db, "notifications");
    const q = query(notificationsRef, orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() });
      });
      setNotifications(notifs);
      // Count unread notifications
      setUnreadCount(notifs.filter((notif) => !notif.read).length);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Try to fetch from super_admins first
          const superAdminDocRef = doc(db, "super_admins", user.uid);
          const superAdminDocSnap = await getDoc(superAdminDocRef);

          if (superAdminDocSnap.exists()) {
            setUserName(superAdminDocSnap.data().name);
          } else {
            // Fallback to users collection
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              setUserName(userDocSnap.data().name);
            } else {
              setUserName("Super Admin");
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUserName("Super Admin");
        }
      } else {
        setUserName("Unknown User");
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch logs when logs modal is opened
  useEffect(() => {
    if (showLogsModal) {
      const logsRef = collection(db, "admin_logs");
      const qLogs = query(logsRef, orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(qLogs, (snapshot) => {
        const logsArr = [];
        snapshot.forEach((doc) => {
          logsArr.push({ id: doc.id, ...doc.data() });
        });
        setLogs(logsArr);
      });
      return () => unsubscribe();
    }
  }, [showLogsModal]);

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db);

      // Update all unread notifications to read
      notifications
        .filter((notif) => !notif.read)
        .forEach((notif) => {
          const notifRef = doc(db, "notifications", notif.id);
          batch.update(notifRef, { read: true });
        });

      await batch.commit();

      // Update local state
      setNotifications(
        notifications.map((notif) => ({
          ...notif,
          read: true,
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  // Add this function to format notification message
  const formatNotificationMessage = (notification) => {
    switch (notification.type) {
      case "status_update":
        return (
          <div className="notification-message">
            <p>{notification.message}</p>
            <span
              className={`status-badge ${notification.status
                .toLowerCase()
                .replace(" ", "-")}`}
            >
              {notification.status}
            </span>
          </div>
        );
      case "battery_update":
        return (
          <div className="notification-message">
            <p>{notification.message}</p>
            <div className="battery-indicator">
              <span
                className="battery-level"
                style={{ width: `${notification.batteryLevel}%` }}
              ></span>
            </div>
          </div>
        );
      default:
        return <p>{notification.message}</p>;
    }
  };

  return (
    <div
      className="header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        className="user-profile"
        style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}
      >
        {/* Profile section */}
        <div className="profile">
          <img src={profileImageUrl} alt="Profile" className="profile-img" />
          <div className="profile-name">
            <p>{userName}</p>
            <small>Super Admin</small>
          </div>
        </div>
      </div>
      {/* Logs button at flex-end */}
      <button
        className="view-reports-btn"
        style={{
          marginRight: 16,
          fontSize: 14,
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
        onClick={() => setShowLogsModal(true)}
      >
        <FaHistory style={{ fontSize: 16 }} /> Logs
      </button>
      {/* Notification at the end */}
      <div className="notification-container">
        <FaBell className="icon" onClick={handleNotificationClick} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
        {showNotifications && (
          <div className="notifications-modal">
            <div className="notifications-header">
              <h3>Notifications</h3>
              <button
                className="mark-all-read"
                onClick={handleMarkAllAsRead}
                disabled={unreadCount === 0}
              >
                Mark all as read
              </button>
            </div>
            <div className="notifications-list">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`notification-item ${
                      !notif.read ? "unread" : ""
                    }`}
                  >
                    <div className="notification-content">
                      {formatNotificationMessage(notif)}
                      <span className="notification-time">
                        {formatTimestamp(notif.timestamp)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="no-notifications">No notifications</p>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Logs Modal */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(false)}>
          <div
            className="modal-content"
            style={{ minWidth: 400, maxWidth: 700 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #eee",
                paddingBottom: 8,
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>Super Admin Logs</h3>
              <button
                className="close-modal"
                onClick={() => setShowLogsModal(false)}
              >
                &times;
              </button>
            </div>
            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {/* Date filter */}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: 4 }}
              />
              {/* Action type dropdown */}
              <select
                value={selectedActionType}
                onChange={(e) => setSelectedActionType(e.target.value)}
                style={{ padding: 4 }}
              >
                <option value="">All Actions</option>
                {[...new Set(logs.map((log) => log.actionType))].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {/* Search box */}
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: 4, minWidth: 160 }}
              />
            </div>
            {/* Filtered logs */}
            {(() => {
              let filteredLogs = logs;
              // Filter by date
              if (selectedDate) {
                filteredLogs = filteredLogs.filter((log) => {
                  if (!log.timestamp || !log.timestamp.toDate) return false;
                  const logDate = log.timestamp.toDate();
                  const yyyy = logDate.getFullYear();
                  const mm = String(logDate.getMonth() + 1).padStart(2, "0");
                  const dd = String(logDate.getDate()).padStart(2, "0");
                  const logDateStr = `${yyyy}-${mm}-${dd}`;
                  return logDateStr === selectedDate;
                });
              }
              // Filter by action type
              if (selectedActionType) {
                filteredLogs = filteredLogs.filter(
                  (log) => log.actionType === selectedActionType
                );
              }
              // Filter by search term
              if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredLogs = filteredLogs.filter(
                  (log) =>
                    (log.details && log.details.toLowerCase().includes(term)) ||
                    (log.adminName &&
                      log.adminName.toLowerCase().includes(term)) ||
                    (log.actionType &&
                      log.actionType.toLowerCase().includes(term)) ||
                    (log.targetId &&
                      String(log.targetId).toLowerCase().includes(term))
                );
              }
              return filteredLogs.length === 0 ? (
                <div>No logs found.</div>
              ) : (
                <ul
                  style={{ textAlign: "left", padding: 0, listStyle: "none" }}
                >
                  {filteredLogs.map((log) => (
                    <li
                      key={log.id}
                      style={{
                        marginBottom: 12,
                        borderBottom: "1px solid #eee",
                        paddingBottom: 8,
                      }}
                    >
                      <div>
                        <strong>{log.actionType}</strong> — {log.details}
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        {log.adminName ? `By: ${log.adminName}` : ""}
                        {log.timestamp && (
                          <>
                            {" "}
                            at{" "}
                            {log.timestamp.toDate
                              ? log.timestamp.toDate().toLocaleString()
                              : ""}
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default Header;
