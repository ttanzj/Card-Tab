export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname !== '/api/backupData') {
    return new Response('Not Found', { status: 404 });
  }

  async function validateServerToken(authToken, env) {
    if (!authToken) {
      return {
        isValid: false,
        status: 401,
        response: { error: 'Unauthorized', message: '未登录或登录已过期' },
        kvBinding: null
      };
    }

    try {
      const parts = authToken.split('.');
      if (parts.length !== 3) {
        return {
          isValid: false,
          status: 401,
          response: { 
            error: 'Invalid token',
            tokenInvalid: true,
            message: '登录状态无效，请重新登录'
          },
          kvBinding: null
        };
      }

      const [timestamp, hash, kvBinding] = parts;
      
      const users = [
        { password: env.ADMIN_PASSWORD, kvBinding: 'CARD_ORDER' },
        { password: env.ADMIN_PASSWORD1, kvBinding: 'CARD_ORDER1' },
        { password: env.ADMIN_PASSWORD2, kvBinding: 'CARD_ORDER2' },
        { password: env.ADMIN_PASSWORD3, kvBinding: 'CARD_ORDER3' }
      ].filter(user => user.password);

      const matchedUser = users.find(user => user.kvBinding === kvBinding);
      
      if (!matchedUser) {
        return {
          isValid: false,
          status: 401,
          response: { 
            error: 'Invalid token',
            tokenInvalid: true,
            message: '登录状态无效，请重新登录'
          },
          kvBinding: null
        };
      }

      const tokenData = timestamp + "_" + matchedUser.password + "_" + kvBinding;
      const encoder = new TextEncoder();
      const data = encoder.encode(tokenData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const expectedHash = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      
      if (hash !== expectedHash) {
        return {
          isValid: false,
          status: 401,
          response: { 
            error: 'Invalid token',
            tokenInvalid: true,
            message: '登录状态无效，请重新登录'
          },
          kvBinding: null
        };
      }

      return { isValid: true, kvBinding: kvBinding };
    } catch (error) {
      return {
        isValid: false,
        status: 401,
        response: { 
          error: 'Invalid token',
          tokenInvalid: true,
          message: '登录验证失败，请重新登录'
        },
        kvBinding: null
      };
    }
  }

  const authToken = request.headers.get('Authorization');
  const validation = await validateServerToken(authToken, env);
  
  if (!validation.isValid) {
    return new Response(JSON.stringify(validation.response), {
      status: validation.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { sourceUserId } = await request.json();
    const MAX_BACKUPS = 10;
    const kvBinding = validation.kvBinding || 'CARD_ORDER';
    const kvStore = env[kvBinding];
    const sourceData = await kvStore.get(sourceUserId);
    
    if (sourceData) {
      try {
        const currentDate = new Date().toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-'); 
        
        const backupId = `backup_${currentDate}`;
        
        const backups = await kvStore.list({ prefix: 'backup_' });
        const backupKeys = backups.keys.map(key => key.name).sort((a, b) => {
          const timeA = new Date(a.split('_')[1].replace(/-/g, '/')).getTime();
          const timeB = new Date(b.split('_')[1].replace(/-/g, '/')).getTime();
          return timeB - timeA;
        });
        
        await kvStore.put(backupId, sourceData);
        
        const allBackups = [...backupKeys, backupId].sort((a, b) => {
          const timeA = new Date(a.split('_')[1].replace(/-/g, '/')).getTime();
          const timeB = new Date(b.split('_')[1].replace(/-/g, '/')).getTime();
          return timeB - timeA;
        });
        
        const backupsToDelete = allBackups.slice(MAX_BACKUPS);
        
        if (backupsToDelete.length > 0) {
          await Promise.all(
            backupsToDelete.map(key => kvStore.delete(key))
          );
        }
    
        return new Response(JSON.stringify({ 
          success: true, 
          backupId,
          remainingBackups: MAX_BACKUPS,
          deletedCount: backupsToDelete.length 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Backup operation failed',
          details: error.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response(JSON.stringify({ success: false, error: 'Source data not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}