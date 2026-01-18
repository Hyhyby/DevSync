// routes/userRoutes.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

/**
 * 업로드 폴더 생성 유틸
 */
function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/**
 * multer 설정: uploads/profiles/{userId}/ 아래에 저장
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user.userId;
    const dest = path.join(
      __dirname,
      "..",
      "uploads",
      "profiles",
      String(userId)
    );
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const safe = (file.originalname || "profile.png").replace(
      /[^\w.\-() ]/g,
      "_"
    );
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/**
 * ✅ 유저 검색 (친구추가 모달 등에서 사용)
 * GET /api/users/search?q=...&limit=20
 */
router.get("/search", authenticateToken, async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const limit = Math.min(Number(req.query.limit || 20), 50);

    // username / email 기반 검색 (대소문자 무시)
    const { rows } = await pool.query(
      `
      SELECT id, username, email, profile_image_url
      FROM users
      WHERE (LOWER(username) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1))
      ORDER BY username ASC
      LIMIT $2
      `,
      [`%${q}%`, limit]
    );

    // 프론트에서 쓰기 쉽게 profileImage 키로 내려주기
    const result = rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      profileImage: u.profile_image_url,
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /api/users/search error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✅ 특정 유저 조회 (프로필/미니프로필 용도)
 * GET /api/users/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const { rows } = await pool.query(
      `
      SELECT id, username, profile_image_url
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const u = rows[0];
    res.json({
      id: u.id,
      username: u.username,
      profileImage: u.profile_image_url,
    });
  } catch (err) {
    console.error("GET /api/users/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * ✅ 내 프로필 이미지 업로드
 * POST /api/users/me/profile-image
 * form-data: image=<file>
 */
router.post(
  "/me/profile-image",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: "image is required" });

      const userId = req.user.userId;

      // 브라우저에서 접근할 URL (정적서빙 필요: /uploads)
      const relativeUrl = `/uploads/profiles/${userId}/${req.file.filename}`;

      await pool.query(
        `UPDATE users SET profile_image_url = $1 WHERE id = $2`,
        [relativeUrl, userId]
      );

      res.json({ profileImage: relativeUrl });
    } catch (err) {
      console.error("POST /api/users/me/profile-image error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

module.exports = router;
