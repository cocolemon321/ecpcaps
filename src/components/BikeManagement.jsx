import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Layout from "./Layout";
import ContentHeader from "./ContentHeader"; // Import the ContentHeader component
import "../styles/BikeManagement.css";
import { FaPlus, FaEdit, FaUpload, FaTimes } from "react-icons/fa";
import QRCode from "qrcode"; // Import qrcode library for generating QR codes
import { jsPDF } from "jspdf"; // Import jsPDF for creating PDF files
import { logAdminAction } from "../utils/logAdminAction";

const BikeManagement = () => {
  const [bikeStatus, setBikeStatus] = useState("available");
  const [bikeType, setBikeType] = useState("bike");
  const [bikePhoto, setBikePhoto] = useState(null);
  const [bikes, setBikes] = useState([]);
  const [editingBike, setEditingBike] = useState(null);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false); // ✅ Add New Bike Modal
  const [showEditModal, setShowEditModal] = useState(false); // ✅ Edit Bike Modal
  const [selectedBike, setSelectedBike] = useState(null); // ✅ Selected bike for modal
  const [showDetailModal, setShowDetailModal] = useState(false); // ✅ Toggle detail modal
  const [bikeName, setBikeName] = useState("");
  const [bikeCategory, setBikeCategory] = useState("");
  const [sortBy, setSortBy] = useState("all"); // ✅ Default to "All Bikes"
  const [currentPage, setCurrentPage] = useState(1);
  const [bikesPerPage] = useState(10);
  const [unassignedBikes, setUnassignedBikes] = useState([]);
  const [selectedBikes, setSelectedBikes] = useState([]);
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [unassignedFilter, setUnassignedFilter] = useState("all");
  const [showBulkAddModal, setShowBulkAddModal] = useState(false); // New state for bulk add modal
  const [bulkQuantity, setBulkQuantity] = useState(1); // New state for bulk quantity
  const [bulkBikeType, setBulkBikeType] = useState(""); // New state for bulk bike type
  const [bulkBikeCategory, setBulkBikeCategory] = useState(""); // New state for bulk bike category
  const [bulkBikeName, setBulkBikeName] = useState(""); // New state for bulk bike name
  const [bulkBikes, setBulkBikes] = useState([]); // New state for preview bikes
  const [bulkPhotos, setBulkPhotos] = useState({}); // New state for storing photos
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockQuantity, setRestockQuantity] = useState(1);
  const [restockBike, setRestockBike] = useState(null);

  // Modify your useEffect to use a different ordering field temporarily
  useEffect(() => {
    const bikesRef = collection(db, "bikes");
    // Use bikeId as temporary ordering until all documents have createdAt
    const bikesQuery = query(bikesRef, orderBy("bikeId"));

    const unsubscribe = onSnapshot(bikesQuery, (snapshot) => {
      const bikeList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBikes(bikeList);

      const unassigned = bikeList.filter(
        (bike) => !bike.stationAssigned && bike.bikeStatus === "Available"
      );
      setUnassignedBikes(unassigned);
    });

    // Fetch stations
    const fetchStations = async () => {
      const stationsRef = collection(db, "stations");
      const unsubscribeStations = onSnapshot(stationsRef, (snapshot) => {
        const stationsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStations(stationsList);
      });

      return unsubscribeStations;
    };

    const unsubscribeStations = fetchStations();

    return () => {
      unsubscribe();
      unsubscribeStations.then((unsub) => unsub());
    };
  }, []);

  const handleFileChange = (e) => {
    setBikePhoto(e.target.files[0]);
  };

  const generateBikeId = () => {
    const regularBikeCount =
      bikes.filter((bike) => bike.bikeCategory === "Regular Bicycle").length +
      1;
    const electricBikeCount =
      bikes.filter((bike) => bike.bikeCategory === "Electric Bicycle").length +
      1;

    // Determine prefix based on category
    const prefix = bikeCategory === "Regular Bicycle" ? "BK" : "EBK";
    const count =
      bikeCategory === "Regular Bicycle" ? regularBikeCount : electricBikeCount;

    return `${prefix}-${String(count).padStart(3, "0")}`; // e.g., BK-001, EBK-001
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

  const uploadImage = async () => {
    if (!bikePhoto) return null;

    try {
      // Compress the image
      const compressedBlob = await compressImage(bikePhoto);

      // Create a unique filename
      const filename = `bikes/${Date.now()}_${bikePhoto.name}`;

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

  // Update your handleAddSubmit function to include createdAt
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const imageUrl = await uploadImage();
    if (!imageUrl) {
      alert("Image upload failed. Try again.");
      return;
    }

    const bikeId = generateBikeId();
    const newBike = {
      bikeId,
      bikeName,
      bikeCategory,
      bikeType,
      imageUrl,
      bikeStatus: "Available",
      isAvailable: true,
      createdAt: new Date(),
    };

    try {
      await addDoc(collection(db, "bikes"), newBike);
      alert("Bike added successfully!");
      setShowAddModal(false);
      resetForm();
      await logAdminAction({
        actionType: "ADD_BIKE",
        details: `Added bike: ${bikeId}`,
        targetCollection: "bikes",
        targetId: bikeId,
      });
    } catch (error) {
      console.error("Error adding bike:", error);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const imageUrl = await uploadImage();

    const updatedBike = {
      bikeName,
      bikeCategory,
      bikeType,
      bikeStatus,
      imageUrl: imageUrl || editingBike.imageUrl,
    };

    try {
      await updateDoc(doc(db, "bikes", editingBike.id), updatedBike);
      alert("Bike updated successfully!");
      setEditingBike(null);
      setShowEditModal(false);
      resetForm();
      await logAdminAction({
        actionType: "UPDATE_BIKE",
        details: `Updated bike: ${editingBike.bikeId}`,
        targetCollection: "bikes",
        targetId: editingBike.bikeId,
      });
    } catch (error) {
      console.error("Error updating bike:", error);
    }
  };

  // Update the handleEdit function to include all bike details
  const handleEdit = (bike, event) => {
    event.stopPropagation();
    setEditingBike(bike);
    // Set all the form values to match the selected bike
    setBikeName(bike.bikeName);
    setBikeCategory(bike.bikeCategory);
    setBikeType(bike.bikeType);
    setBikeStatus(bike.bikeStatus);
    setShowEditModal(true);
  };

  const handleStatusChange = async (bikeId, newStatus) => {
    try {
      // Find the bike to get the previous status
      const bike = bikes.find((b) => b.id === bikeId);
      const prevStatus = bike ? bike.bikeStatus : "Unknown";
      const updatedBike = { bikeStatus: newStatus };
      await updateDoc(doc(db, "bikes", bikeId), updatedBike);
      alert("Bike status updated!");
      await logAdminAction({
        actionType: "CHANGE_BIKE_STATUS",
        details: `Bike ${bike.bikeId} status changed from "${prevStatus}" to "${newStatus}"`,
        targetCollection: "bikes",
        targetId: bikeId,
      });
    } catch (error) {
      console.error("Error updating bike status:", error);
      alert("Failed to update bike status");
    }
  };

  // Also update the resetForm function to reset all fields
  const resetForm = () => {
    setBikeName("");
    setBikeCategory("");
    setBikeType("");
    setBikePhoto(null);
    setBikeStatus("Available"); // Reset to default status
    setEditingBike(null);
  };

  // QR Code generation function
  const generateQRCode = (bikeId) => {
    return <QRCode value={bikeId} size={100} />;
  };

  // Function to generate PDF with QR codes
  const generatePDF = async () => {
    const doc = new jsPDF(); // Create a new PDF document
    const qrSize = 40; // Adjusted size for QR codes
    const qrSpacing = 5; // Reduced spacing between QR codes
    const columnCount = 3; // Number of columns
    let xPosition = 10; // Starting X position for QR codes
    let yPosition = 10; // Starting Y position for QR codes

    // Loop through each bike and generate a QR code using the document UID (bike.id)
    for (let index = 0; index < bikes.length; index++) {
      const bike = bikes[index];

      try {
        // Generate the QR code using the Firestore Document UID (bike.id) as the value
        const qrImageData = await QRCode.toDataURL(bike.id, {
          type: "image/jpeg",
        }); // bike.id is the Firestore Document UID

        if (qrImageData) {
          // Add Bike ID text to the PDF (adjusting the position to make space for QR codes)
          doc.text(
            `Bike ID: ${bike.bikeId}`,
            xPosition,
            yPosition + qrSize + 5
          );

          // Add the QR code image to the PDF
          doc.addImage(
            qrImageData,
            "JPEG",
            xPosition,
            yPosition,
            qrSize,
            qrSize
          ); // Adjust QR code size as needed

          // Update x and y positions
          xPosition += qrSize + qrSpacing; // Move to the next column

          // After 3 columns, move to the next row
          if ((index + 1) % columnCount === 0) {
            xPosition = 10; // Reset to the first column
            yPosition += qrSize + 20; // Move down to the next row
          }

          // Add a new page if the yPosition exceeds the page height
          if (yPosition + qrSize + 20 > doc.internal.pageSize.height) {
            doc.addPage();
            xPosition = 10;
            yPosition = 10;
          }
        } else {
          console.error("QR code generation failed for bike:", bike.bikeId);
        }
      } catch (error) {
        console.error("Error generating QR code: ", error);
      }
    }

    // Save the generated PDF
    doc.save("bike_qr_codes.pdf"); // This will trigger the download of the PDF
  };

  const handleSearch = (e) => {
    setSearch(e.target.value.toUpperCase());
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleSort = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  // First, create a filtered bikes array before pagination
  const filteredBikes = bikes.filter(
    (bike) =>
      bike.bikeId.toUpperCase().includes(search) &&
      (sortBy === "all" ||
        (sortBy === "Regular Bicycle" &&
          bike.bikeCategory === "Regular Bicycle") ||
        (sortBy === "Electric Bicycle" &&
          bike.bikeCategory === "Electric Bicycle") ||
        bike.bikeStatus === sortBy)
  );

  // Update the pagination calculations to use filtered bikes
  const totalPages = Math.ceil(filteredBikes.length / bikesPerPage);
  const indexOfLastBike = currentPage * bikesPerPage;
  const indexOfFirstBike = indexOfLastBike - bikesPerPage;
  const paginatedBikes = filteredBikes.slice(indexOfFirstBike, indexOfLastBike);

  // Update the getBikeTotals function
  const getBikeTotals = () => {
    return {
      regularBikes: bikes.filter(
        (bike) => bike.bikeCategory === "Regular Bicycle"
      ).length,
      electricBikes: bikes.filter(
        (bike) => bike.bikeCategory === "Electric Bicycle"
      ).length,
      available: bikes.filter((bike) => bike.bikeStatus === "Available").length,
      inUse: bikes.filter((bike) => bike.bikeStatus === "In Use").length,
      toRepair: bikes.filter((bike) => bike.bikeStatus === "To Repair").length,
      toReplace: bikes.filter((bike) => bike.bikeStatus === "To Replace")
        .length,
      retired: bikes.filter((bike) => bike.bikeStatus === "Retired").length,
    };
  };

  // Handle bike selection
  const handleBikeSelection = (bikeId) => {
    setSelectedBikes((prev) => {
      if (prev.includes(bikeId)) {
        return prev.filter((id) => id !== bikeId);
      }
      return [...prev, bikeId];
    });
  };

  // Handle assign to station
  const handleAssignToStation = async () => {
    if (!selectedStation || selectedBikes.length === 0) {
      alert("Please select a station and at least one bike");
      return;
    }

    try {
      const updates = selectedBikes.map((bikeId) =>
        updateDoc(doc(db, "bikes", bikeId), {
          stationAssigned: selectedStation,
        })
      );

      await Promise.all(updates);
      setSelectedBikes([]);
      setSelectedStation("");
      setShowAssignModal(false);
    } catch (error) {
      console.error("Error assigning bikes:", error);
      alert("Failed to assign bikes to station");
    }
  };

  const getFilteredUnassignedBikes = () => {
    return unassignedBikes.filter((bike) => {
      if (unassignedFilter === "all") return true;
      return bike.bikeCategory === unassignedFilter;
    });
  };

  // Add new function to handle individual photo upload
  const handleBulkPhotoUpload = async (bikeId, file) => {
    try {
      const compressedBlob = await compressImage(file);
      const filename = `bikes/${Date.now()}_${file.name}`;
      const storage = getStorage();
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, compressedBlob);
      const downloadURL = await getDownloadURL(storageRef);

      setBulkPhotos((prev) => ({
        ...prev,
        [bikeId]: downloadURL,
      }));
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo");
    }
  };

  // Modify handleBulkAddSubmit to include photos
  const handleBulkAddSubmit = async (e) => {
    e.preventDefault();

    try {
      const newBikes = bulkBikes.map((bike) => ({
        ...bike,
        imageUrl: bulkPhotos[bike.bikeId] || null,
      }));

      // Add all bikes to Firestore
      const addPromises = newBikes.map((bike) =>
        addDoc(collection(db, "bikes"), bike)
      );
      await Promise.all(addPromises);

      alert(`${bulkQuantity} bikes added successfully!`);
      setShowBulkAddModal(false);
      resetBulkForm();
      await logAdminAction({
        actionType: "ADD_BIKE",
        details: `Added ${bulkQuantity} bikes`,
        targetCollection: "bikes",
        targetId: "bulk",
      });
    } catch (error) {
      console.error("Error adding bikes in bulk:", error);
      alert("Failed to add bikes in bulk");
    }
  };

  // Add function to generate preview bikes
  const generateBulkBikes = () => {
    const regularBikeCount = bikes.filter(
      (bike) => bike.bikeCategory === "Regular Bicycle"
    ).length;
    const electricBikeCount = bikes.filter(
      (bike) => bike.bikeCategory === "Electric Bicycle"
    ).length;

    const newBikes = [];
    for (let i = 0; i < bulkQuantity; i++) {
      const prefix = bulkBikeCategory === "Regular Bicycle" ? "BK" : "EBK";
      const count =
        bulkBikeCategory === "Regular Bicycle"
          ? regularBikeCount + i + 1
          : electricBikeCount + i + 1;
      const bikeId = `${prefix}-${String(count).padStart(3, "0")}`;

      newBikes.push({
        bikeId,
        bikeName: `${bulkBikeName} ${String(count).padStart(3, "0")}`,
        bikeCategory: bulkBikeCategory,
        bikeType: bulkBikeType,
        bikeStatus: "Available",
        isAvailable: true,
        createdAt: new Date(),
      });
    }

    setBulkBikes(newBikes);
  };

  // Add effect to generate preview bikes when form changes
  useEffect(() => {
    if (bulkQuantity > 0 && bulkBikeCategory && bulkBikeType && bulkBikeName) {
      generateBulkBikes();
    }
  }, [bulkQuantity, bulkBikeCategory, bulkBikeType, bulkBikeName]);

  // Modify resetBulkForm to clear photos
  const resetBulkForm = () => {
    setBulkQuantity(1);
    setBulkBikeType("");
    setBulkBikeCategory("");
    setBulkBikeName("");
    setBulkBikes([]);
    setBulkPhotos({});
  };

  // Add this function after the handleBulkAddSubmit function
  const handleRestock = async (e) => {
    e.preventDefault();
    if (!restockBike || restockQuantity < 1) return;

    try {
      const regularBikeCount = bikes.filter(
        (bike) => bike.bikeCategory === restockBike.bikeCategory
      ).length;

      const newBikes = [];
      for (let i = 0; i < restockQuantity; i++) {
        const prefix =
          restockBike.bikeCategory === "Regular Bicycle" ? "BK" : "EBK";
        const count = regularBikeCount + i + 1;
        const bikeId = `${prefix}-${String(count).padStart(3, "0")}`;

        newBikes.push({
          bikeId,
          bikeName: restockBike.bikeName,
          bikeCategory: restockBike.bikeCategory,
          bikeType: restockBike.bikeType,
          bikeStatus: "Available",
          isAvailable: true,
          imageUrl: restockBike.imageUrl,
          createdAt: new Date(),
        });
      }

      // Add all bikes to Firestore
      const addPromises = newBikes.map((bike) =>
        addDoc(collection(db, "bikes"), bike)
      );
      await Promise.all(addPromises);

      alert(`${restockQuantity} bikes added successfully!`);
      setShowRestockModal(false);
      setRestockQuantity(1);
      setRestockBike(null);
      await logAdminAction({
        actionType: "RESTOCK_BIKE",
        details: `Added ${restockQuantity} bikes of type ${restockBike.bikeName}`,
        targetCollection: "bikes",
        targetId: "bulk",
      });
    } catch (error) {
      console.error("Error adding bikes:", error);
      alert("Failed to add bikes");
    }
  };

  return (
    <Layout>
      <ContentHeader title="Bike Management" />
      <div className="bike-management-container">
        <div className="bike-management-header">
          <h2>Bike Management</h2>
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="🔍 Search by Bike ID (e.g., BK-001)..."
            className="search-box"
            value={search}
            onChange={handleSearch}
          />
          <div className="button-group">
            <button
              className="bulk-add-btn"
              onClick={() => setShowBulkAddModal(true)}
            >
              <FaPlus /> Add Bikes
            </button>
          </div>

          <button className="generate-pdf-btn" onClick={generatePDF}>
            Generate QR (PDF)
          </button>
          <div className="sort-container">
            <label className="sort-label">Sort By:</label>
            <select
              value={sortBy}
              onChange={handleSort}
              className="sort-dropdown"
            >
              <option value="all">All Bikes</option>
              <option value="Regular Bicycle">Regular Bikes</option>
              <option value="Electric Bicycle">Electric Bikes</option>
              <optgroup label="Status">
                <option value="Available">Available</option>
                <option value="In Use">In Use</option>
                <option value="To Repair">To Repair</option>
                <option value="To Replace">To Replace</option>
                <option value="Retired">Retired</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Add/Edit Bike Modal */}
        {showAddModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Adding New Bike</h2>
              <form className="bike-form" onSubmit={handleAddSubmit}>
                {/* Upload Image */}
                <div className="upload-box">
                  <label className="upload-label">
                    <FaUpload /> Upload Bike Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      required
                    />
                  </label>
                </div>

                {/* Bike Name */}
                <label>Bike Name:</label>
                <input
                  type="text"
                  value={bikeName}
                  onChange={(e) => setBikeName(e.target.value)}
                  required
                />

                {/* Category of Bike */}
                <label>Category of Bike:</label>
                <select
                  value={bikeCategory}
                  onChange={(e) => setBikeCategory(e.target.value)}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="Regular Bicycle">Regular Bicycle</option>
                  <option value="Electric Bicycle">Electric Bicycle</option>
                </select>

                {/* Bike Type */}
                <label>Bike Type:</label>
                <select
                  value={bikeType}
                  onChange={(e) => setBikeType(e.target.value)}
                  required
                >
                  <option value="">Select Bike Type</option>
                  <option value="Road Bike">Road Bike</option>
                  <option value="Mountain Bike">Mountain Bike</option>
                  <option value="City Bike">City Bike</option>
                  <option value="Fat Bike">Fat Bike</option>
                  <option value="BMX">BMX</option>
                  <option value="Electric Bike">Electric Bike</option>
                </select>

                {/* Buttons */}
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

        {/* Update the return JSX - Add this after the search-container div */}
        <div className="bike-stats-overlay">
          <div className="stats-row">
            <div className="stat-card regular">
              <h3>Regular Bikes</h3>
              <p>{getBikeTotals().regularBikes}</p>
            </div>
            <div className="stat-card electric">
              <h3>Electric Bikes</h3>
              <p>{getBikeTotals().electricBikes}</p>
            </div>
            <div className="stat-card available">
              <h3>Available</h3>
              <p>{getBikeTotals().available}</p>
            </div>
            <div className="stat-card in-use">
              <h3>In Use</h3>
              <p>{getBikeTotals().inUse}</p>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-card repair">
              <h3>To Repair</h3>
              <p>{getBikeTotals().toRepair}</p>
            </div>
            <div className="stat-card replace">
              <h3>To Replace</h3>
              <p>{getBikeTotals().toReplace}</p>
            </div>
            <div className="stat-card retired">
              <h3>Retired</h3>
              <p>{getBikeTotals().retired}</p>
            </div>
            <div className="stat-card total">
              <h3>Total Bikes</h3>
              <p>{bikes.length}</p>
            </div>
          </div>
        </div>

        {/* Bike List Table with integrated pagination */}
        <div className="bike-list">
          <table>
            <thead>
              <tr>
                <th>Bike Name</th>
                <th>Bike ID</th>
                <th>Category</th>
                <th>Type</th>
                <th>Image</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBikes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-results">
                    No bikes found matching your criteria
                  </td>
                </tr>
              ) : (
                paginatedBikes.map((bike) => (
                  <tr
                    key={bike.id}
                    onClick={() => {
                      setSelectedBike(bike);
                      setShowDetailModal(true);
                    }}
                    className="clickable-row"
                  >
                    <td>{bike.bikeName || "No Name"}</td>
                    <td>
                      <strong>{bike.bikeId}</strong>
                    </td>
                    <td>{bike.bikeCategory}</td>
                    <td>{bike.bikeType}</td>
                    <td>
                      <img
                        src={bike.imageUrl}
                        alt={bike.bikeName}
                        className="table-bike-image"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBike(bike);
                          setShowDetailModal(true);
                        }}
                      />
                    </td>
                    <td>
                      <div
                        className={`status-container status-${bike.bikeStatus.replace(
                          /\s+/g,
                          "-"
                        )}`}
                      >
                        {bike.bikeStatus}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="edit-btn"
                          onClick={(event) => handleEdit(bike, event)}
                        >
                          <FaEdit />
                        </button>
                        <button
                          className="restock-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            setRestockBike(bike);
                            setShowRestockModal(true);
                          }}
                        >
                          Restock
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Only show pagination if there are bikes */}
          {filteredBikes.length > 0 && (
            <div className="pagination-controls">
              <button
                className="pagination-button"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="pagination-button"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Bike Details Modal */}
        {showDetailModal && selectedBike && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Bike Details</h2>

              <div className="bike-image-container">
                <img
                  src={selectedBike.imageUrl}
                  alt="Bike"
                  className="bike-preview"
                />
              </div>

              <p>
                <strong>Bike Name:</strong> {selectedBike.bikeName}
              </p>
              <p>
                <strong>Bike ID:</strong> {selectedBike.bikeId}
              </p>
              <p>
                <strong>Category:</strong> {selectedBike.bikeCategory}
              </p>
              <p>
                <strong>Bike Type:</strong> {selectedBike.bikeType}
              </p>
              <p>
                <strong>Status:</strong> {selectedBike.bikeStatus}
              </p>

              <div className="modal-buttons">
                <button
                  className="cancel-btn"
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Bike Modal */}
        {showEditModal && editingBike && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Edit Bike</h2>
              <form className="bike-form" onSubmit={handleEditSubmit}>
                <div className="upload-box">
                  <label className="upload-label">
                    <FaUpload /> Upload New Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                  {editingBike.imageUrl && (
                    <img
                      src={editingBike.imageUrl}
                      alt="Current Bike"
                      className="bike-preview"
                    />
                  )}
                </div>

                <label>Bike Name:</label>
                <input
                  type="text"
                  value={bikeName}
                  onChange={(e) => setBikeName(e.target.value)}
                  required
                />

                <label>Category of Bike:</label>
                <select
                  value={bikeCategory}
                  onChange={(e) => setBikeCategory(e.target.value)}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="Regular Bicycle">Regular Bicycle</option>
                  <option value="Electric Bicycle">Electric Bicycle</option>
                </select>

                <label>Bike Type:</label>
                <select
                  value={bikeType}
                  onChange={(e) => setBikeType(e.target.value)}
                  required
                >
                  <option value="">Select Bike Type</option>
                  <option value="Road Bike">Road Bike</option>
                  <option value="Mountain Bike">Mountain Bike</option>
                  <option value="City Bike">City Bike</option>
                  <option value="Fat Bike">Fat Bike</option>
                  <option value="BMX">BMX</option>
                  <option value="Electric Bike">Electric Bike</option>
                </select>

                <label>Status:</label>
                <select
                  value={bikeStatus}
                  onChange={(e) => setBikeStatus(e.target.value)}
                  required
                >
                  <option value="Available">Available</option>
                  <option value="To Repair">To Repair</option>
                  <option value="To Replace">To Replace</option>
                  <option value="Retired">Retired</option>
                </select>

                <div className="modal-buttons">
                  <button type="submit" className="save-btn">
                    Update
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowEditModal(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add this before the unassigned-bikes-section */}
        <div className="unassigned-inventory-card">
          <div className="inventory-stats">
            <div className="inventory-total">
              <h3>Unassigned Bikes Inventory</h3>
              <div className="total-count">{unassignedBikes.length}</div>
            </div>
            <div className="inventory-breakdown">
              <div className="inventory-item">
                <span>Regular Bikes:</span>
                <span>
                  {
                    unassignedBikes.filter(
                      (bike) => bike.bikeCategory === "Regular Bicycle"
                    ).length
                  }
                </span>
              </div>
              <div className="inventory-item">
                <span>Electric Bikes:</span>
                <span>
                  {
                    unassignedBikes.filter(
                      (bike) => bike.bikeCategory === "Electric Bicycle"
                    ).length
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Add Unassigned Bikes Section */}
        <div className="unassigned-bikes-section">
          <div className="unassigned-header">
            <h2>Unassigned Bikes</h2>
            <div className="unassigned-filters">
              <select
                value={unassignedFilter}
                onChange={(e) => setUnassignedFilter(e.target.value)}
                className="filter-dropdown"
              >
                <option value="all">All Categories</option>
                <option value="Regular Bicycle">Regular Bikes</option>
                <option value="Electric Bicycle">Electric Bikes</option>
              </select>
              <button
                className="assign-button"
                disabled={selectedBikes.length === 0}
                onClick={() => setShowAssignModal(true)}
              >
                Assign Selected Bikes ({selectedBikes.length})
              </button>
            </div>
          </div>
          <div className="unassigned-bikes-grid">
            {getFilteredUnassignedBikes().map((bike) => (
              <div
                key={bike.id}
                className={`bike-card ${
                  selectedBikes.includes(bike.id) ? "selected" : ""
                }`}
                onClick={() => handleBikeSelection(bike.id)}
              >
                <img src={bike.imageUrl} alt={bike.bikeName} />
                <div className="bike-info">
                  <h3>{bike.bikeName}</h3>
                  <p>ID: {bike.bikeId}</p>
                  <p>Category: {bike.bikeCategory}</p>
                  <p>Type: {bike.bikeType}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assign to Station Modal */}
        {showAssignModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Assign Bikes to Station</h2>
              <p>Selected Bikes: {selectedBikes.length}</p>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                required
              >
                <option value="">Select Station</option>
                {stations.map((station) => (
                  <option key={station.id} value={station.id}>
                    {station.stationName}
                  </option>
                ))}
              </select>
              <div className="modal-buttons">
                <button className="save-btn" onClick={handleAssignToStation}>
                  Assign
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Bulk Add Modal */}
        {showBulkAddModal && (
          <div className="modal-overlay">
            <div className="modal-content bulk-add-modal">
              <div className="modal-header">
                <h2>Add Bikes</h2>
                <button
                  className="close-modal-btn"
                  onClick={() => {
                    setShowBulkAddModal(false);
                    resetBulkForm();
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <form className="bike-form" onSubmit={handleBulkAddSubmit}>
                <div className="bulk-form-fields">
                  <label>Base Bike Name:</label>
                  <input
                    type="text"
                    value={bulkBikeName}
                    onChange={(e) => setBulkBikeName(e.target.value)}
                    placeholder="e.g., EcoRide Bike"
                    required
                  />

                  <label>Category of Bike:</label>
                  <select
                    value={bulkBikeCategory}
                    onChange={(e) => setBulkBikeCategory(e.target.value)}
                    required
                  >
                    <option value="">Select Category</option>
                    <option value="Regular Bicycle">Regular Bicycle</option>
                    <option value="Electric Bicycle">Electric Bicycle</option>
                  </select>

                  <label>Bike Type:</label>
                  <select
                    value={bulkBikeType}
                    onChange={(e) => setBulkBikeType(e.target.value)}
                    required
                  >
                    <option value="">Select Bike Type</option>
                    <option value="Road Bike">Road Bike</option>
                    <option value="Mountain Bike">Mountain Bike</option>
                    <option value="City Bike">City Bike</option>
                    <option value="Fat Bike">Fat Bike</option>
                    <option value="BMX">BMX</option>
                    <option value="Electric Bike">Electric Bike</option>
                  </select>

                  <label>Quantity:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={bulkQuantity}
                    onChange={(e) => setBulkQuantity(parseInt(e.target.value))}
                    required
                  />
                </div>

                {/* Preview Grid */}
                <div className="bulk-preview-grid">
                  {bulkBikes.map((bike) => (
                    <div key={bike.bikeId} className="bulk-preview-item">
                      <div className="preview-image-container">
                        {bulkPhotos[bike.bikeId] ? (
                          <img
                            src={bulkPhotos[bike.bikeId]}
                            alt={bike.bikeName}
                          />
                        ) : (
                          <div className="upload-placeholder">
                            <label className="upload-label">
                              <FaPlus />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleBulkPhotoUpload(
                                    bike.bikeId,
                                    e.target.files[0]
                                  )
                                }
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      <div className="preview-info">
                        <h4>{bike.bikeName}</h4>
                        <p>{bike.bikeId}</p>
                        <p>{bike.bikeCategory}</p>
                        <p>{bike.bikeType}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modal-buttons">
                  <button type="submit" className="save-btn">
                    Create {bulkQuantity} Bikes
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowBulkAddModal(false);
                      resetBulkForm();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add the Restock Modal before the closing div of bike-management-container */}
        {showRestockModal && restockBike && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Add More Bikes</h2>
              <form onSubmit={handleRestock}>
                <div className="restock-info">
                  <p>
                    <strong>Bike Name:</strong> {restockBike.bikeName}
                  </p>
                  <p>
                    <strong>Category:</strong> {restockBike.bikeCategory}
                  </p>
                  <p>
                    <strong>Type:</strong> {restockBike.bikeType}
                  </p>
                </div>

                <div className="form-group">
                  <label>Quantity to Add:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={restockQuantity}
                    onChange={(e) =>
                      setRestockQuantity(parseInt(e.target.value))
                    }
                    required
                  />
                </div>

                <div className="modal-buttons">
                  <button type="submit" className="save-btn">
                    Add {restockQuantity} Bikes
                  </button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowRestockModal(false);
                      setRestockQuantity(1);
                      setRestockBike(null);
                    }}
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

export default BikeManagement;
