// Simple health check API for Vercel
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  res.status(200).json({
    status: 'ok',
    message: 'Bio-acoustic modulation API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};