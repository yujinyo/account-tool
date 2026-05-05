// 用户注册 API - 使用 JSONBin 存储
// 需要环境变量: JSONBIN_MASTER_KEY, JSONBIN_USER_BIN_ID
// JSONBIN_USER_BIN_ID 是一个索引 bin，存储 username -> userBinId 的映射

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { username, password } = req.body;

    if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: '用户名长度需要在3-20个字符之间' });
    if (password.length < 6) return res.status(400).json({ error: '密码长度至少6个字符' });

    const MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
    const USER_BIN_ID = process.env.JSONBIN_USER_BIN_ID;
    const JSONBIN_API = 'https://api.jsonbin.io/v3';

    if (!MASTER_KEY || !USER_BIN_ID) {
      return res.status(500).json({ error: '服务器未配置，请联系管理员' });
    }

    // 1. 读取用户索引，检查用户名是否存在
    const indexResp = await fetch(`${JSONBIN_API}/b/${USER_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': MASTER_KEY }
    });
    const indexData = await indexResp.json();
    const userIndex = indexData.record || {};

    if (userIndex[username]) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 2. 对密码进行 SHA-256 hash (由前端传 hash 后的密码，更安全)
    // 前端会用 Web Crypto API 计算 sha256(password) 再发送

    // 3. 为用户创建独立的私有 bin 存储详细信息
    const userBinResp = await fetch(`${JSONBIN_API}/b`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify({
        username: username,
        passwordHash: password, // 前端传来的 SHA-256 hash
        createdAt: Date.now(),
        shareRecords: [] // 存储分享记录的 binId 列表
      })
    });

    const userBinResult = await userBinResp.json();
    if (!userBinResult.metadata || !userBinResult.metadata.id) {
      return res.status(500).json({ error: '创建用户失败，请重试' });
    }

    const userBinId = userBinResult.metadata.id;

    // 4. 更新索引 bin
    userIndex[username] = userBinId;
    await fetch(`${JSONBIN_API}/b/${USER_BIN_ID}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': MASTER_KEY
      },
      body: JSON.stringify(userIndex)
    });

    // 5. 返回 token (用 userBinId 作为 token，前端存储)
    return res.status(200).json({
      success: true,
      message: '注册成功',
      token: userBinId,
      username: username
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: '服务器错误，请重试' });
  }
}
