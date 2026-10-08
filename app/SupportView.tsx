"use client";

import React, { useState } from "react";
import { sendSupportEmail } from "./actions";

export default function SupportView({ entityName, customerId }: { entityName: string; customerId?: string }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus("");
    
    const res = await sendSupportEmail(subject, message, entityName, customerId);
    
    if (res.ok) {
      setStatus("✅ Message sent! Our support team will get back to you shortly.");
      setSubject("");
      setMessage("");
    } else {
      setStatus(`❌ Error: ${res.error}`);
    }
    setSending(false);
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎧</div>
        <h2 style={{ fontSize: "1.75rem", marginBottom: "8px", fontWeight: "300" }}>VRT Services Support</h2>
        <p style={{ color: "var(--color-muted)", lineHeight: "1.6" }}>
          Need help with <strong>{entityName}</strong>? We are here to assist you. 
          Send us a message and our support team will get back to you as soon as possible.
        </p>
      </div>

      <div style={{ 
        backgroundColor: "var(--bg-card, rgba(255,255,255,0.02))", 
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: "12px", 
        padding: "32px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
      }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "0.95rem" }}>
              Subject
            </label>
            <input 
              type="text" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="E.g. Help with adjusting Chart of Accounts"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--bg-input)",
                color: "var(--color-text)",
                fontSize: "1rem"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "0.95rem" }}>
              Message
            </label>
            <textarea 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question in detail..."
              required
              rows={6}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--bg-input)",
                color: "var(--color-text)",
                fontSize: "1rem",
                resize: "vertical"
              }}
            />
          </div>

          {status && (
            <div style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              color: "#10b981",
              fontSize: "0.9rem",
              textAlign: "center"
            }}>
              {status}
            </div>
          )}

          <div style={{ textAlign: "right", marginTop: "8px" }}>
            <button 
              type="submit"
              disabled={sending}
              style={{
                background: sending ? "linear-gradient(135deg, #64748b, #475569)" : "linear-gradient(135deg, #3b82f6, #2563eb)",
                border: "none",
                color: "#fff",
                fontSize: "0.95rem",
                fontWeight: "600",
                padding: "12px 28px",
                borderRadius: "8px",
                cursor: sending ? "not-allowed" : "pointer",
                boxShadow: sending ? "none" : "0 4px 15px rgba(59, 130, 246, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {sending ? "⏳ Sending..." : "✉️ Send Message"}
            </button>
          </div>
        </form>
      </div>
      
      <div style={{ textAlign: "center", marginTop: "16px", fontSize: "0.9rem", color: "var(--color-muted)" }}>
        Prefer email? Contact us directly at <a href="mailto:notification@vrtservices12.com" style={{ color: "#3b82f6", textDecoration: "none" }}>notification@vrtservices12.com</a>
      </div>
    </div>
  );
}
