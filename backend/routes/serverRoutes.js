// routes/serverRoutes.js
// 서버(길드) CRUD + 서버 멤버 관리 API
// PostgreSQL 기반 / 테이블 구조 100% 반영
const { getIo, onlineUsers } = require("../socket");
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
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

router.post("/", authenticateToken, async (req, res) => {
  const userId = req.user.userId; // number
  const { name, iconUrl } = req.body || {};
  console.log("userId =", userId, "type =", typeof userId);

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Server name is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) servers 생성 (id는 DB에서 자동 생성된다고 가정)
    const serverRes = await client.query(
      `
      INSERT INTO servers (name, owner_id, icon_url)
      VALUES ($1, $2, $3)
      RETURNING id, name, owner_id, icon_url, created_at
      `,
      [name.trim(), userId, iconUrl || null],
    );

    // ✅ 여기서 serverId를 꺼내야 함
    const serverId = serverRes.rows[0].id;

    // 2) server_members에 owner 추가
    await client.query(
      `
      INSERT INTO server_members (server_id, user_id, role)
      VALUES ($1, $2, 'owner')
      `,
      [serverId, userId],
    );

    // 3) 기본 채널 생성
    await client.query(
      `
      INSERT INTO server_channels (server_id, name, type, position, topic)
      VALUES 
        ($1, '일반', 'text', 0, ''),
        ($1, '일반 음성 채널', 'voice', 0, '')
      `,
      [serverId],
    );

    await client.query("COMMIT");

    const row = serverRes.rows[0];
    return res.status(201).json({
      id: row.id,
      name: row.name,
      iconUrl: row.icon_url,
      ownerId: row.owner_id,
      createdAt: row.created_at,
      role: "owner",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("SERVER_CREATE_ERR", err);
    return res.status(500).json({ error: "Failed to create server" });
  } finally {
    client.release();
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
      [userId],
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
      [serverId, userId],
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
 * 📌 서버 멤버 목록 (✅ profileImage 포함)
 * GET /api/servers/:serverId/members
 */
router.get("/:serverId/members", authenticateToken, async (req, res) => {
  const serverId = req.params.serverId;
  const userId = req.user.userId;

  try {
    // 요청한 유저가 이 서버 멤버인지 확인
    const check = await pool.query(
      `
      SELECT 1
      FROM server_members
      WHERE server_id = $1 AND user_id = $2
      `,
      [serverId, userId],
    );

    if (check.rowCount === 0) {
      return res
        .status(403)
        .json({ error: "이 서버의 멤버가 아니라 멤버 목록을 볼 수 없습니다." });
    }

    // ✅ profile_image_url 포함
    const result = await pool.query(
      `
      SELECT 
        u.id,
        u.username AS name,
        u.profile_image_url,
        sm.role,
        sm.joined_at
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = $1
      ORDER BY 
        CASE WHEN sm.role = 'owner' THEN 0 ELSE 1 END,
        u.username ASC
      `,
      [serverId],
    );

    const members = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      joinedAt: row.joined_at,
      profileImage: row.profile_image_url, // ✅ 프론트에서 그대로 사용
    }));

    return res.json(members);
  } catch (err) {
    log.error?.("SERVER_MEMBERS_ERR", err);
    return res.status(500).json({ error: "Failed to load server members" });
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
      [serverId],
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
      values,
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
      [serverId],
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

/**
 * 📌 서버 나가기
 * POST /api/servers/:serverId/leave
 */
router.post("/:serverId/leave", authenticateToken, async (req, res) => {
  const serverId = req.params.serverId;
  const userId = req.user.userId;

  try {
    // 서버 존재 여부 및 소유자 확인
    const serverCheck = await pool.query(
      `SELECT owner_id FROM servers WHERE id = $1`,
      [serverId],
    );

    if (serverCheck.rowCount === 0) {
      return res.status(404).json({ error: "Server not found" });
    }

    // 소유자는 나갈 수 없음
    if (serverCheck.rows[0].owner_id === userId) {
      return res.status(400).json({
        error:
          "서버 소유자는 서버를 나갈 수 없습니다. 서버를 삭제하거나 소유권을 양도하세요.",
      });
    }

    // 멤버 삭제 (나가기 처리)
    const result = await pool.query(
      `DELETE FROM server_members WHERE server_id = $1 AND user_id = $2`,
      [serverId, userId],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: "이 서버의 멤버가 아닙니다." });
    }

    // 소켓: 멤버 업데이트 알림
    try {
      const io = getIo();

      const memberIdsRes = await pool.query(
        `SELECT user_id FROM server_members WHERE server_id = $1`,
        [serverId],
      );

      const payload = { serverId, leftUserId: userId };

      for (const row of memberIdsRes.rows) {
        const sockets = onlineUsers.get(row.user_id);
        if (!sockets) continue;
        for (const sid of sockets) {
          io.to(sid).emit("server-members-updated", payload);
        }
      }
    } catch (e) {
      console.error("LEAVE_SERVER_SOCKET_EMIT_ERROR", e);
    }

    return res.json({ message: "서버에서 성공적으로 나갔습니다." });
  } catch (err) {
    log.error?.("SERVER_LEAVE_ERR", err);
    return res.status(500).json({ error: "Failed to leave server" });
  }
});

module.exports = router;
