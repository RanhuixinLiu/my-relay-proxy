// 檔案路徑: api/proxy.js

import fetch from 'node-fetch';

export default async function handler(req, res) {
  // 目標 API 的主機地址
  const targetApiHost = 'http://39.108.191.53:8089';

  // 我們的 rewrite 規則會保留原始 URL，我們只需要移除代理的前綴即可
  const targetPath = req.url.replace('/api/proxy', '');

  // 組合出最終要請求的 URL
  const targetUrl = `${targetApiHost}${targetPath}`;

  console.log(`Rewritten proxy request to: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'App-Key': req.headers['app-key'],
        'App-Secret': req.headers['app-secret'],
        'X-Token': req.headers['x-token'],
      },
      body: req.body ? JSON.stringify(req.body) : null,
    });
    
    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, App-Key, App-Secret, X-Token');

    res.status(response.status).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}