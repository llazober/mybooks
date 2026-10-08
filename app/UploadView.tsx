"use client";

import React, { useState, useRef } from "react";
import { uploadDocument } from "./actions";

export default function UploadView({ entityId, customerId, entityName }: { entityId: string; customerId?: string; entityName: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
      setStatus("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setStatus("");
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setStatus("Please select at least one file to upload.");
      return;
    }

    setUploading(true);
    setStatus(`⏳ Uploading ${files.length} file(s)...`);

    let successCount = 0;
    const errors: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityId", entityId);
      formData.append("entityName", entityName);
      if (customerId) formData.append("customerId", customerId);

      const res = await uploadDocument(formData);
      if (res.ok) {
        successCount++;
      } else {
        errors.push(`${file.name}: ${res.error}`);
      }
    }

    setUploading(false);
    if (errors.length === 0) {
      setStatus(`🎉 Successfully uploaded ${successCount} file(s)!`);
      setFiles([]);
    } else {
      setStatus(`⚠️ Uploaded ${successCount} file(s), but ${errors.length} failed: \n${errors.join("\n")}`);
    }
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "8px", fontWeight: "300" }}>Upload Documents</h2>
        <p style={{ color: "var(--color-muted)" }}>
          Upload PDF tax forms, bank statements, checks, W-2s, 1099s, or images.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          border: "2px dashed var(--color-border, #e2e8f0)",
          borderRadius: "12px",
          padding: "48px 24px",
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: "var(--bg-card, rgba(255,255,255,0.02))",
          transition: "all 0.2s"
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>📁</div>
        <div style={{ fontSize: "1.1rem", fontWeight: "500", marginBottom: "8px" }}>
          Drag & Drop files here
        </div>
        <div style={{ fontSize: "0.9rem", color: "var(--color-muted)" }}>
          or click to browse from your computer
        </div>
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

      {files.length > 0 && (
        <div style={{ padding: "16px", backgroundColor: "var(--bg-input)", borderRadius: "8px" }}>
          <strong style={{ display: "block", marginBottom: "8px", fontSize: "0.9rem" }}>Selected Files:</strong>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.85rem" }}>
            {files.map((f, i) => (
              <li key={i} style={{ padding: "4px 0", color: "var(--color-text)" }}>
                📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)
              </li>
            ))}
          </ul>
        </div>
      )}

      {status && (
        <div style={{
          padding: "12px 16px",
          borderRadius: "8px",
          backgroundColor: status.includes("⚠️") || status.includes("Please") ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
          color: status.includes("⚠️") || status.includes("Please") ? "#ef4444" : "#10b981",
          fontSize: "0.9rem",
          whiteSpace: "pre-wrap"
        }}>
          {status}
        </div>
      )}

      <div style={{ textAlign: "right", marginTop: "8px" }}>
        <button
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            border: "none",
            color: "#fff",
            fontSize: "0.9rem",
            fontWeight: "600",
            padding: "12px 24px",
            borderRadius: "8px",
            cursor: uploading || files.length === 0 ? "not-allowed" : "pointer",
            opacity: uploading || files.length === 0 ? 0.7 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 15px rgba(16, 185, 129, 0.2)"
          }}
        >
          {uploading ? "⏳ Uploading..." : "🚀 Upload to Inbox"}
        </button>
      </div>
    </div>
  );
}
