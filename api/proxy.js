// File Path: api/proxy.js

const fetch = require('node-fetch');

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
  const appKey = process.env.APP_KEY;
  const appSecret = process.env.APP_SECRET;

  // The correct authentication endpoint you found!
  const AUTH_ENDPOINT = '/api/v1/login/login';
  const targetApiHost = 'http://39.108.191.53:8089';
  const authUrl = `${targetApiHost}${AUTH_ENDPOINT}`;

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // IMPORTANT: Check your API documentation to confirm the body parameter names
      body: JSON.stringify({
        appKey: appKey,
        appSecret: appSecret,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.data || !data.data.accessToken) {
      throw new Error(`Failed to fetch token: ${data.msg || 'Unknown error'}`);
    }

    const accessToken = data.data.accessToken;
    const expiresIn = data.data.expiresIn;

    // Update the cache
    cachedToken.value = accessToken;
    cachedToken.expiresAt = Date.now() + expiresIn * 1000;

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
    // 1. Get a valid X-Token automatically
    const xToken = await getValidToken();

    // 2. Prepare to forward the user's request
    const targetApiHost = 'http://39.108.191.53:8089';
    const targetPath = req.url.replace('/api/proxy', '');
    const targetUrl = `${targetApiHost}${targetPath}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'App-Key': process.env.APP_KEY, // Use the App Key from environment variables
        'X-Token': xToken, // Use the automatically fetched token
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // 3. Forward the request to the target API
    const targetResponse = await fetch(targetUrl, fetchOptions);
    const responseData = await targetResponse.json();

    res.status(targetResponse.status).json(responseData);

  } catch (error) {
    console.error('Proxy handler error:', error);
    res.status(500).json({ error: 'An error occurred in the proxy handler.', details: error.message });
  }
};