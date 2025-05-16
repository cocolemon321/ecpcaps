import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import axios from "axios";
import Layout from "./Layout";
import LiveMap from "./LiveMap";
import ContentHeader from "./ContentHeader";
import AddStationMap from "./AddStationMap";
import "../styles/StationManagement.css";
import { FaEdit, FaTrashAlt, FaPlus, FaTimes } from "react-icons/fa";
import { logAdminAction } from "../utils/logAdminAction";

const StationManagement = () => {
  const [stations, setStations] = useState([]);
  const [bikes, setBikes] = useState([]);

  // MODAL STATES
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [showStationDetailModal, setShowStationDetailModal] = useState(false);
  const [detailedStation, setDetailedStation] = useState(null);

  // STATION FORM FIELDS
  const [stationName, setStationName] = useState("");
  const [stationAddress, setStationAddress] = useState("");
  const [tanodAssigned, setTanodAssigned] = useState(""); // This will store the admin's ID
  const [coordinates, setCoordinates] = useState("");

  // BIKE ASSIGNMENT
  const [selectedRegularBikes, setSelectedRegularBikes] = useState([]);
  const [selectedElectricBikes, setSelectedElectricBikes] = useState([]);
  const [unassignedRegularBikes, setUnassignedRegularBikes] = useState([]);
  const [unassignedElectricBikes, setUnassignedElectricBikes] = useState([]);
  const [showUnassignedEBikeList, setShowUnassignedEBikeList] = useState(false);
  const [showUnassignedBikeList, setShowUnassignedBikeList] = useState(false);
  const [showAssignedBikeSelection, setShowAssignedBikeSelection] =
    useState(false);
  const [showAssignedEBikeSelection, setShowAssignedEBikeSelection] =
    useState(false);

  // ADMIN STATES
  const [unassignedAdmins, setUnassignedAdmins] = useState([]);
  const [allAdmins, setAllAdmins] = useState([]);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);

  // Add this with your other state declarations
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchAllAdmins();
    fetchUnassignedAdmins();
    fetchStations();
    fetchBikes();
  }, []);

  // Fetch ALL admins
  const fetchAllAdmins = async () => {
    try {
      const adminsSnapshot = await getDocs(collection(db, "admins"));
      const all = adminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllAdmins(all);
    } catch (error) {
      console.error("Error fetching all admins:", error);
    }
  };

  // Fetch UNASSIGNED admins (for adding new station)
  const fetchUnassignedAdmins = async () => {
    try {
      const adminsSnapshot = await getDocs(collection(db, "admins"));
      const allAdminsData = adminsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const unassigned = allAdminsData.filter(
        (admin) => !admin.stationAssignedTo
      );
      setUnassignedAdmins(unassigned);
    } catch (error) {
      console.error("Error fetching unassigned admins:", error);
    }
  };

  const fetchStations = async () => {
    try {
      // 1) Fetch all admins => build a map from admin ID -> admin name
      const adminsSnapshot = await getDocs(collection(db, "admins"));
      const adminMap = {};
      adminsSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        adminMap[docSnap.id] = data.name; // ID -> name
      });

      // 2) Fetch all stations
      const stationsSnapshot = await getDocs(collection(db, "stations"));
      const allStations = stationsSnapshot.docs.map((docSnap) => {
        const stationData = docSnap.data();
        // Handle both single admin ID and array of admin IDs
        const tanodAssigned = stationData.tanodAssigned || [];
        const tanodArray = Array.isArray(tanodAssigned)
          ? tanodAssigned
          : [tanodAssigned];

        return {
          id: docSnap.id,
          ...stationData,
          tanodAssignedID: tanodArray, // Store the array of admin IDs
          tanodAssignedName:
            tanodArray
              .map((adminId) => adminMap[adminId] || "Unknown")
              .join(", ") || "Not Assigned",
        };
      });

      // 3) Fetch all bikes
      const bikesSnapshot = await getDocs(collection(db, "bikes"));
      const allBikes = bikesSnapshot.docs.map((b) => ({
        id: b.id,
        ...b.data(),
      }));

      // 4) Calculate total available bikes per station
      const updatedStations = allStations.map((station) => {
        const totalRegularBikes = allBikes.filter(
          (bike) =>
            bike.stationAssigned === station.id &&
            bike.bikeCategory === "Regular Bicycle" &&
            bike.bikeStatus === "Available" &&
            bike.isAvailable === true
        ).length;

        const totalElectricBikes = allBikes.filter(
          (bike) =>
            bike.stationAssigned === station.id &&
            bike.bikeCategory === "Electric Bicycle" &&
            bike.bikeStatus === "Available" &&
            bike.isAvailable === true
        ).length;

        return {
          ...station,
          totalRegularBikes,
          totalElectricBikes,
        };
      });

      setStations(updatedStations);
    } catch (error) {
      console.error("Error fetching stations:", error);
    }
  };

  const fetchBikes = async () => {
    const bikesSnapshot = await getDocs(collection(db, "bikes"));
    const allBikes = bikesSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    // Filter for unassigned AND available bikes
    const unassigned = allBikes.filter(
      (bike) =>
        !bike.stationAssigned &&
        bike.bikeStatus === "Available" &&
        bike.isAvailable === true
    );

    setBikes(allBikes);

    setUnassignedRegularBikes(
      unassigned.filter((bike) => bike.bikeCategory === "Regular Bicycle")
    );
    setUnassignedElectricBikes(
      unassigned.filter((bike) => bike.bikeCategory === "Electric Bicycle")
    );
  };

  const handleDelete = async (stationId) => {
    // Find station details for the confirmation message
    const stationToDelete = stations.find(
      (station) => station.id === stationId
    );

    // Show confirmation dialog with station details
    const isConfirmed = window.confirm(
      `Are you sure you want to delete this station?\n\n` +
        `Station Name: ${stationToDelete.stationName}\n` +
        `Address: ${stationToDelete.stationAddress}\n` +
        `Regular Bikes: ${stationToDelete.totalRegularBikes || 0}\n` +
        `Electric Bikes: ${stationToDelete.totalElectricBikes || 0}\n` +
        `Tanod Assigned: ${stationToDelete.tanodAssignedName || "None"}\n\n` +
        `This action cannot be undone!`
    );

    if (!isConfirmed) return;

    try {
      const stationRef = doc(db, "stations", stationId);
      const stationSnap = await getDoc(stationRef);
      const stationData = stationSnap.data();

      // 1. Handle assigned admins
      const assignedTanods = stationData?.tanodAssigned || [];
      const tanodArray = Array.isArray(assignedTanods)
        ? assignedTanods
        : [assignedTanods];

      // Update all assigned admins
      const adminUpdates = tanodArray.map((adminId) =>
        updateDoc(doc(db, "admins", adminId), {
          stationAssignedTo: null,
        })
      );
      await Promise.all(adminUpdates);

      // 2. Handle assigned bikes
      const bikesSnapshot = await getDocs(collection(db, "bikes"));
      const assignedBikes = bikesSnapshot.docs.filter(
        (doc) => doc.data().stationAssigned === stationId
      );

      // Update all bikes assigned to this station
      const bikeUpdates = assignedBikes.map((bike) =>
        updateDoc(doc(db, "bikes", bike.id), {
          stationAssigned: null,
          bikeStatus: "Available",
          isAvailable: true,
        })
      );
      await Promise.all(bikeUpdates);

      // 3. Delete the station
      await deleteDoc(stationRef);

      // Show success message
      setSuccessMessage("Station deleted successfully!");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

      // Refresh data
      fetchUnassignedAdmins();
      fetchStations();
      fetchBikes();

      await logAdminAction({
        actionType: "DELETE_STATION",
        details: `Deleted station: ${stationId}`,
        targetCollection: "stations",
        targetId: stationId,
      });
    } catch (error) {
      console.error("Error deleting station:", error);
      alert("Error deleting station. Please try again.");
    }
  };

  const handleEdit = async (station) => {
    // station now has: station.tanodAssignedID, station.tanodAssignedName
    setEditingStation(station);
    setStationName(station.stationName || "");
    setStationAddress(station.stationAddress || "");
    setCoordinates(station.coordinates || "");
    // Importantly, setTanodAssigned to the actual admin ID
    setTanodAssigned(station.tanodAssignedID || "");

    setShowEditModal(true);

    // Fetch all bikes
    const bikesSnapshot = await getDocs(collection(db, "bikes"));
    const allBikes = bikesSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    // Preselect the station's assigned bikes
    setSelectedRegularBikes(
      allBikes
        .filter(
          (bike) =>
            bike.bikeCategory === "Regular Bicycle" &&
            bike.stationAssigned === station.id
        )
        .map((b) => b.id)
    );

    setSelectedElectricBikes(
      allBikes
        .filter(
          (bike) =>
            bike.bikeCategory === "Electric Bicycle" &&
            bike.stationAssigned === station.id
        )
        .map((b) => b.id)
    );

    fetchBikes();
  };

  const handleAddStation = () => {
    setEditingStation(null);
    setStationName("");
    setStationAddress("");
    setCoordinates("");
    setTanodAssigned("");
    setSelectedRegularBikes([]);
    setSelectedElectricBikes([]);
    setIsSelectingLocation(false); // Reset selection mode
    setShowAddModal(true);
  };

  const fetchAddress = async (lat, lon) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      setStationAddress(response.data.display_name || "Unknown Address");
    } catch (error) {
      console.error("Error fetching address:", error);
    }
  };

  const fetchUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const coords = `${latitude}, ${longitude}`;
          setCoordinates(coords);
          fetchAddress(latitude, longitude);
        },
        (err) => {
          console.error("Error getting location:", err);
          alert("Unable to retrieve location. Please enter manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleCoordinatesChange = (e) => {
    const coords = e.target.value;
    setCoordinates(coords); // Save the coordinates as a string
    const [lat, lon] = coords.split(",");
    if (lat && lon) {
      fetchAddress(lat.trim(), lon.trim());
    }
  };

  const handleLocationSelect = (coordinates) => {
    setCoordinates(coordinates.join(","));
    fetchAddress(coordinates[0], coordinates[1]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tanodAssigned) {
      alert("Please select an admin (or allow none).");
      return;
    }

    try {
      const coordinatesArray =
        typeof coordinates === "string"
          ? coordinates.split(",").map((coord) => parseFloat(coord.trim()))
          : [];

      // Convert single admin ID to array if it's not already
      const tanodArray = Array.isArray(tanodAssigned)
        ? tanodAssigned
        : [tanodAssigned];

      let stationRef;
      if (editingStation) {
        stationRef = doc(db, "stations", editingStation.id);
        await updateDoc(stationRef, {
          stationName,
          stationAddress,
          coordinates: coordinatesArray,
          tanodAssigned: tanodArray, // Store as array
        });
        setSuccessMessage("Station updated successfully!");
        setShowEditModal(false);
      } else {
        const newStation = {
          stationName,
          stationAddress,
          coordinates: coordinatesArray,
          tanodAssigned: tanodArray, // Store as array
        };
        stationRef = await addDoc(collection(db, "stations"), newStation);
        setSuccessMessage("Station added successfully!");
        setShowAddModal(false);
      }

      if (stationRef && stationRef.id) {
        // Update all assigned admins
        const adminUpdates = tanodArray.map((adminId) =>
          updateDoc(doc(db, "admins", adminId), {
            stationAssignedTo: stationRef.id,
          })
        );
        await Promise.all(adminUpdates);

        await assignBikesToStation(stationRef.id);

        fetchUnassignedAdmins();
        fetchStations();

        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
        }, 2000);

        await logAdminAction({
          actionType: "UPDATE_STATION",
          details: `Updated station: ${stationRef.id}`,
          targetCollection: "stations",
          targetId: stationRef.id,
        });
      }
    } catch (error) {
      console.error("Error saving station:", error);
    }
  };

  const assignBikesToStation = async (stationId) => {
    try {
      for (const bikeId of selectedRegularBikes) {
        const bikeRef = doc(db, "bikes", bikeId);
        await updateDoc(bikeRef, { stationAssigned: stationId });
      }
      for (const bikeId of selectedElectricBikes) {
        const bikeRef = doc(db, "bikes", bikeId);
        await updateDoc(bikeRef, { stationAssigned: stationId });
      }
      console.log("Bikes assigned successfully:", stationId);
    } catch (error) {
      console.error("Error assigning bikes:", error);
    }
  };

  // Show "Add" list
  const handleShowUnassignedBikes = (bikeType) => {
    if (bikeType === "Regular Bicycle") setShowUnassignedBikeList(true);
    else setShowUnassignedEBikeList(true);
  };

  // Show "Remove" list
  const handleShowAssignedBikes = (bikeType) => {
    if (bikeType === "Regular Bicycle") {
      setShowAssignedBikeSelection(true);
      setShowAssignedEBikeSelection(false);
    } else {
      setShowAssignedEBikeSelection(true);
      setShowAssignedBikeSelection(false);
    }
  };

  const handleRemoveBike = async (bikeId, bikeType) => {
    try {
      const bikeRef = doc(db, "bikes", bikeId);
      await updateDoc(bikeRef, { stationAssigned: null });

      if (bikeType === "Regular Bicycle") {
        setSelectedRegularBikes((prev) => prev.filter((id) => id !== bikeId));
      } else {
        setSelectedElectricBikes((prev) => prev.filter((id) => id !== bikeId));
      }

      fetchBikes();
      console.log(`Bike ${bikeId} unassigned successfully.`);
    } catch (error) {
      console.error("Error unassigning bike:", error);
    }
  };

  // New: Modal for displaying detailed station info
  const StationDetailModal = ({ station, onClose }) => {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>{station.stationName}</h2>
          <p>
            <strong>Address:</strong> {station.stationAddress}
          </p>
          <p>
            <strong>Coordinates:</strong> {station.coordinates}
          </p>
          <p>
            <strong>Tanod Assigned:</strong>{" "}
            {station.tanodAssignedName || "Not Assigned"}
          </p>
          <p>
            <strong>Total Bikes:</strong> {station.totalRegularBikes || 0}{" "}
            (Regular), {station.totalElectricBikes || 0} (Electric)
          </p>
          <button className="cancel-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  };

  // Add this inside your StationManagement component, before the return statement
  const SuccessOverlay = ({ message }) => {
    return (
      <div className="success-overlay">
        <div className="success-content">
          <div className="success-icon">✓</div>
          <p>{message}</p>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <ContentHeader title="Station Management" />
      <div className="station-management-container">
        <div className="station-management-header">
          <h2>Station Overview</h2>
          <button className="add-station-btn" onClick={handleAddStation}>
            <FaPlus /> Add New Station
          </button>
        </div>

        {/* Map Section First */}
        <div className="station-map-section">
          <h2>Station Locations</h2>
          <div className="map-container">
            <LiveMap
              onEditStation={(station) => {
                handleEdit(station);
              }}
            />
          </div>
        </div>

        {/* Table Section Second */}
        <div className="station-list">
          <table>
            <thead>
              <tr>
                <th>Station Name</th>
                <th>Station Address</th>
                <th>Total Bikes</th>
                <th>Total E-Bikes</th>
                <th>Tanod Assigned</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {stations.length > 0 ? (
                stations.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <strong>{st.stationName}</strong>
                    </td>
                    <td>
                      <span
                        onClick={() => {
                          setDetailedStation(st);
                          setShowStationDetailModal(true);
                        }}
                        style={{ cursor: "pointer", color: "#00796b" }}
                      >
                        {st.stationAddress}
                      </span>
                    </td>
                    <td>{st.totalRegularBikes || 0}</td>
                    <td>{st.totalElectricBikes || 0}</td>
                    <td>
                      <strong>{st.tanodAssignedName || "Not Assigned"}</strong>
                    </td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(st.id)}
                      >
                        <FaTrashAlt />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    style={{ textAlign: "center", padding: "10px" }}
                  >
                    No stations available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Station Detail Modal */}
        {showStationDetailModal && detailedStation && (
          <StationDetailModal
            station={detailedStation}
            onClose={() => setShowStationDetailModal(false)}
          />
        )}

        {/* ---------- ADD STATION MODAL ---------- */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content large">
              <div className="modal-header">
                <h2>Add Station</h2>
                <button
                  className="close-modal-btn"
                  onClick={() => {
                    setIsSelectingLocation(false);
                    setShowAddModal(false);
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <label>Station Name:</label>
                <input
                  type="text"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  required
                />

                <label>Location:</label>
                <div className="location-selection">
                  <div className="coordinates-input">
                    <input
                      type="text"
                      value={coordinates}
                      onChange={handleCoordinatesChange}
                      placeholder="Click on map or enter lat,long"
                      readOnly
                    />
                    <button
                      type="button"
                      className={`select-location-btn ${
                        isSelectingLocation ? "active" : ""
                      }`}
                      onClick={() =>
                        setIsSelectingLocation(!isSelectingLocation)
                      }
                    >
                      {isSelectingLocation ? "Done Selecting" : "Select on Map"}
                    </button>
                  </div>
                  <div className="map-container">
                    <AddStationMap
                      onSelectLocation={handleLocationSelect}
                      isSelectingLocation={isSelectingLocation}
                    />
                  </div>
                </div>

                <label>Address:</label>
                <textarea value={stationAddress} readOnly />

                <label>Tanod Assigned:</label>
                <select
                  value={tanodAssigned}
                  onChange={(e) => setTanodAssigned(e.target.value)}
                  required
                >
                  <option value="">Select Tanod</option>
                  {unassignedAdmins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name} ({admin.email})
                    </option>
                  ))}
                </select>

                <label>Add Bikes:</label>
                <div className="bike-selection">
                  <button
                    type="button"
                    onClick={() => handleShowUnassignedBikes("Regular Bicycle")}
                  >
                    ➕
                  </button>
                  <input
                    type="text"
                    value={`${selectedRegularBikes.length} Selected`}
                    readOnly
                  />
                </div>

                <label>Add E-Bikes:</label>
                <div className="bike-selection">
                  <button
                    type="button"
                    onClick={() =>
                      handleShowUnassignedBikes("Electric Bicycle")
                    }
                  >
                    ➕
                  </button>
                  <input
                    type="text"
                    value={`${selectedElectricBikes.length} Selected`}
                    readOnly
                  />
                </div>

                <div className="modal-buttons">
                  <button type="submit" className="save-btn">
                    Save
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ---------- UNASSIGNED REGULAR BIKES MODAL ---------- */}
        {showUnassignedBikeList && (
          <div className="add-bike-modal-overlay">
            <div className="add-bike-modal">
              <h2>Select Regular Bikes</h2>
              <div className="bike-list-container">
                {unassignedRegularBikes.length > 0 ? (
                  unassignedRegularBikes.map((bike) => (
                    <div key={bike.id} className="bike-item">
                      <label>
                        {bike.bikeName} ({bike.bikeId})
                      </label>
                      <input
                        type="checkbox"
                        checked={selectedRegularBikes.includes(bike.id)}
                        onChange={() => {
                          setSelectedRegularBikes((prev) =>
                            prev.includes(bike.id)
                              ? prev.filter((id) => id !== bike.id)
                              : [...prev, bike.id]
                          );
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <p>No unassigned bikes available</p>
                )}
              </div>
              <button
                className="save-btn"
                onClick={() => setShowUnassignedBikeList(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ---------- UNASSIGNED ELECTRIC BIKES MODAL ---------- */}
        {showUnassignedEBikeList && (
          <div className="add-bike-modal-overlay">
            <div className="add-bike-modal">
              <h2>Select Electric Bikes</h2>
              <div className="bike-list-container">
                {unassignedElectricBikes.length > 0 ? (
                  unassignedElectricBikes.map((bike) => (
                    <div key={bike.id} className="bike-item">
                      <label>
                        {bike.bikeName} ({bike.bikeId})
                      </label>
                      <input
                        type="checkbox"
                        checked={selectedElectricBikes.includes(bike.id)}
                        onChange={() => {
                          setSelectedElectricBikes((prev) =>
                            prev.includes(bike.id)
                              ? prev.filter((id) => id !== bike.id)
                              : [...prev, bike.id]
                          );
                        }}
                      />
                    </div>
                  ))
                ) : (
                  <p>No unassigned e-bikes available</p>
                )}
              </div>
              <button
                className="save-btn"
                onClick={() => setShowUnassignedEBikeList(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ---------- REMOVE ASSIGNED REGULAR BIKES MODAL ---------- */}
        {showAssignedBikeSelection && (
          <div className="assigned-bike-overlay">
            <div className="assigned-bike-modal">
              <h2>Remove Assigned Regular Bikes</h2>
              <div className="bike-list-container">
                {selectedRegularBikes.length > 0 ? (
                  selectedRegularBikes.map((bikeId) => {
                    const bike = bikes.find((b) => b.id === bikeId);
                    return (
                      <div key={bikeId} className="bike-item">
                        <label>
                          {bike?.bikeName} ({bike?.bikeId})
                        </label>
                        <button
                          className="remove-btn"
                          onClick={() =>
                            handleRemoveBike(bikeId, "Regular Bicycle")
                          }
                        >
                          ❌ Remove
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p>No assigned bikes.</p>
                )}
              </div>
              <button
                className="save-btn"
                onClick={() => setShowAssignedBikeSelection(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ---------- REMOVE ASSIGNED ELECTRIC BIKES MODAL ---------- */}
        {showAssignedEBikeSelection && (
          <div className="assigned-bike-overlay">
            <div className="assigned-bike-modal">
              <h2>Remove Assigned Electric Bikes</h2>
              <div className="bike-list-container">
                {selectedElectricBikes.length > 0 ? (
                  selectedElectricBikes.map((bikeId) => {
                    const bike = bikes.find((b) => b.id === bikeId);
                    return (
                      <div key={bikeId} className="bike-item">
                        <label>
                          {bike?.bikeName} ({bike?.bikeId})
                        </label>
                        <button
                          className="remove-btn"
                          onClick={() =>
                            handleRemoveBike(bikeId, "Electric Bicycle")
                          }
                        >
                          ❌ Remove
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p>No assigned e-bikes.</p>
                )}
              </div>
              <button
                className="save-btn"
                onClick={() => setShowAssignedEBikeSelection(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ---------- EDIT STATION MODAL ---------- */}
        {showEditModal && editingStation && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Edit Station</h2>
              <form onSubmit={handleSubmit}>
                <label>Station Name:</label>
                <input
                  type="text"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  required
                />

                <label>Coordinates:</label>
                <input
                  type="text"
                  value={coordinates}
                  onChange={handleCoordinatesChange}
                  placeholder="Enter lat,long"
                />

                <label>Address:</label>
                <textarea value={stationAddress} readOnly />

                <label>Tanod Assigned:</label>
                {(() => {
                  // The station's currently assigned admin ID
                  const currentAssignedAdminID = editingStation.tanodAssignedID;
                  const currentAssignedAdmin = allAdmins.find(
                    (adm) => adm.id === currentAssignedAdminID
                  );

                  // Start with unassigned admins
                  let adminOptions = [...unassignedAdmins];

                  // If there's a currently assigned admin not in the unassigned list, add them
                  if (
                    currentAssignedAdmin &&
                    !adminOptions.some(
                      (adm) => adm.id === currentAssignedAdmin.id
                    )
                  ) {
                    adminOptions.unshift(currentAssignedAdmin);
                  }

                  return (
                    <select
                      value={tanodAssigned}
                      onChange={(e) => setTanodAssigned(e.target.value)}
                      required
                    >
                      <option value="">Select Tanod</option>
                      {adminOptions.map((admin) => (
                        <option key={admin.id} value={admin.id}>
                          {admin.name} ({admin.email})
                        </option>
                      ))}
                    </select>
                  );
                })()}

                <label>Assigned Bikes:</label>
                <div className="bike-selection">
                  <button
                    type="button"
                    onClick={() => handleShowAssignedBikes("Regular Bicycle")}
                  >
                    ➖
                  </button>
                  <input
                    type="text"
                    value={`${selectedRegularBikes.length} Assigned`}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() => handleShowUnassignedBikes("Regular Bicycle")}
                  >
                    ➕
                  </button>
                </div>

                <label>Assigned E-Bikes:</label>
                <div className="bike-selection">
                  <button
                    type="button"
                    onClick={() => handleShowAssignedBikes("Electric Bicycle")}
                  >
                    ➖
                  </button>
                  <input
                    type="text"
                    value={`${selectedElectricBikes.length} Assigned`}
                    readOnly
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleShowUnassignedBikes("Electric Bicycle")
                    }
                  >
                    ➕
                  </button>
                </div>

                <div className="modal-buttons">
                  <button type="submit" className="save-btn">
                    Save
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {showSuccess && <SuccessOverlay message={successMessage} />}
      </div>
    </Layout>
  );
};

export default StationManagement;
