// 檔案路徑: api/proxy/[...path].js

import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Vercel 會將捕獲到的路徑變成一個陣列，例如 ['api', 'v1', 'device', 'lastdp']
  const pathSegments = req.query.path || [];

  // 我們將陣列重新組合成一個路徑字串 "api/v1/device/lastdp"
  const path = pathSegments.join('/');

  // 從原始請求中獲取查詢參數，例如 "?pid=123&did=456"
  const queryString = req.url.split('?')[1] || '';

  // 組合出包含查詢參數的完整路徑
  const fullPath = queryString ? `${path}?${queryString}` : path;

  // 目標 API 的主機地址
  const targetApiHost = 'http://39.108.191.53:8089';
  const targetUrl = `${targetApiHost}/${fullPath}`;

  console.log(`Proxying request to: ${targetUrl}`); // 在 Vercel 日誌中印出目標網址，方便偵錯

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'App-Key': req.headers['app-key'],
        'App-Secret': req.headers['app-secret'],
        'X-Token': req.headers['x-token'],
      },
      // 如果請求有 body (例如 POST)，則轉發它
      body: req.body ? JSON.stringify(req.body) : null,
    });
    
    // 從真實 API 獲取回應資料
    const data = await response.json();

    // 在回傳給瀏覽器前，設定允許跨域的標頭
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, App-Key, App-Secret, X-Token');

    // 將真實 API 的狀態碼和資料回傳給瀏覽器
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}