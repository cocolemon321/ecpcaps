// LiveMap.jsx
import React, { useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css"; // Add this import
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import "../styles/LiveMap.css"; // Create this CSS file
import bikeIcon from "../assets/bike_icon.png"; // Add your bike icon path
import {
  FaSearch,
  FaPlus,
  FaMinus,
  FaEdit,
  FaChevronRight,
  FaChevronLeft,
} from "react-icons/fa";

mapboxgl.accessToken =
  "pk.eyJ1IjoiY29jb2xlbW9uMTIiLCJhIjoiY204YTBoMnZpMHplbzJzcTR3dDFmOXc4NiJ9.NqqEHSBe8cn9Gy9knbUqew";

const LiveMap = ({ onEditStation }) => {
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedStation, setSelectedStation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [availableBikes, setAvailableBikes] = useState([]);
  const [isAddingBikes, setIsAddingBikes] = useState(true);
  const [selectedBikes, setSelectedBikes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [bikeFilter, setBikeFilter] = useState("all");
  const [admins, setAdmins] = useState([]);

  // Initialize Mapbox when the component mounts
  useEffect(() => {
    if (!map) {
      const newMap = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/streets-v11",
        center: [120.9882053036898, 14.693467677226026],
        zoom: 12,
      });

      newMap.on("load", () => {
        setMap(newMap);
      });
    }
  }, [map]);

  // Fetch stations and update markers
  useEffect(() => {
    if (!map) return;

    markers.forEach((marker) => marker.remove());

    const fetchStations = async () => {
      try {
        const snapshot = await getDocs(collection(db, "stations"));
        const adminsSnapshot = await getDocs(collection(db, "admins"));

        const adminMap = {};
        adminsSnapshot.docs.forEach((doc) => {
          const adminData = doc.data();
          adminMap[doc.id] = {
            name: adminData.name,
            profilePhoto: adminData.profilePhoto,
          };
        });

        const newMarkers = [];
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const tanodAssigned = data.tanodAssigned || [];
          const tanodArray = Array.isArray(tanodAssigned)
            ? tanodAssigned
            : [tanodAssigned];

          const stationData = {
            id: doc.id,
            ...data,
            tanodAssigned: tanodArray,
            tanodAssignedName: tanodArray
              .map((adminId) => adminMap[adminId]?.name || "Unknown")
              .join(", "),
            tanodAssignedAvatar: tanodArray
              .map((adminId) => adminMap[adminId]?.profilePhoto)
              .filter((photo) => photo),
          };

          if (
            stationData.coordinates &&
            Array.isArray(stationData.coordinates) &&
            stationData.coordinates.length === 2
          ) {
            const markerElement = document.createElement("div");
            markerElement.className = "custom-marker";

            // Create container for station name
            const nameContainer = document.createElement("div");
            nameContainer.className = "station-name";
            nameContainer.textContent = stationData.stationName;
            markerElement.appendChild(nameContainer);

            // Create and append the marker image
            const markerImage = document.createElement("img");
            markerImage.src = bikeIcon;
            markerImage.className = "marker-icon";
            markerElement.appendChild(markerImage);

            // Add click handler
            markerElement.addEventListener("click", () => {
              setSelectedStation(stationData);
              setShowModal(true);
            });

            const marker = new mapboxgl.Marker(markerElement)
              .setLngLat([
                stationData.coordinates[1],
                stationData.coordinates[0],
              ])
              .addTo(map);

            newMarkers.push(marker);
          }
        });

        setMarkers(newMarkers);

        // Fit map bounds
        if (newMarkers.length > 0) {
          const bounds = new mapboxgl.LngLatBounds();
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (
              data.coordinates &&
              Array.isArray(data.coordinates) &&
              data.coordinates.length === 2
            ) {
              bounds.extend([data.coordinates[1], data.coordinates[0]]);
            }
          });
          map.fitBounds(bounds, { padding: 50 });
        }
      } catch (error) {
        console.error("Error fetching stations:", error);
      }
    };

    fetchStations();

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [map]);

  const fetchAvailableBikes = async () => {
    const bikesSnapshot = await getDocs(collection(db, "bikes"));
    const bikes = bikesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setAvailableBikes(bikes);
  };

  const fetchAdmins = async () => {
    try {
      const adminSnapshot = await getDocs(collection(db, "admins"));
      const allAdmins = adminSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAdmins(allAdmins);
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const StationModal = ({ station, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [showRemoveBikes, setShowRemoveBikes] = useState(false);
    const [showAddBikes, setShowAddBikes] = useState(false);
    const [selectedBikesToRemove, setSelectedBikesToRemove] = useState([]);
    const [selectedBikesToAdd, setSelectedBikesToAdd] = useState([]);
    const [stationBikes, setStationBikes] = useState([]);
    const [unassignedBikes, setUnassignedBikes] = useState([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [showBikeActions, setShowBikeActions] = useState(false);
    const [showRegularBikeActions, setShowRegularBikeActions] = useState(false);
    const [showEBikeActions, setShowEBikeActions] = useState(false);
    const [bikeTypeToShow, setBikeTypeToShow] = useState(null); // 'Regular' or 'Electric'
    const [showAdminActions, setShowAdminActions] = useState(false);
    const [unassignedAdmins, setUnassignedAdmins] = useState([]);
    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [showRemoveAdmin, setShowRemoveAdmin] = useState(false);
    const [selectedAdminToRemove, setSelectedAdminToRemove] = useState(null);
    const [selectedAdmins, setSelectedAdmins] = useState([]);

    useEffect(() => {
      fetchStationBikes();
      fetchUnassignedBikes();
      fetchUnassignedAdmins();
    }, [station.id]);

    const fetchStationBikes = async () => {
      try {
        const bikesSnapshot = await getDocs(collection(db, "bikes"));
        const bikes = bikesSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((bike) => bike.stationAssigned === station.id);
        setStationBikes(bikes);
      } catch (error) {
        console.error("Error fetching station bikes:", error);
      }
    };

    const fetchUnassignedBikes = async () => {
      try {
        const bikesSnapshot = await getDocs(collection(db, "bikes"));
        const bikes = bikesSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((bike) => !bike.stationAssigned);
        setUnassignedBikes(bikes);
      } catch (error) {
        console.error("Error fetching unassigned bikes:", error);
      }
    };

    const fetchUnassignedAdmins = async () => {
      try {
        const adminsSnapshot = await getDocs(collection(db, "admins"));
        const admins = adminsSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          // Filter out admins that are already assigned to this station
          .filter(
            (admin) =>
              !station.tanodAssigned?.includes(admin.id) &&
              !admin.stationAssignedTo
          );
        setUnassignedAdmins(admins);
      } catch (error) {
        console.error("Error fetching unassigned admins:", error);
      }
    };

    const handleSaveRemove = async () => {
      try {
        setLoading(true);
        const updates = selectedBikesToRemove.map((bikeId) =>
          updateDoc(doc(db, "bikes", bikeId), {
            stationAssigned: null,
          })
        );
        await Promise.all(updates);
        setShowRemoveBikes(false);
        setSelectedBikesToRemove([]);
        fetchStationBikes();
      } catch (error) {
        console.error("Error removing bikes:", error);
        alert("Failed to remove bikes");
      } finally {
        setLoading(false);
      }
    };

    const handleSaveAdd = async () => {
      try {
        setLoading(true);
        const updates = selectedBikesToAdd.map((bikeId) =>
          updateDoc(doc(db, "bikes", bikeId), {
            stationAssigned: station.id,
          })
        );
        await Promise.all(updates);
        setShowAddBikes(false);
        setSelectedBikesToAdd([]);
        fetchStationBikes();
      } catch (error) {
        console.error("Error adding bikes:", error);
        alert("Failed to add bikes");
      } finally {
        setLoading(false);
      }
    };

    const handleAssignAdmins = async (adminIds) => {
      try {
        setLoading(true);
        // Get current assigned admins array
        const currentAdmins = station.tanodAssigned || [];

        // Update station's tanodAssigned array
        await updateDoc(doc(db, "stations", station.id), {
          tanodAssigned: [...currentAdmins, ...adminIds],
        });

        // Update each admin's stationAssignedTo
        const adminUpdates = adminIds.map((adminId) =>
          updateDoc(doc(db, "admins", adminId), {
            stationAssignedTo: station.id,
          })
        );

        await Promise.all(adminUpdates);
        setShowAdminActions(false);
        window.location.reload();
      } catch (error) {
        console.error("Error assigning admins:", error);
        alert("Failed to assign admins");
      } finally {
        setLoading(false);
      }
    };

    const handleRemoveAdmin = async (adminId) => {
      try {
        setLoading(true);
        // Get current assigned admins and filter out the one to remove
        const updatedAdmins = station.tanodAssigned.filter(
          (id) => id !== adminId
        );

        // Update station's tanodAssigned array
        await updateDoc(doc(db, "stations", station.id), {
          tanodAssigned: updatedAdmins,
        });

        // Update admin's stationAssignedTo
        await updateDoc(doc(db, "admins", adminId), {
          stationAssignedTo: null,
        });

        setShowAdminActions(false);
        window.location.reload();
      } catch (error) {
        console.error("Error removing admin:", error);
        alert("Failed to remove admin");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="map-modal-overlay">
        <div className="map-modal-content large">
          <div className="modal-header">
            <div className="station-header">
              <h2>{station.stationName}</h2>
              <p className="station-address">{station.stationAddress}</p>
            </div>
            <button className="close-button" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="modal-body">
            {/* Admin Section */}
            <div className="admin-section">
              <div className="count-card">
                <div className="count-header">
                  <h3>Station Admin</h3>
                  <button
                    className="edit-btn"
                    onClick={() => setShowAdminActions(!showAdminActions)}
                  >
                    <FaEdit />
                  </button>
                </div>
                {showAdminActions && (
                  <div className="action-dropdown">
                    <button
                      onClick={() => {
                        setShowAddAdmin(true);
                        setShowRemoveAdmin(false);
                        setShowAdminActions(false);
                        fetchUnassignedAdmins();
                      }}
                    >
                      Add Admin
                    </button>
                  </div>
                )}
              </div>

              <div className="admin-content">
                {showAddAdmin ? (
                  <div className="admin-list">
                    <h4>Select Admin to Assign</h4>
                    <div className="admin-grid">
                      {unassignedAdmins.map((admin) => (
                        <div key={admin.id} className="admin-card">
                          <input
                            type="checkbox"
                            className="admin-checkbox"
                            checked={selectedAdmins.includes(admin.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAdmins([
                                  ...selectedAdmins,
                                  admin.id,
                                ]);
                              } else {
                                setSelectedAdmins(
                                  selectedAdmins.filter((id) => id !== admin.id)
                                );
                              }
                            }}
                          />
                          <img
                            src={admin.profilePhoto || "/default-avatar.png"}
                            alt={admin.name}
                            className="admin-photo"
                          />
                          <span className="admin-name">{admin.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="action-buttons">
                      <button
                        className="save-btn"
                        onClick={() => {
                          if (selectedAdmins.length > 0) {
                            handleAssignAdmins(selectedAdmins);
                          }
                        }}
                        disabled={selectedAdmins.length === 0 || loading}
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        className="discard-btn"
                        onClick={() => {
                          setShowAddAdmin(false);
                          setSelectedAdmins([]);
                        }}
                      >
                        Discard Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  // Show current assigned admin(s)
                  <div className="admin-profile">
                    {Array.isArray(station.tanodAssigned) &&
                    station.tanodAssigned.length > 0 ? (
                      station.tanodAssigned.map((adminId) => {
                        const adminData = admins.find((a) => a.id === adminId);
                        return (
                          <div key={adminId} className="admin-avatar">
                            <img
                              src={
                                adminData?.profilePhoto || "/default-avatar.png"
                              }
                              alt={adminData?.name}
                            />
                            <span>{adminData?.name || "Unknown Admin"}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="no-admin">
                        <span>No Admin Assigned</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bikes Section */}
            <div className="bikes-section">
              <div className="bikes-header-section">
                <h3>Station Bikes</h3>

                {/* Move counts section here */}
                <div className="counts-section">
                  <div className="count-cards">
                    <div className="count-card">
                      <div className="count-header">
                        <span>
                          Regular Bikes:{" "}
                          {
                            stationBikes.filter(
                              (bike) => bike.bikeCategory === "Regular Bicycle"
                            ).length
                          }
                        </span>
                        <button
                          className="edit-btn"
                          onClick={() =>
                            setShowRegularBikeActions(!showRegularBikeActions)
                          }
                        >
                          <FaEdit />
                        </button>
                      </div>
                      {showRegularBikeActions && (
                        <div className="action-dropdown">
                          <button
                            onClick={() => {
                              setShowAddBikes(true);
                              setShowRemoveBikes(false);
                              setBikeTypeToShow("Regular");
                              setShowRegularBikeActions(false);
                            }}
                          >
                            Add Bikes
                          </button>
                          <button
                            onClick={() => {
                              setShowRemoveBikes(true);
                              setShowAddBikes(false);
                              setBikeTypeToShow("Regular");
                              setShowRegularBikeActions(false);
                            }}
                          >
                            Remove Bikes
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="count-card">
                      <div className="count-header">
                        <span>
                          E-Bikes:{" "}
                          {
                            stationBikes.filter(
                              (bike) => bike.bikeCategory === "Electric Bicycle"
                            ).length
                          }
                        </span>
                        <button
                          className="edit-btn"
                          onClick={() => setShowEBikeActions(!showEBikeActions)}
                        >
                          <FaEdit />
                        </button>
                      </div>
                      {showEBikeActions && (
                        <div className="action-dropdown">
                          <button
                            onClick={() => {
                              setShowAddBikes(true);
                              setShowRemoveBikes(false);
                              setBikeTypeToShow("Electric");
                              setShowEBikeActions(false);
                            }}
                          >
                            Add E-Bikes
                          </button>
                          <button
                            onClick={() => {
                              setShowRemoveBikes(true);
                              setShowAddBikes(false);
                              setBikeTypeToShow("Electric");
                              setShowEBikeActions(false);
                            }}
                          >
                            Remove E-Bikes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bikes-content">
                <div className="bikes-grid">
                  {(showRemoveBikes || showAddBikes
                    ? showRemoveBikes
                      ? stationBikes.filter((bike) =>
                          bikeTypeToShow === "Regular"
                            ? bike.bikeCategory === "Regular Bicycle"
                            : bike.bikeCategory === "Electric Bicycle"
                        )
                      : unassignedBikes.filter((bike) =>
                          bikeTypeToShow === "Regular"
                            ? bike.bikeCategory === "Regular Bicycle"
                            : bike.bikeCategory === "Electric Bicycle"
                        )
                    : stationBikes
                  )
                    .slice(currentPage * 6, (currentPage + 1) * 6)
                    .map((bike) => (
                      <div key={bike.id} className="bike-card">
                        {(showRemoveBikes || showAddBikes) && (
                          <input
                            type="checkbox"
                            className="bike-checkbox"
                            checked={
                              showRemoveBikes
                                ? selectedBikesToRemove.includes(bike.id)
                                : selectedBikesToAdd.includes(bike.id)
                            }
                            onChange={(e) => {
                              const setSelected = showRemoveBikes
                                ? setSelectedBikesToRemove
                                : setSelectedBikesToAdd;
                              const selectedBikes = showRemoveBikes
                                ? selectedBikesToRemove
                                : selectedBikesToAdd;

                              if (e.target.checked) {
                                setSelected([...selectedBikes, bike.id]);
                              } else {
                                setSelected(
                                  selectedBikes.filter((id) => id !== bike.id)
                                );
                              }
                            }}
                          />
                        )}
                        <img
                          src={bike.imageUrl || "/default-bike.png"}
                          alt={bike.bikeName}
                        />
                        <div className="bike-info">
                          <span className="bike-id">{bike.bikeId}</span>
                          <span className="bike-name">{bike.bikeName}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bikes-footer">
                {/* Pagination */}
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                    disabled={currentPage === 0}
                    className="page-btn"
                  >
                    <FaChevronLeft />
                  </button>
                  <span>Page {currentPage + 1}</span>
                  <button
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                    disabled={
                      (currentPage + 1) * 6 >=
                      (showRemoveBikes
                        ? stationBikes.length
                        : showAddBikes
                        ? unassignedBikes.length
                        : stationBikes.length)
                    }
                    className="page-btn"
                  >
                    <FaChevronRight />
                  </button>
                </div>

                {/* Add Save/Discard buttons */}
                {(showRemoveBikes || showAddBikes) && (
                  <div className="action-buttons">
                    <button
                      className="save-btn"
                      onClick={
                        showRemoveBikes ? handleSaveRemove : handleSaveAdd
                      }
                      disabled={
                        loading ||
                        (showRemoveBikes
                          ? selectedBikesToRemove.length === 0
                          : selectedBikesToAdd.length === 0)
                      }
                    >
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      className="discard-btn"
                      onClick={() => {
                        setShowRemoveBikes(false);
                        setShowAddBikes(false);
                        setSelectedBikesToRemove([]);
                        setSelectedBikesToAdd([]);
                        setBikeTypeToShow(null);
                      }}
                    >
                      Discard Changes
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="map-container">
      <div id="map" className="map-element" />
      {showModal && (
        <StationModal
          station={selectedStation}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default LiveMap;

// In StationManagement.jsx, update the LiveMap component usage
<LiveMap
  onEditStation={(station) => {
    handleEdit(station);
    // Additional logic if needed
  }}
/>;
