// backend/services/botService.js
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey)
  throw new Error("OPENAI_API_KEY is missing. Put it in backend/.env");

const client = new OpenAI({ apiKey });

const SYSTEM_INSTRUCTIONS = `
너는 DevSync의 대화형 챗봇 DevSyncBot이야.
- 항상 한국어로 답해.
- 개발 질문이면 단계적으로 설명하되, 코드 예시는 짧게.
- 확실하지 않으면 추측하지 말고, 필요한 정보가 무엇인지 말해.
- 비밀번호/토큰/API키 같은 민감정보는 요구하거나 출력하지 마.
`.trim();

// ✅ 텍스트용(기존 유지)
async function generateReply({ historyText, userPrompt }) {
  const input = `
[최근 대화]
${historyText}

[사용자 요청]
${userPrompt}
`.trim();

  const resp = await client.responses.create({
    model: process.env.OPENAI_TEXT_MODEL || "gpt-5.2",
    instructions: SYSTEM_INSTRUCTIONS,
    input,
  });

  return (resp.output_text || "").trim();
}

// ✅ /uploads/... → 서버 디스크 절대경로로 변환
function fileUrlToAbsPath(fileUrl) {
  const rel = String(fileUrl || "").replace(/^\/uploads\//, "uploads/");
  return path.join(__dirname, "..", rel);
}

function guessMimeFromName(nameOrUrl = "") {
  const s = String(nameOrUrl).toLowerCase();
  if (s.endsWith(".png")) return "image/png";
  if (s.endsWith(".webp")) return "image/webp";
  if (s.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

// ✅ (추가) 이미지가 단순해도 반드시 "무엇이 보이는지" 설명하게 만드는 프롬프트 래퍼
function buildVisionPrompt(userPrompt) {
  const p = (userPrompt || "").trim();

  // 사용자가 "최근 이미지 분석" 같은 커맨드를 쳤을 때도,
  // 아이콘/단색/심플한 이미지면 "단순한 아이콘"이라고라도 설명하도록 강제
  return `
너는 이미지 분석가야. 아래 이미지를 보고 반드시 "무엇이 보이는지"를 설명해.
이미지가 매우 단순한 아이콘/화살표/로고/단색 배경이어도 "보이는 형태/색/방향/텍스트 유무"를 구체적으로 말해.
이미지를 볼 수 없다는 말은 하지 마. (정말 입력이 없을 때만 예외)

출력 형식:
1) 한 줄 요약(무엇인지)
2) 관찰(색/형태/텍스트/배치)
3) 사용 맥락 추정(가능하면)

사용자 요청:
${p || "(요청 없음)"}
`.trim();
}

// ✅ 옵션 2 핵심: 업로드된 이미지 분석 (제외 없이 항상 분석)
async function analyzeUploadedImage({
  fileUrl, // "/uploads/..."
  prompt = `
이미지에 보이는 내용만 설명해줘.
- 사람 식별/신원 확인/개인정보 추정은 하지 마.
- 사용자가 사람 식별을 요청하지 않았다면 관련 거절 문구(예: "할 수 없다")는 출력하지 말고 분석을 바로 시작해.
출력 형식:
1) 한 줄 요약
2) 관찰(색/형태/텍스트/배치)
3) 맥락 추정(가능하면)
`.trim(),

  detail = "auto",
}) {
  if (!fileUrl) throw new Error("fileUrl is required");

  const abs = fileUrlToAbsPath(fileUrl);

  // 파일 존재/크기 체크(너무 크면 비용/에러)
  const st = fs.statSync(abs);
  const MAX = 10 * 1024 * 1024; // 10MB
  if (st.size > MAX) {
    throw new Error(`Image too large: ${st.size} bytes (max ${MAX})`);
  }

  const buf = fs.readFileSync(abs);
  const b64 = buf.toString("base64");
  const mime = guessMimeFromName(fileUrl);

  // ✅ 여기서 "아이콘이라도 분석"을 강제하는 프롬프트 사용
  const visionPrompt = buildVisionPrompt(prompt);

  const resp = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
    instructions: SYSTEM_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: visionPrompt },
          {
            type: "input_image",
            image_url: `data:${mime};base64,${b64}`,
            // detail, // 필요하면 사용(모델에 따라 무시될 수 있음)
          },
        ],
      },
    ],
  });

  const out = (resp.output_text || "").trim();

  // ✅ (추가) 모델이 가끔 뭉뚱그리게 "분석 못해" 류를 말할 때 방어
  //    - 이미지 입력이 정상인데도 그런 문구가 나오면, 최소 설명을 강제
  if (
    out.includes("분석할 수 없어") ||
    out.includes("이미지를 분석할 수 없") ||
    out.toLowerCase().includes("can't analyze") ||
    out.toLowerCase().includes("cannot analyze")
  ) {
    // fallback: 아주 단순하게라도 설명 유도
    const resp2 = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      instructions: SYSTEM_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
이미지를 반드시 보고 설명해.
"분석할 수 없다"는 말은 금지.
아이콘이면 아이콘이라고 말하고, 색/형태/방향/텍스트 유무를 적어.
`.trim(),
            },
            { type: "input_image", image_url: `data:${mime};base64,${b64}` },
          ],
        },
      ],
    });
    return (resp2.output_text || "").trim();
  }

  return out;
}

module.exports = {
  generateReply,
  analyzeUploadedImage,
};
