const fetch = require('node-fetch');

async function run() {
  const res = await fetch('http://127.0.0.1:3000/api/ads', {
    method: 'POST',
    body: JSON.stringify({ data: { adName: "Test" } }),
    headers: { 'Content-Type': 'application/json' }
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
run();
