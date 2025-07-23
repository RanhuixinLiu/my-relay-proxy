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
  // Check if the cached token is still valid (with a 60-second buffer)
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.value;
  }

  // Fetch a new token if needed
  const username = process.env.LOGIN_USERNAME;
  const password = process.env.LOGIN_PASSWORD;

  if (!username || !password) {
    throw new Error('Username or Password is not set in Vercel Environment Variables.');
  }

  // Hash the password using MD5
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

  // The correct authentication endpoint you found
  const AUTH_ENDPOINT = '/api/v1/login/login';
  const targetApiHost = 'http://39.108.191.53:8089';
  const authUrl = `${targetApiHost}${AUTH_ENDPOINT}`;

  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Use the username and hashed password for the login request body
      body: JSON.stringify({
        username: username,
        password: hashedPassword,
      }),
    });

    const data = await response.json();

    // Use the correct field names from the response you provided
    if (!response.ok || !data.data || !data.data.token) {
      throw new Error(`Failed to fetch token: ${data.msg || 'Unknown error'}`);
    }

    const accessToken = data.data.token;
    const expiresIn = data.data.expires_in; // Corrected field name

    // Update the cache
    // Note: The expiresIn value looks like a future timestamp, not a duration. We will use it directly.
    cachedToken.value = accessToken;
    cachedToken.expiresAt = expiresIn * 1000; // Convert timestamp to milliseconds

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
    const appKey = process.env.APP_KEY;

    // 2. Prepare to forward the user's request
    const targetApiHost = 'http://39.108.191.53:8089';
    const targetPath = req.url.replace('/api/proxy', '');
    const targetUrl = `${targetApiHost}${targetPath}`;

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'App-Key': appKey,
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