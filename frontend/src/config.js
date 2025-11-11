// src/config.js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || // ✅ Vite 환경변수 (없으면 아래 fallback)
  'http://localhost:5000';

export { API_BASE };
