// api/proxy.js

// 匯入 fetch 功能
const fetch = require('node-fetch');

// Vercel 會將這個檔案自動轉成一個 API 端點
export default async function handler(req, res) {
  // 目標 API 的基礎 URL
  const targetApiHost = 'http://39.108.191.53:8089';

  // 取得使用者請求的完整路徑和查詢參數
  // 例如，如果使用者請求 /api/proxy/api/v1/device/lastdp?pid=123
  // url 會是 /api/v1/device/lastdp?pid=123
  const url = req.url.replace('/api/proxy', '');

  // 建立完整的目標 URL
  const targetUrl = `${targetApiHost}${url}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method, // 使用與使用者請求相同的方法 (GET, POST, etc.)
      headers: {
        // 從使用者請求中複製必要的標頭到目標請求
        'Content-Type': req.headers['content-type'] || 'application/json',
        'App-Key': req.headers['app-key'],
        'App-Secret': req.headers['app-secret'],
        'X-Token': req.headers['x-token'],
      },
      // 如果是 POST 請求，則轉發 body
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    // 取得目標 API 的回應
    const data = await response.json();

    // 設定 CORS 標頭，允許任何來源的瀏覽器訪問你的代理
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, App-Key, App-Secret, X-Token');

    // 將從目標 API 拿到的資料回傳給使用者
    res.status(response.status).json(data);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Proxy failed', details: error.message });
  }
}