const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  const secret = process.env.API_SECRET;
  if (!secret) return res.status(500).send('API_SECRET not configured');

  const provided = req.query.secret || req.cookies?.secret;
  if (provided !== secret) {
    return res.send(loginPage());
  }

  // Set cookie so JS can use it for API calls
  res.cookie('secret', provided, { httpOnly: false, sameSite: 'strict' });
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'admin.html'));
});

function loginPage() {
  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"><title>Admin - PixelCoder</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.login { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 32px; width: 360px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.login h1 { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 20px; }
.login form { display: flex; gap: 8px; }
.login input { flex: 1; padding: 8px 12px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px; outline: none; }
.login input:focus { border-color: #666; }
.login button { padding: 8px 16px; background: #333; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.login button:hover { background: #555; }
</style>
</head><body>
<div class="login">
  <h1>PixelCoder Admin</h1>
  <form method="GET">
    <input type="password" name="secret" placeholder="API Secret" autofocus>
    <button type="submit">Login</button>
  </form>
</div>
</body></html>`;
}

module.exports = router;
