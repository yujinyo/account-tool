// 获取/更新用户分享记录 API - 使用 JSONBin
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
    const JSONBIN_API = 'https://api.jsonbin.io/v3';

    if (!MASTER_KEY) {
      return res.status(500).json({ error: '服务器未配置' });
    }

    // 验证 token (即 userBinId)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录' });
    }
    const userBinId = authHeader.substring(7);

    // 验证 userBinId 是否有效
    try {
      const testResp = await fetch(`${JSONBIN_API}/b/${userBinId}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY }
      });
      if (!testResp.ok) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
      }
    } catch (e) {
      return res.status(401).json({ error: '登录已过期，请重新登录' });
    }

    // GET - 获取分享记录列表
    if (req.method === 'GET') {
      const userResp = await fetch(`${JSONBIN_API}/b/${userBinId}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY }
      });
      const userData = await userResp.json();
      const userRecord = userData.record || {};

      const shareRecords = userRecord.shareRecords || [];
      const JSONBIN_API_R = 'https://api.jsonbin.io/v3/b';

      // 获取每个分享记录的详细信息
      const recordsWithStatus = [];
      for (const recordId of shareRecords) {
        try {
          const recordResp = await fetch(`${JSONBIN_API_R}/${recordId}/latest`, {
            headers: { 'X-Master-Key': MASTER_KEY }
          });
          if (recordResp.ok) {
            const recordData = await recordResp.json();
            const parsed = recordData.record || recordData;
            const usedCount = parsed.usedAccounts
              ? Object.keys(parsed.usedAccounts).filter(k => parsed.usedAccounts[k]).length
              : 0;
            recordsWithStatus.push({
              binId: recordId,
              accountCount: parsed.accounts ? parsed.accounts.length : 0,
              usedCount: usedCount,
              createdAt: parsed.createdAt || Date.now(),
              note: parsed.note || ''
            });
          }
        } catch (e) {
          console.error('Error fetching record:', recordId, e);
        }
      }

      return res.status(200).json({
        success: true,
        records: recordsWithStatus
      });
    }

    // PUT - 添加分享记录到用户账号
    if (req.method === 'PUT') {
      const { binId, accountCount, note } = req.body;

      if (!binId) return res.status(400).json({ error: '缺少 binId' });

      // 获取当前用户数据
      const userResp = await fetch(`${JSONBIN_API}/b/${userBinId}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY }
      });
      const userData = await userResp.json();
      const userRecord = userData.record || {};

      if (!userRecord.shareRecords) userRecord.shareRecords = [];

      // 添加新记录（如果不存在）
      if (!userRecord.shareRecords.includes(binId)) {
        userRecord.shareRecords.unshift(binId);
      }

      // 更新用户的 note (如果存在)
      // 注意：note 是存在分享数据 bin 里的，不是用户 bin

      // 保存用户数据
      await fetch(`${JSONBIN_API}/b/${userBinId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': MASTER_KEY
        },
        body: JSON.stringify(userRecord)
      });

      // 如果提供了 note，更新分享数据 bin
      if (note !== undefined) {
        try {
          const shareResp = await fetch(`${JSONBIN_API}/b/${binId}/latest`, {
            headers: { 'X-Master-Key': MASTER_KEY }
          });
          const shareData = await shareResp.json();
          const shareRecord = shareData.record || {};
          shareRecord.note = note;
          await fetch(`${JSONBIN_API}/b/${binId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Master-Key': MASTER_KEY
            },
            body: JSON.stringify(shareRecord)
          });
        } catch (e) {
          console.error('Error updating note:', e);
        }
      }

      return res.status(200).json({ success: true, message: '记录已保存' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Records API error:', error);
    return res.status(500).json({ error: '服务器错误' });
  }
}
