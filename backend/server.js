require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

require("./config/db"); // initializes DB + runs schema on boot

const authRoutes = require("./routes/auth.routes");
const homeRoutes = require("./routes/home.routes");
const adminRoutes = require("./routes/admin.routes");
const competitionRoutes = require("./routes/competition.routes");
const submissionRoutes = require("./routes/submission.routes");
const awardRoutes = require("./routes/award.routes");
const exhibitionRoutes = require("./routes/exhibition.routes");
const managerRoutes = require("./routes/manager.routes");
const { UPLOAD_DIR } = require("./middleware/upload.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Serve uploaded painting images
app.use("/uploads/submissions", express.static(UPLOAD_DIR));

// Serve the static frontend (multi-page vanilla JS site)
const frontendDir = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendDir));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/awards", awardRoutes);
app.use("/api/exhibitions", exhibitionRoutes);
app.use("/api/manager", managerRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Fallback to index.html for any non-API GET (simple multi-page app, so this
// mostly matters for direct refreshes on sub-pages served by static already)
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(frontendDir, "index.html"), (err) => {
      if (err) next();
    });
  }
  next();
});

// Central error handler (e.g. Multer file-type/size errors)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 400).json({ message: err.message || "Unexpected server error." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Institute of Fine Arts API running on http://localhost:${PORT}`);
});
