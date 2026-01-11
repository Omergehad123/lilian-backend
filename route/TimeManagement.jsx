import { useState, useEffect } from "react";
import "./TimeManagement.css"; // Same CSS as PromoManagement

const TimeManagement = () => {
  const [currentTime, setCurrentTime] = useState("19:00");
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const getToken = () => localStorage.getItem("dashboard_token");

  const apiFetch = async (url, options = {}) => {
    const token = getToken();
    const config = {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    if (response.status === 401) {
      alert("❌ Session expired. Please log in again.");
      localStorage.removeItem("dashboard_token");
      window.location.href = "/login";
      return;
    }
    return response;
  };

  // Fetch current pending orders count
  const fetchPendingOrders = async () => {
    try {
      const response = await apiFetch(
        "https://lilian-backend-7bjc.onrender.com/api/orders/admin/pending"
      );
      const data = await response.json();
      setPendingCount(data.count || 0);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  // Update admin start time (YOUR existing endpoint!)
  const updateAdminTime = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(
        "https://lilian-backend-7bjc.onrender.com/api/orders/admin/start-time",
        {
          method: "PATCH",
          body: JSON.stringify({ time: currentTime }),
        }
      );
      const result = await response.json();

      if (result.status === "success") {
        alert(
          `✅ Admin start time updated to ${currentTime}! ${
            result.count || 0
          } pending orders updated.`
        );
        await fetchPendingOrders();
      }
    } catch (error) {
      alert("❌ Failed to update time: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="promo-container">
      {/* HEADER */}
      <div className="promo-header">
        <h1>🕒 Admin Notification Time</h1>
        <div className="time-stats">
          <div className="pending-badge">
            📦 Pending Orders: <strong>{pendingCount}</strong>
          </div>
        </div>
      </div>

      {/* MAIN TIME CONTROL CARD */}
      <div className="promo-grid">
        <div className="promo-card time-control-card">
          <div className="time-control-header">
            <h3>🚀 Store Notification Time</h3>
            <p>Orders created now will notify store at this time</p>
          </div>

          <div className="time-input-group">
            <label>Start Time:</label>
            <div className="time-picker-wrapper">
              <input
                type="time"
                value={currentTime}
                onChange={(e) => setCurrentTime(e.target.value)}
                className="large-time-input"
              />
              <span className="time-label">{currentTime}</span>
            </div>
          </div>

          <div className="time-actions">
            <button
              onClick={updateAdminTime}
              disabled={loading}
              className="submit-button large"
            >
              {loading ? "⏳ Updating..." : `✅ Update to ${currentTime}`}
            </button>
            <button
              onClick={() => fetchPendingOrders()}
              className="refresh-button"
              disabled={loading}
            >
              🔄 Refresh ({pendingCount})
            </button>
          </div>

          <div className="time-info">
            <p>
              <strong>📋 How it works:</strong>
            </p>
            <ul>
              <li>Customer orders at 5 PM → Saved immediately</li>
              <li>At {currentTime} → Admin gets email</li>
              <li>
                <strong>{pendingCount}</strong> orders waiting right now
              </li>
            </ul>
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="promo-card quick-actions-card">
          <h3>⚡ Quick Actions</h3>
          <div className="quick-buttons">
            <button
              className="quick-btn notify-now"
              onClick={() => updateAdminTime("now")}
            >
              🚨 Notify Store NOW
            </button>
            <button
              className="quick-btn check-status"
              onClick={fetchPendingOrders}
            >
              📊 Check Pending ({pendingCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimeManagement;
