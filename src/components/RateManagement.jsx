import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  query,
  orderBy,
  getDoc,
} from "firebase/firestore";
import { auth } from "../firebase"; // Import auth for current user
import Layout from "./Layout";
import ContentHeader from "./ContentHeader"; // Add this import
import "../styles/RateManagement.css";
import { FaEdit, FaHistory } from "react-icons/fa";
import dayjs from "dayjs";
import { logAdminAction } from "../utils/logAdminAction";

// Simple mapping from doc IDs to friendly names
const docIdToDisplayName = {
  RegularBicycle: "Regular Bicycle",
  ElectricBicycle: "Electric Bicycle",
};

const RateManagement = () => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRate, setEditingRate] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [rateHistory, setRateHistory] = useState([]);
  const [stationRevenue, setStationRevenue] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [timePeriod, setTimePeriod] = useState("daily");
  const [stats, setStats] = useState({
    daily: { revenue: 0, rides: 0 },
    weekly: { revenue: 0, rides: 0 },
    monthly: { revenue: 0, rides: 0 },
    total: { revenue: 0, rides: 0 },
    all: { revenue: 0, rides: 0 }, // Add this line
  });
  const [sortConfig, setSortConfig] = useState({
    key: "revenue",
    direction: "desc",
  });
  // Add to existing state declarations
  const [remittances, setRemittances] = useState([]);
  const [showRemittances, setShowRemittances] = useState(false);
  // Add these near your other state declarations
  const [processingRemittance, setProcessingRemittance] = useState(false);

  // Add after other fetch functions
  const fetchRemittances = async () => {
    try {
      const remittancesRef = collection(db, "remittances");
      const q = query(remittancesRef, orderBy("dateSubmitted", "desc"));
      const snapshot = await getDocs(q);
      const remittanceData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRemittances(remittanceData);
    } catch (error) {
      console.error("Error fetching remittances:", error);
    }
  };

  const [deletedStationRevenue, setDeletedStationRevenue] = useState([]);
  const [showDeletedStations, setShowDeletedStations] = useState(false);

  const handleSort = (key) => {
    setSortConfig({
      key,
      direction:
        sortConfig.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  };

  useEffect(() => {
    fetchRates();
    fetchRateHistory();
    fetchStationRevenue();
    fetchRemittances();
  }, []);

  useEffect(() => {
    fetchStationRevenue();
  }, [timePeriod]);

  const fetchRates = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "rentalRates"));
      const fetchedRates = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id, // e.g., "RegularBicycle" or "ElectricBicycle"
        ...docSnap.data(), // { pricePerMinute: number }
      }));
      setRates(fetchedRates);
    } catch (error) {
      console.error("Error fetching rental rates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRateHistory = async () => {
    try {
      const historyRef = collection(db, "rateHistory");
      const q = query(historyRef, orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRateHistory(history);
    } catch (error) {
      console.error("Error fetching rate history:", error);
    }
  };

  // Helper function to check if date is within selected period
  const isWithinTimePeriod = (date, period) => {
    const now = dayjs();
    switch (period) {
      case "daily":
        return dayjs(date).isSame(now, "day");
      case "weekly":
        return dayjs(date).isAfter(now.subtract(1, "week"));
      case "monthly":
        return dayjs(date).isAfter(now.subtract(1, "month"));
      case "all":
        return true;
      default:
        return true;
    }
  };

  const fetchStationRevenue = async () => {
    try {
      // Get all rides from ride_history
      const ridesRef = collection(db, "ride_history");
      const ridesSnap = await getDocs(ridesRef);

      // Initialize data structures
      let activeRevenue = {};
      let deletedRevenue = {};
      let periodStats = {
        daily: { revenue: 0, rides: 0 },
        weekly: { revenue: 0, rides: 0 },
        monthly: { revenue: 0, rides: 0 },
        all: { revenue: 0, rides: 0 },
      };

      // Get current active stations
      const stationsRef = collection(db, "stations");
      const stationsSnap = await getDocs(stationsRef);
      const activeStations = new Map(
        stationsSnap.docs.map((doc) => [doc.id, doc.data().stationName])
      );

      // Process each ride
      ridesSnap.docs.forEach((doc) => {
        const ride = doc.data();
        const rideDate = ride.rideEndedAt.toDate();
        const amount = Number(ride.amountPaid || 0);
        const stationId = ride.startStation;
        const stationName = ride.startStationName || "Unknown Station";

        // Check if ride should be counted for current time period
        if (!isWithinTimePeriod(rideDate, timePeriod)) return;

        // Update period stats
        periodStats[timePeriod].revenue += amount;
        periodStats[timePeriod].rides += 1;

        if (stationId) {
          // Check if station is active or deleted
          if (activeStations.has(stationId)) {
            // Active station
            if (!activeRevenue[stationId]) {
              activeRevenue[stationId] = {
                id: stationId,
                stationName: activeStations.get(stationId),
                revenue: 0,
                rides: 0,
              };
            }
            activeRevenue[stationId].revenue += amount;
            activeRevenue[stationId].rides += 1;
          } else {
            // Deleted station
            if (!deletedRevenue[stationId]) {
              deletedRevenue[stationId] = {
                id: stationId,
                stationName: stationName,
                revenue: 0,
                rides: 0,
                isDeleted: true,
              };
            }
            deletedRevenue[stationId].revenue += amount;
            deletedRevenue[stationId].rides += 1;
          }
        }
      });

      // Convert to arrays
      const activeStationRevenue = Object.values(activeRevenue);
      const deletedStationRevenue = Object.values(deletedRevenue);

      // Update state
      setStationRevenue(activeStationRevenue);
      setDeletedStationRevenue(deletedStationRevenue);
      setStats((prevStats) => ({
        ...prevStats,
        [timePeriod]: periodStats[timePeriod],
      }));
    } catch (error) {
      console.error("Error fetching station revenue:", error);
    }
  };

  const openEditModal = (rate) => {
    setEditingRate(rate);
    setNewPrice(rate.pricePerMinute?.toString() || "");
  };

  const closeEditModal = () => {
    setEditingRate(null);
    setNewPrice("");
  };

  const handleUpdateRate = async () => {
    if (!editingRate) return;
    const price = parseFloat(newPrice);

    if (isNaN(price) || price <= 0) {
      alert("Please enter a valid number greater than 0 for the price.");
      return;
    }

    try {
      // Get current user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No user is signed in");
      }

      // Fetch user's name from Firestore
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const updatedByName = userDocSnap.exists()
        ? userDocSnap.data().name
        : "Unknown User";

      // Update rate
      const rateRef = doc(db, "rentalRates", editingRate.id);
      await updateDoc(rateRef, { pricePerMinute: price });
      await logAdminAction({
        actionType: "UPDATE_RATE",
        details: `Updated rate for ${editingRate.id} from ₱${editingRate.pricePerMinute} to ₱${price}`,
        targetCollection: "rentalRates",
        targetId: editingRate.id,
      });

      // Update local states
      const updatedRates = rates.map((rate) =>
        rate.id === editingRate.id ? { ...rate, pricePerMinute: price } : rate
      );
      setRates(updatedRates);
      await fetchRateHistory(); // Refresh history

      closeEditModal();
    } catch (error) {
      console.error("Error updating rate:", error);
      alert("Failed to update the rate. See console for details.");
    }
  };

  // Add this function before the return statement
  const handleRemittanceAction = async (remitId, newStatus) => {
    if (
      !window.confirm(`Are you sure you want to ${newStatus} this remittance?`)
    ) {
      return;
    }

    setProcessingRemittance(true);
    try {
      const remitRef = doc(db, "remittances", remitId);
      await updateDoc(remitRef, {
        status: newStatus,
        processedAt: new Date(),
        processedBy: auth.currentUser.uid,
      });
      await logAdminAction({
        actionType: `REMITTANCE_${newStatus.toUpperCase()}`,
        details: `Remittance ${remitId} marked as ${newStatus}`,
        targetCollection: "remittances",
        targetId: remitId,
      });

      // Refresh remittances
      fetchRemittances();
      alert(`Remittance ${newStatus} successfully`);
    } catch (error) {
      console.error("Error processing remittance:", error);
      alert("Failed to process remittance");
    } finally {
      setProcessingRemittance(false);
    }
  };

  return (
    <Layout>
      <ContentHeader title="Bike Management" />
      <div className="rate-management-container">
        <h2>Rental Rate Management</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <div className="table-container">
              <table className="rate-table">
                <thead>
                  <tr>
                    <th>Bike Type</th>
                    <th>Price Per Minute (₱)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length > 0 ? (
                    rates.map((rate) => {
                      // Use the mapping, or fall back to the raw doc ID
                      const friendlyName =
                        docIdToDisplayName[rate.id] || rate.id;

                      return (
                        <tr key={rate.id}>
                          <td>{friendlyName}</td>
                          <td>{rate.pricePerMinute?.toFixed(2)}</td>
                          <td>
                            <button
                              className="edit-btn"
                              onClick={() => openEditModal(rate)}
                            >
                              <FaEdit /> Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: "center" }}>
                        No rental rates available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        {/* Station Revenue Section */}
        <div className="revenue-section">
          <h3>Station Revenue</h3>
          <div className="controls">
            <div className="time-filter">
              <button
                className={`filter-btn ${timePeriod === "all" ? "active" : ""}`}
                onClick={() => setTimePeriod("all")}
              >
                All Time
              </button>
              <button
                className={`filter-btn ${
                  timePeriod === "daily" ? "active" : ""
                }`}
                onClick={() => setTimePeriod("daily")}
              >
                Today
              </button>
              <button
                className={`filter-btn ${
                  timePeriod === "weekly" ? "active" : ""
                }`}
                onClick={() => setTimePeriod("weekly")}
              >
                This Week
              </button>
              <button
                className={`filter-btn ${
                  timePeriod === "monthly" ? "active" : ""
                }`}
                onClick={() => setTimePeriod("monthly")}
              >
                This Month
              </button>
              <button
                className={`filter-btn ${showDeletedStations ? "active" : ""}`}
                onClick={() => setShowDeletedStations(!showDeletedStations)}
              >
                {showDeletedStations
                  ? "Hide Deleted Stations"
                  : "Show Deleted Stations"}
              </button>
            </div>
          </div>
          <div className="table-container">
            <table className="revenue-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort("stationName")}>
                    Station Name{" "}
                    {sortConfig.key === "stationName" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("revenue")}>
                    Total Revenue (₱){" "}
                    {sortConfig.key === "revenue" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => handleSort("rides")}>
                    Total Rides{" "}
                    {sortConfig.key === "rides" &&
                      (sortConfig.direction === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Active Stations */}
                {stationRevenue
                  .sort((a, b) => {
                    if (sortConfig.key === "stationName") {
                      return sortConfig.direction === "asc"
                        ? a.stationName.localeCompare(b.stationName)
                        : b.stationName.localeCompare(a.stationName);
                    }
                    return sortConfig.direction === "asc"
                      ? a[sortConfig.key] - b[sortConfig.key]
                      : b[sortConfig.key] - a[sortConfig.key];
                  })
                  .map((station) => (
                    <tr key={station.id}>
                      <td>{station.stationName}</td>
                      <td>{station.revenue.toFixed(2)}</td>
                      <td>{station.rides}</td>
                    </tr>
                  ))}

                {/* Deleted Stations */}
                {showDeletedStations &&
                  deletedStationRevenue
                    .sort((a, b) => {
                      if (sortConfig.key === "stationName") {
                        return sortConfig.direction === "asc"
                          ? a.stationName.localeCompare(b.stationName)
                          : b.stationName.localeCompare(a.stationName);
                      }
                      return sortConfig.direction === "asc"
                        ? a[sortConfig.key] - b[sortConfig.key]
                        : b[sortConfig.key] - a[sortConfig.key];
                    })
                    .map((station) => (
                      <tr key={station.id} className="deleted-station">
                        <td>{station.stationName} (Deleted)</td>
                        <td>{station.revenue.toFixed(2)}</td>
                        <td>{station.rides}</td>
                      </tr>
                    ))}

                {/* Total Row */}
                <tr className="total-row">
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>₱{stats[timePeriod].revenue.toFixed(2)}</strong>
                  </td>
                  <td>
                    <strong>{stats[timePeriod].rides}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        {/* Rate History Section */}
        <div className="history-section">
          <div className="history-header">
            <h3>Rate History</h3>
            <button
              className="history-toggle-btn"
              onClick={() => setShowHistory(!showHistory)}
            >
              <FaHistory /> {showHistory ? "Hide History" : "Show History"}
            </button>
          </div>

          {showHistory && (
            <div className="table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Bike Type</th>
                    <th>Old Price (₱)</th>
                    <th>New Price (₱)</th>
                    <th>Updated By</th>
                  </tr>
                </thead>
                <tbody>
                  {rateHistory.map((history) => (
                    <tr key={history.id}>
                      <td>
                        {dayjs(history.timestamp.toDate()).format(
                          "MMM D, YYYY HH:mm"
                        )}
                      </td>
                      <td>
                        {docIdToDisplayName[history.bikeType] ||
                          history.bikeType}
                      </td>
                      <td>{history.oldPrice?.toFixed(2)}</td>
                      <td>{history.newPrice.toFixed(2)}</td>
                      <td>{history.updatedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Edit Modal */}
        {editingRate && (
          <div className="modal-overlay" onClick={closeEditModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Edit Rental Rate</h3>
              {/* Show the friendly name again in the modal */}
              <p>
                Bike Type:{" "}
                <strong>
                  {docIdToDisplayName[editingRate.id] || editingRate.id}
                </strong>
              </p>

              <label>Price Per Minute (₱):</label>
              <input
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
              />

              <div className="modal-buttons">
                <button className="save-btn" onClick={handleUpdateRate}>
                  Save
                </button>
                <button className="cancel-btn" onClick={closeEditModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Remittance Status Section */}
        <div className="remittance-section">
          <div className="section-header">
            <h3>Station Remittances</h3>
            <button
              className="history-toggle-btn"
              onClick={() => setShowRemittances(!showRemittances)}
            >
              {showRemittances ? "Hide Remittances" : "Show Remittances"}
            </button>
          </div>

          {showRemittances && (
            <div className="table-container">
              <table className="remittance-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Station</th>
                    <th>Period</th>
                    <th>Amount (₱)</th>
                    <th>Status</th>
                    <th>Proof</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {remittances.map((remit) => (
                    <tr key={remit.id} className={`status-${remit.status}`}>
                      <td>
                        {dayjs(remit.dateSubmitted?.toDate()).format(
                          "MMM D, YYYY HH:mm"
                        )}
                      </td>
                      <td>{remit.stationName}</td>
                      <td>
                        {dayjs(remit.collectedFrom?.toDate()).format("MMM D")} -{" "}
                        {dayjs(remit.collectedTo?.toDate()).format(
                          "MMM D, YYYY"
                        )}
                      </td>
                      <td>₱{remit.amount.toFixed(2)}</td>
                      <td>
                        <span className={`status-badge ${remit.status}`}>
                          {remit.status}
                        </span>
                      </td>
                      <td>
                        {remit.proofOfPayment && (
                          <button
                            className="view-proof-btn"
                            onClick={() =>
                              window.open(remit.proofOfPayment, "_blank")
                            }
                          >
                            View Proof
                          </button>
                        )}
                      </td>
                      <td>
                        {remit.status === "pending" && (
                          <div className="action-buttons">
                            <button
                              className="confirm-btn"
                              onClick={() =>
                                handleRemittanceAction(remit.id, "confirmed")
                              }
                              disabled={processingRemittance}
                            >
                              Confirm
                            </button>
                            <button
                              className="reject-btn"
                              onClick={() =>
                                handleRemittanceAction(remit.id, "rejected")
                              }
                              disabled={processingRemittance}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {remittances.length === 0 && (
                    <tr>
                      <td colSpan="7" className="no-data">
                        No remittances found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RateManagement;
