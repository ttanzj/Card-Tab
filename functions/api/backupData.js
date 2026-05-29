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
        response: { error: 'Unauthorized', message: '未登录或登录已过期' }
      };
    }

    try {
      const [timestamp, hash] = authToken.split('.');
      // const tokenTimestamp = parseInt(timestamp);
      // const now = Date.now();
      
      // const FIFTEEN_MINUTES = 15 * 60 * 1000;
      // if (now - tokenTimestamp > FIFTEEN_MINUTES) {
      //   return {
      //     isValid: false,
      //     status: 401,
      //     response: { 
      //       error: 'Token expired',
      //       tokenExpired: true,
      //       message: '登录已过期，请重新登录'
      //     }
      //   };
      // }
      
      const tokenData = timestamp + "_" + env.ADMIN_PASSWORD;
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
          }
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        status: 401,
        response: { 
          error: 'Invalid token',
          tokenInvalid: true,
          message: '登录验证失败，请重新登录'
        }
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
    const sourceData = await env.CARD_ORDER.get(sourceUserId);
    
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
        
        const backups = await env.CARD_ORDER.list({ prefix: 'backup_' });
        const backupKeys = backups.keys.map(key => key.name).sort((a, b) => {
          const timeA = new Date(a.split('_')[1].replace(/-/g, '/')).getTime();
          const timeB = new Date(b.split('_')[1].replace(/-/g, '/')).getTime();
          return timeB - timeA;
        });
        
        await env.CARD_ORDER.put(backupId, sourceData);
        
        const allBackups = [...backupKeys, backupId].sort((a, b) => {
          const timeA = new Date(a.split('_')[1].replace(/-/g, '/')).getTime();
          const timeB = new Date(b.split('_')[1].replace(/-/g, '/')).getTime();
          return timeB - timeA;
        });
        
        const backupsToDelete = allBackups.slice(MAX_BACKUPS);
        
        if (backupsToDelete.length > 0) {
          await Promise.all(
            backupsToDelete.map(key => env.CARD_ORDER.delete(key))
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