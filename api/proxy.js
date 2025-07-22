// 檔案路徑: api/proxy.js

const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const targetApiHost = 'http://39.108.191.53:8089';
  const targetPath = req.url.replace('/api/proxy', '');
  const targetUrl = `${targetApiHost}${targetPath}`;

  console.log(`Rewritten proxy request to: ${targetUrl}`);

  // 準備要轉發的請求選項
  const fetchOptions = {
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'App-Key': req.headers['app-key'],
      'App-Secret': req.headers['app-secret'],
      'X-Token': req.headers['x-token'],
    },
  };

  // 【關鍵修正】只有在不是 GET 或 HEAD 請求時，才加入 body
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    // 使用我們準備好的選項來發送請求
    const response = await fetch(targetUrl, fetchOptions);
    
    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, App-Key, App-Secret, X-Token');

    res.status(response.status).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
};