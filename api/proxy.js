// 檔案路徑: api/proxy.js (偵錯版本)

const fetch = require('node-fetch');
const crypto = require('crypto');

// ... (cachedToken 物件定義不變) ...
let cachedToken = { value: null, expiresAt: 0 };

async function getValidToken() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.value;
  }

  const username = process.env.LOGIN_USERNAME;
  const password = process.env.LOGIN_PASSWORD;

  if (!username || !password) {
    throw new Error('Username or Password is not set in Vercel Environment Variables.');
  }

  // --- 新增的偵錯日誌 ---
  console.log(`--- DEBUG INFO ---`);
  console.log(`Username from Env: ${username}`);
  // 警告：在正式環境中印出密碼是不安全的，偵錯完成後應移除
  console.log(`Password from Env: ${password ? '********' : '(not set)'}`); 
  // --- 結束 ---

  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

  // --- 新增的偵錯日誌 ---
  console.log(`Hashed Password Sent: ${hashedPassword}`);
  console.log(`------------------`);
  // --- 結束 ---

  const AUTH_ENDPOINT = '/api/v1/login/login';
  const targetApiHost = 'http://39.108.191.53:8089';
  const authUrl = `${targetApiHost}${AUTH_ENDPOINT}`;

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username,
        password: hashedPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.msg === 'login fail' || !data.data || !data.data.accessToken) {
       // 讓錯誤訊息更明確
      throw new Error(`Failed to fetch token: API responded with message - "${data.msg || 'Unknown error'}"`);
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

// ... (module.exports 主處理函數不變) ...
module.exports = async (req, res) => {
  try {
    const xToken = await getValidToken();
    const appKey = process.env.APP_KEY;

    const targetApiHost = 'http://39.108.191.53:8089';
    const targetPath = req.url.replace('/api/proxy', '');
    const targetUrl = `${targetApiHost}${targetPath}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'App-Key': appKey,
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