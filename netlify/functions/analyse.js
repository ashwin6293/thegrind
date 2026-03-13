const https = require('https');

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'API key not configured on server.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  const { prompt } = body;
  if (!prompt) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing prompt.' }) };
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: 'You are a senior sports data scientist and physician with 20 years of experience analysing athlete training loads, physiological adaptation, and long-term performance trends. You combine the precision of a data scientist with the clinical insight of a sports medicine doctor. Your analysis is honest, specific, and actionable — you do not give generic fitness advice. Every insight must be grounded in the actual numbers provided.',
    messages: [{ role: 'user', content: prompt }]
  });

  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const response = await httpsPost(options, payload);

    if (response.status !== 200) {
      let errMsg = response.body;
      try {
        const errJson = JSON.parse(response.body);
        errMsg = errJson.error?.message || response.body;
      } catch(e) {}
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Claude API error (${response.status}): ${errMsg}` })
      };
    }

    const data = JSON.parse(response.body);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: data.content[0].text })
    };

  } catch(e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Function error: ' + e.message })
    };
  }
};
