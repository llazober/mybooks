"use client";

import { useEffect, useState, useRef } from "react";
import { logout } from "./actions";

// Default configuration: 15 minutes total, 2 minute warning
const TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000;
const PROMPT_TIME = TIMEOUT_MS - WARNING_MS;

export default function IdleTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const lastActive = useRef(Date.now());
  // Prevent logging out multiple times simultaneously
  const isLoggingOut = useRef(false);

  useEffect(() => {
    function handleActivity() {
      // If warning is showing, do not auto-dismiss by random mouse movements.
      // The user must click the "Stay Logged In" button.
      if (!showWarning) {
        lastActive.current = Date.now();
      }
    }

    // Attach listeners
    const events = ["mousemove", "keydown", "touchstart", "scroll", "click"];
    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    // Check periodically instead of resetting timeouts on every mousemove
    const interval = window.setInterval(() => {
      if (isLoggingOut.current) return;
      
      const idleTime = Date.now() - lastActive.current;
      
      if (idleTime > TIMEOUT_MS) {
        isLoggingOut.current = true;
        logout().then(() => {
          window.location.href = "/";
        });
      } else if (idleTime > PROMPT_TIME && !showWarning) {
        setShowWarning(true);
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
      window.clearInterval(interval);
    };
  }, [showWarning]);

  if (!showWarning) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ textAlign: "center", maxWidth: "400px" }}>
        <h2 style={{ marginTop: 0 }}>Are you still there?</h2>
        <p className="muted">
          Your session will expire soon due to inactivity. Do you want to stay logged in?
        </p>
        <div className="modal-actions" style={{ justifyContent: "center", marginTop: "24px" }}>
          <button
            className="primary"
            onClick={() => {
              lastActive.current = Date.now();
              setShowWarning(false);
            }}
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
