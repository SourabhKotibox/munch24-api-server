const http = require('http');

const endpoints = [
  '/api/dashboard/stats?period=year',
  '/api/dashboard/revenue?period=year',
  '/api/dashboard/subscribers?period=year',
  '/api/dashboard/most-watched?period=year',
  '/api/dashboard/top-genres?period=year',
  '/api/dashboard/reviews?period=year',
  '/api/dashboard/transactions?period=year',
];

const testEndpoint = (path) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        // Optional Auth if needed, usually Admin requests might need headers.
        // Assuming dashboard doesn't strictly block in this test environment without token 
        // or we need to bypass. If it fails due to auth, we'll see 401.
        // Actually, dashboard might require a token. Let's see what happens.
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ path, statusCode: res.statusCode, data });
      });
    });

    req.on('error', (e) => {
      resolve({ path, error: e.message });
    });
    req.end();
  });
};

async function runTests() {
  for (const path of endpoints) {
    const result = await testEndpoint(path);
    console.log(`[${result.statusCode || 'ERR'}] ${result.path}`);
    if (result.statusCode === 200) {
      try {
        const parsed = JSON.parse(result.data);
        console.log(`  -> Success: data payload size = ${JSON.stringify(parsed.data).length} chars`);
        // console.log(JSON.stringify(parsed.data, null, 2));
      } catch (e) {
        console.log(`  -> Failed to parse JSON`);
      }
    } else {
      console.log(`  -> Error Response: ${result.data || result.error}`);
    }
  }
}

runTests();
