const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------------- Existing contact form endpoint (UNCHANGED) ----------------
app.post("/send-email", async (req, res) => {
  const { name, email, message } = req.body;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: email,
    to: process.env.EMAIL_USER,
    subject: `New Contact Form Submission from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Email sent successfully" });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ message: "Failed to send email" });
  }
});

// ---------------- New /apply-job endpoint for job applications ----------------

// Multer upload setup
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, unique + "-" + safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error("Only .pdf, .jpg, .jpeg, .png allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB per file
});

const fields = [
  { name: "passport_front", maxCount: 1 },
  { name: "passport_back", maxCount: 1 },
  { name: "photo", maxCount: 1 },
  { name: "education", maxCount: 1 },
  { name: "experience", maxCount: 1 },
  { name: "aadhaar", maxCount: 1 },
  { name: "pan", maxCount: 1 },
  { name: "birth_certificate", maxCount: 1 },
];

app.post("/apply-job", upload.fields(fields), async (req, res) => {
  try {
    const { name, email, phone, jobTitle } = req.body;
    if (!name || !email || !phone || !jobTitle) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Prepare attachments from uploaded files
    const attachments = [];
    if (req.files) {
      for (const fieldName of Object.keys(req.files)) {
        req.files[fieldName].forEach((file) => {
          attachments.push({
            filename: file.originalname,
            path: file.path,
          });
        });
      }
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: process.env.EMAIL_USER,
      subject: `Job Application: ${jobTitle} — ${name}`,
      html: `
        <h3>New Job Application</h3>
        <p><strong>Job:</strong> ${jobTitle}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Note:</strong> All required documents attached.</p>
      `,
      attachments,
    };

    await transporter.sendMail(mailOptions);

    // Delete files after sending
    attachments.forEach((att) => {
      fs.unlink(att.path, (err) => {
        if (err) console.warn("Failed to delete upload:", att.path, err);
      });
    });

    res.status(200).json({ message: "Application sent successfully" });
  } catch (err) {
    console.error("apply-job error:", err);
    res.status(500).json({ message: "Failed to process application" });
  }
});

// ---------------- Serve frontend build in production ----------------
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "frontend", "build");
  app.use(express.static(frontendPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
