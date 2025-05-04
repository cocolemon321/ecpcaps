import axios from "axios";

export const uploadBikePhoto = async (file, fieldName) => {
  try {
    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await axios.post("http://localhost:4000/api/upload-bike-photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return response.data[fieldName === "bikePhoto" ? "bikePhotoUrl" : "ebikePhotoUrl"];
  } catch (error) {
    console.error("Error uploading bike photo:", error);
    throw error;
  }
};
