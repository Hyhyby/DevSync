// routes/serverRoutes.js
// 서버(길드) CRUD + 서버 멤버 관리 API
// PostgreSQL 기반 / 테이블 구조 100% 반영

const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticateToken } = require("../middleware/auth");
const { log } = require("../middleware/logger");

/** 서버 row → 프론트 friendly 형태로 매핑 */
function mapServer(row) {
  return {
    id: row.id,
    name: row.name,
    iconUrl: row.icon_url,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    role: row.role || null,
  };
}

/**
 * 📌 서버 생성
 * POST /api/servers
 * body: { name, iconUrl }
 */
router.post("/", authenticateToken, async (req, res) => {
  const { name, iconUrl } = req.body || {};
  const ownerId = req.user.userId;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Server name is required" });
  }

  try {
    // 서버 생성
    const result = await pool.query(
      `
      INSERT INTO servers (name, icon_url, owner_id)
      VALUES ($1, $2, $3)
      RETURNING id, name, icon_url, owner_id, created_at
      `,
      [name.trim(), iconUrl || null, ownerId]
    );

    const server = result.rows[0];

    // 서버 멤버(owner)로 추가
    await pool.query(
      `
      INSERT INTO server_members (server_id, user_id, role)
      VALUES ($1, $2, 'owner')
      `,
      [server.id, ownerId]
    );

    return res.status(201).json(mapServer(server));
  } catch (err) {
    log.error?.("SERVER_CREATE_ERR", err);
    return res.status(500).json({ error: "Failed to create server" });
  }
});

/**
 * 📌 내가 속한 서버 목록
 * GET /api/servers
 */
router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        s.id, s.name, s.icon_url, s.owner_id, s.created_at,
        sm.role
      FROM servers s
      JOIN server_members sm
        ON sm.server_id = s.id
      WHERE sm.user_id = $1
      ORDER BY s.created_at ASC
      `,
      [userId]
    );

    return res.json(result.rows.map(mapServer));
  } catch (err) {
    log.error?.("SERVER_LIST_ERR", err);
    return res.status(500).json({ error: "Failed to load server list" });
  }
});

/**
 * 📌 특정 서버 정보
 * GET /api/servers/:serverId
 */
router.get("/:serverId", authenticateToken, async (req, res) => {
  const serverId = req.params.serverId;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        s.id, s.name, s.icon_url, s.owner_id, s.created_at,
        sm.role
      FROM servers s
      JOIN server_members sm
        ON sm.server_id = s.id
      WHERE s.id = $1
        AND sm.user_id = $2
      `,
      [serverId, userId]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "Server not found or no permission" });
    }

    return res.json(mapServer(result.rows[0]));
  } catch (err) {
    log.error?.("SERVER_GET_ERR", err);
    return res.status(500).json({ error: "Failed to load server" });
  }
});

/**
 * 📌 서버 수정 (owner만 가능)
 * PATCH /api/servers/:serverId
 */
router.patch("/:serverId", authenticateToken, async (req, res) => {
  const serverId = req.params.serverId;
  const { name, iconUrl } = req.body || {};
  const userId = req.user.userId;

  try {
    // Owner 확인
    const check = await pool.query(
      `SELECT owner_id FROM servers WHERE id = $1`,
      [serverId]
    );

    if (check.rowCount === 0)
      return res.status(404).json({ error: "Server not found" });

    if (check.rows[0].owner_id !== userId)
      return res.status(403).json({ error: "No permission" });

    // 업데이트할 필드 구성
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx}`);
      values.push(name.trim());
      idx++;
    }

    if (iconUrl !== undefined) {
      fields.push(`icon_url = $${idx}`);
      values.push(iconUrl || null);
      idx++;
    }

    if (fields.length === 0)
      return res.status(400).json({ error: "Nothing to update" });

    values.push(serverId);

    const result = await pool.query(
      `
      UPDATE servers
         SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING id, name, icon_url, owner_id, created_at
      `,
      values
    );

    return res.json(mapServer(result.rows[0]));
  } catch (err) {
    log.error?.("SERVER_UPDATE_ERR", err);
    return res.status(500).json({ error: "Failed to update server" });
  }
});

/**
 * 📌 서버 삭제 (owner만)
 * DELETE /api/servers/:serverId
 */
router.delete("/:serverId", authenticateToken, async (req, res) => {
  const serverId = req.params.serverId;
  const userId = req.user.userId;

  try {
    const check = await pool.query(
      `SELECT owner_id FROM servers WHERE id = $1`,
      [serverId]
    );

    if (check.rowCount === 0)
      return res.status(404).json({ error: "Server not found" });

    if (check.rows[0].owner_id !== userId)
      return res.status(403).json({ error: "No permission" });

    await pool.query(`DELETE FROM servers WHERE id = $1`, [serverId]);

    return res.json({ ok: true });
  } catch (err) {
    log.error?.("SERVER_DELETE_ERR", err);
    return res.status(500).json({ error: "Failed to delete server" });
  }
});

module.exports = router;
