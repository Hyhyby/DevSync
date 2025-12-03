// routes/dmRoutes.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const pool = require("../config/db");

const router = express.Router();

/* ============================================================
   1. DM 방 생성 (이미 있으면 기존 방 반환)
   POST /api/dms  { targetUserId }
============================================================ */
router.post("/", authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: "targetUserId 필요" });
  }

  if (Number(targetUserId) === Number(myId)) {
    return res.status(400).json({ error: "자기 자신과 DM 불가" });
  }

  const client = await pool.connect();
  try {
    // 두 명으로만 구성된 기존 DM 방이 이미 있는지 확인
    const exists = await client.query(
      `
      SELECT dp.dm_id
      FROM dm_participants dp
      GROUP BY dp.dm_id
      HAVING ARRAY_AGG(dp.user_id ORDER BY dp.user_id)
           = ARRAY(SELECT unnest($1::int[]) ORDER BY 1)
      `,
      [[myId, targetUserId]]
    );

    // 있으면 그 방 그대로 사용
    if (exists.rowCount > 0) {
      return res.json({ dmId: exists.rows[0].dm_id });
    }

    // 없으면 새로 생성
    await client.query("BEGIN");

    // dms.id 는 BIGSERIAL 이라고 가정
    const create = await client.query(
      `
      INSERT INTO dms DEFAULT VALUES
      RETURNING id
      `
    );
    const newDmId = create.rows[0].id;

    // 참가자 2명 추가
    await client.query(
      `
      INSERT INTO dm_participants (dm_id, user_id)
      VALUES ($1, $2), ($1, $3)
      `,
      [newDmId, myId, targetUserId]
    );

    await client.query("COMMIT");
    res.json({ dmId: newDmId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE_DM_ERROR", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

/* ============================================================
   2. 내 DM 방 목록 가져오기
   GET /api/dms
============================================================ */
router.get("/", authenticateToken, async (req, res) => {
  const myId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        d.id AS dm_id,
        d.updated_at,
        (
          SELECT json_agg(
                   json_build_object(
                     'id', u.id,
                     'username', u.username
                   )
                 )
          FROM dm_participants dp2
          JOIN users u ON u.id = dp2.user_id
          WHERE dp2.dm_id = d.id
            AND dp2.user_id != $1
        ) AS partner
      FROM dms d
      JOIN dm_participants dp ON dp.dm_id = d.id
      WHERE dp.user_id = $1
      ORDER BY d.updated_at DESC
      `,
      [myId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET_DMS_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ============================================================
   3. 특정 DM 방 메시지 목록
   GET /api/dms/:dmId/messages
============================================================ */
router.get("/:dmId/messages", authenticateToken, async (req, res) => {
  const myId = req.user.userId;
  const { dmId } = req.params;

  try {
    // 내가 이 DM 방의 참가자인지 체크
    const auth = await pool.query(
      `
      SELECT 1
      FROM dm_participants
      WHERE dm_id = $1
        AND user_id = $2
      `,
      [dmId, myId]
    );

    if (auth.rowCount === 0) {
      return res.status(403).json({ error: "권한 없음" });
    }

    const result = await pool.query(
      `
      SELECT
        m.id,
        m.dm_id,
        m.user_id,
        u.username,
        m.content AS message,
        m.created_at
      FROM dm_messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.dm_id = $1
      ORDER BY m.created_at ASC
      `,
      [dmId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET_DM_MESSAGES_ERROR", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ============================================================
   4. (프론트에서는 안씀) REST로 메시지 저장 방지
============================================================ */
router.post("/:dmId/messages", authenticateToken, async (_req, res) => {
  res
    .status(400)
    .json({ error: "프론트는 socket.io의 send-dm 이벤트를 사용합니다." });
});

module.exports = router;
