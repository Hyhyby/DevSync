// backend/services/botService.js
const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is missing. Put it in backend/.env");
}

const client = new OpenAI({ apiKey });

const SYSTEM_INSTRUCTIONS = `
너는 DevSync의 대화형 챗봇 DevSyncBot이야.
- 항상 한국어로 답해.
- 개발 질문이면 단계적으로 설명하되, 코드 예시는 짧게.
- 확실하지 않으면 추측하지 말고, 필요한 정보가 무엇인지 말해.
- 비밀번호/토큰/API키 같은 민감정보는 요구하거나 출력하지 마.
`.trim();

async function generateReply({ historyText, userPrompt }) {
  const input = `
[최근 대화]
${historyText}

[사용자 요청]
${userPrompt}
`.trim();

  // ✅ Responses API 사용 (단일 텍스트 응답)
  const resp = await client.responses.create({
    model: "gpt-5.2", // 비용/속도 우선이면 mini 추천 (원하면 gpt-5로)
    instructions: SYSTEM_INSTRUCTIONS,
    input,
  });

  return (resp.output_text || "").trim();
}

module.exports = { generateReply };
