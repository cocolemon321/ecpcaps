import React, { useEffect, useState } from "react";
import { FaBell } from "react-icons/fa";
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
} from "firebase/firestore";
import "../styles/ContentHeader.css";

const Header = () => {
  const [userName, setUserName] = useState("Loading...");
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const getAssetPath = (filename) => {
    return import.meta.env.DEV
      ? `/assets/${filename}`
      : `/ecpcaps/assets/${filename}`;
  };

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
          const userDocRef = doc(db, "users", user.uid); // ✅ Get user document
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserName(userDocSnap.data().name); // ✅ Set the name from Firestore
          } else {
            setUserName("Super Admin"); // ✅ Fallback default
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserName("Unknown User"); // ✅ Handle logged-out state
      }
    });

    return () => unsubscribe(); // ✅ Cleanup listener on unmount
  }, []);

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
    <div className="header">
      <div className="user-profile">
        {/* Move profile section before notification */}
        <div className="profile">
          <img
            src={getAssetPath("userlogo.png")}
            alt="Profile"
            className="profile-img"
          />
          <div className="profile-name">
            <p>{userName}</p>
            <small>Super Admin</small>
          </div>
        </div>

        {/* Notification moved to the end */}
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
      </div>
    </div>
  );
};

export default Header;
