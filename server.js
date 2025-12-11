// ===== server.js (diagnostic version) =====
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Cloud Run gives PORT in env, default to 8080 for local
const PORT = process.env.PORT || 8080;

// Print env vars at startup (safe, no API key printed)
console.log("🚀 Server starting...");
console.log("PORT =", PORT);
console.log("NODE_ENV =", process.env.NODE_ENV);
console.log("GEMINI_API_KEY present =", !!process.env.GEMINI_API_KEY);

// Basic test route
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// If this file loads correctly, you should at least see this route work
app.get("/", (req, res) => {
  res.send("Server running");
});

// ---- TEMPORARY: disable all API routes to isolate startup error ----
app.post("/api/analyze-profile-image", (req, res) => {
  res.status(501).json({ error: "TEMP: backend disabled" });
});

app.post("/api/generate-outfit", (req, res) => {
  res.status(501).json({ error: "TEMP: backend disabled" });
});
// ---------------------------------------------------------------------

// IMPORTANT — only start server if file loads successfully
try {
  app.listen(PORT, () => {
    console.log(`✅ Server listening on port ${PORT}`);
  });
} catch (err) {
  console.error("❌ Fatal startup error:", err);
}
