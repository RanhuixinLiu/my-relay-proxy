// File Path: api/proxy.js

const fetch = require('node-fetch');
const crypto = require('crypto');

// This object will cache the token in memory
let cachedToken = {
  value: null,
  expiresAt: 0,
};

// --- This function gets the token ---
async function getValidToken() {
  // Check if the cached token is still valid
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.value;
  }

  // Fetch a new token if needed
  const username = process.env.LOGIN_USERNAME;
  const password = process.env.LOGIN_PASSWORD;

  if (!username || !password) {
    throw new Error('Username or Password is not set in Vercel Environment Variables.');
  }

  // 1. Calculate the standard MD5 hash
  const standardHash = crypto.createHash('md5').update(password).digest('hex');

  // 2. Apply the custom shuffling algorithm you discovered!
  const finalPassword = standardHash.slice(-6) + standardHash.slice(6, 26) + standardHash.slice(0, 6);

  // The correct authentication endpoint
  const AUTH_ENDPOINT = '/api/v1/login/login';
  const targetApiHost = 'http://39.108.191.53:8089';
  const authUrl = `${targetApiHost}${AUTH_ENDPOINT}`;

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Use the username and the final shuffled password
      body: JSON.stringify({
        username: username,
        password: finalPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.data || !data.data.token) {
      throw new Error(`Failed to fetch token: ${data.msg || 'Unknown error'}`);
    }

    const accessToken = data.data.token;
    const expiresIn = data.data.expires_in;

    // Update the cache
    cachedToken.value = accessToken;
    cachedToken.expiresAt = expiresIn * 1000;

    return accessToken;

  } catch (error) {
    console.error('Error fetching token:', error);
    cachedToken = { value: null, expiresAt: 0 };
    throw error;
  }
}


// --- This is our main proxy handler ---
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