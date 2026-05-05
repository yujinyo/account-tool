// 用户登录 API - 使用 JSONBin 存储
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, passwordHash } = req.body;

    if (!username || !passwordHash) return res.status(400).json({ error: '用户名和密码不能为空' });

    const MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
    const USER_BIN_ID = process.env.JSONBIN_USER_BIN_ID;
    const JSONBIN_API = 'https://api.jsonbin.io/v3';

    if (!MASTER_KEY || !USER_BIN_ID) {
      return res.status(500).json({ error: '服务器未配置，请联系管理员' });
    }

    // 1. 从索引 bin 获取用户的 bin ID
    const indexResp = await fetch(`${JSONBIN_API}/b/${USER_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': MASTER_KEY }
    });
    const indexData = await indexResp.json();
    const userIndex = indexData.record || {};

    const userBinId = userIndex[username];
    if (!userBinId) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 2. 读取用户详细信息，验证密码
    const userResp = await fetch(`${JSONBIN_API}/b/${userBinId}/latest`, {
      headers: { 'X-Master-Key': MASTER_KEY }
    });
    const userData = await userResp.json();
    const userRecord = userData.record || userData;

    if (!userRecord || userRecord.passwordHash !== passwordHash) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 3. 返回 token (userBinId)
    return res.status(200).json({
      success: true,
      message: '登录成功',
      token: userBinId,
      username: username
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: '服务器错误，请重试' });
  }
}
