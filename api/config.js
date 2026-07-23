export default function handler(req, res) {
  // Allow CORS for same-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Return secrets from Vercel environment variables
  res.json({
    adminPassword: process.env.VITE_ADMIN_PASSWORD || 'CHICHI26303@Admin',
    mpesat: process.env.VITE_MPESA_TILL || '8941840'
  });
}