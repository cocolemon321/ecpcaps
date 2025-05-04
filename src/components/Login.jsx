// src/components/Login.jsx
import React, { useState } from "react";
import { auth, signInWithEmailAndPassword } from "../firebase";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      {/* Circle Background for Logo */}
      <div className="login-logo-container">
        <img
          src={import.meta.env.BASE_URL + "assets/ecoridelogo2.png"}
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
    </div>
  );
};

export default Login;
