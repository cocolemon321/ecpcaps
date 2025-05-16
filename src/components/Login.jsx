// src/components/Login.jsx
import React, { useState } from "react";
import { auth, signInWithEmailAndPassword } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  const getAssetPath = (filename) => {
    return import.meta.env.DEV
      ? `/assets/${filename}`
      : `/ecpcaps/assets/${filename}`;
  };

  const showSnackbar = (message) => {
    setSnackbar({ open: true, message });
    setTimeout(() => setSnackbar({ open: false, message: "" }), 3000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      // Check if user is in super_admins collection
      const superAdminDoc = await getDoc(doc(db, "super_admins", user.uid));
      if (!superAdminDoc.exists()) {
        showSnackbar("You are not authorized as a Super Admin.");
        await signOut(auth);
        return;
      }
      navigate("/dashboard");
    } catch (err) {
      showSnackbar(err.message);
    }
  };

  return (
    <div className="login-container">
      {/* Circle Background for Logo */}
      <div className="login-logo-container">
        <img
          src={getAssetPath("ecoridelogo2.png")}
          alt="Eco Ride Logo"
          className="login-logo"
        />
      </div>
      <p className="login-subtitle">Drive Green, Ride Clean!</p>

      <h2 className="login-title">Super Admin Login</h2>

      <form className="login-form" onSubmit={handleLogin}>
        {error && <p className="error">{error}</p>}

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="login-button">
          LOG IN
        </button>
      </form>
      {snackbar.open && <div className="snackbar">{snackbar.message}</div>}
    </div>
  );
};

export default Login;
