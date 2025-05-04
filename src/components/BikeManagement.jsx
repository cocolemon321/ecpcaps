import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import axios from "axios";
import Layout from "./Layout";
import ContentHeader from "./ContentHeader"; // Import the ContentHeader component
import "../styles/BikeManagement.css";
import { FaPlus, FaEdit, FaUpload } from "react-icons/fa";
import QRCode from "qrcode"; // Import qrcode library for generating QR codes
import { jsPDF } from "jspdf"; // Import jsPDF for creating PDF files

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

  useEffect(() => {
    fetchBikes();
  }, []);

  const fetchBikes = async () => {
    const querySnapshot = await getDocs(collection(db, "bikes"));
    const bikeList = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setBikes(bikeList);
  };

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

  const uploadImage = async () => {
    if (!bikePhoto) return null;
    const formData = new FormData();
    formData.append("bikePhoto", bikePhoto);

    try {
      const response = await axios.post(
        "http://192.168.6.200:4000/api/upload-bike-photo",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data.bikePhotoUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

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
      bikeStatus: "Available", // Default status
      isAvailable: true, // Default availability
      createdAt: new Date(), // Add timestamp for tracking
    };

    try {
      await addDoc(collection(db, "bikes"), newBike);
      alert("Bike added successfully!");
      setBikes([...bikes, newBike]);
      setShowAddModal(false);
      resetForm();
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
      fetchBikes();
      resetForm();
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
      const updatedBike = { bikeStatus: newStatus };
      await updateDoc(doc(db, "bikes", bikeId), updatedBike);
      alert("Bike status updated!");
      fetchBikes();
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

  const indexOfLastBike = currentPage * bikesPerPage;
  const indexOfFirstBike = indexOfLastBike - bikesPerPage;
  const totalPages = Math.ceil(bikes.length / bikesPerPage);

  // Add this function at the top of your component
  const getBikeTotals = () => {
    const regularBikes = bikes.filter(
      (bike) => bike.bikeCategory === "Regular Bicycle"
    ).length;
    const electricBikes = bikes.filter(
      (bike) => bike.bikeCategory === "Electric Bicycle"
    ).length;
    return { regularBikes, electricBikes };
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
          <button
            className="add-bike-btn"
            onClick={() => setShowAddModal(true)}
          >
            <FaPlus /> Add Bike
          </button>
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
          <div className="stat-card">
            <h3>Regular Bikes</h3>
            <p>{getBikeTotals().regularBikes}</p>
          </div>
          <div className="stat-card">
            <h3>Electric Bikes</h3>
            <p>{getBikeTotals().electricBikes}</p>
          </div>
        </div>

        {/* Bike List Table */}
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
              {bikes
                .filter(
                  (bike) =>
                    bike.bikeId.toUpperCase().includes(search) &&
                    (sortBy === "all" ||
                      (sortBy === "Regular Bicycle" &&
                        bike.bikeCategory === "Regular Bicycle") ||
                      (sortBy === "Electric Bicycle" &&
                        bike.bikeCategory === "Electric Bicycle") ||
                      bike.bikeStatus === sortBy) // Add this line for status filtering
                )
                .slice(indexOfFirstBike, indexOfLastBike)
                .map((bike) => (
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
                      <button
                        className="edit-btn"
                        onClick={(event) => handleEdit(bike, event)}
                      >
                        <FaEdit />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
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
      </div>
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
    </Layout>
  );
};

export default BikeManagement;
