const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/app/profile',
  method: 'GET',
  headers: {
    // Optionally provide a Bearer token if you have one, or test guest fallback first
    'Authorization': 'Bearer test-token-123'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Profile API Response:');
      
      if (parsed.data) {
        console.log('- User Profile:', JSON.stringify(parsed.data.user, null, 2));
        console.log('- Languages returned:', parsed.data.languages ? parsed.data.languages.length : 0);
        console.log('- Downloads (sample):', JSON.stringify(parsed.data.downloads?.[0], null, 2));
        console.log('- Wishlist (sample):', JSON.stringify(parsed.data.wishlist?.[0], null, 2));
      } else {
        console.log(parsed);
      }
    } catch (e) {
      console.error('Failed to parse response:', e);
      console.log('Raw data:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
