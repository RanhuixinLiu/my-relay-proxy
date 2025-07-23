// 檔案路徑: api/proxy.js

const fetch = require('node-fetch');
const crypto = require('crypto');

let cachedToken = {
  value: null,
  expiresAt: 0,
};

// --- 獲取 Token 的核心函數 ---
async function getValidToken() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.value;
  }

  // 從 Vercel 環境變數中讀取【使用者憑證】
  const username = process.env.LOGIN_USERNAME;
  const password = process.env.LOGIN_PASSWORD;

  // 檢查是否已設定環境變數
  if (!username || !password) {
    throw new Error('Username or Password is not set in Vercel Environment Variables.');
  }

  // 對【使用者密碼】進行 MD5 加密
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

  const AUTH_ENDPOINT = '/api/v1/login/login';
  const targetApiHost = 'http://39.108.191.53:8089';
  const authUrl = `${targetApiHost}${AUTH_ENDPOINT}`;

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 使用【使用者名稱】和【加密後的密碼】進行登入
      body: JSON.stringify({
        username: username,
        password: hashedPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.data || !data.data.accessToken) {
      throw new Error(`Failed to fetch token: ${data.msg || 'Unknown error'}`);
    }
    
    const accessToken = data.data.accessToken; 
    const expiresIn = data.data.expiresIn;

    cachedToken.value = accessToken;
    cachedToken.expiresAt = Date.now() + expiresIn * 1000;

    return accessToken;

  } catch (error) {
    console.error('Error fetching token:', error);
    cachedToken = { value: null, expiresAt: 0 };
    throw error;
  }
}


// --- 主要的代理處理函數 ---
module.exports = async (req, res) => {
  try {
    const xToken = await getValidToken();
    const appKey = process.env.APP_KEY; // 讀取 App Key

    const targetApiHost = 'http://39.108.191.53:8089';
    const targetPath = req.url.replace('/api/proxy', '');
    const targetUrl = `${targetApiHost}${targetPath}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'App-Key': appKey, // 在最終請求中依然傳遞 App-Key
        'X-Token': xToken,
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const targetResponse = await fetch(targetUrl, fetchOptions);
    const responseData = await targetResponse.json();
    
    res.status(targetResponse.status).json(responseData);

  } catch (error) {
    console.error('Proxy handler error:', error);
    res.status(500).json({ error: 'An error occurred in the proxy handler.', details: error.message });
  }
};