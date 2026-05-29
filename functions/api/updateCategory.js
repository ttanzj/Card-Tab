export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!url.pathname.endsWith('/updateCategory')) {
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
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
      
      const adminPassword = env.ADMIN_PASSWORD;
      const tokenData = timestamp + "_" + adminPassword; 
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
    const { oldName, newName } = await request.json();
    const userId = 'testUser';
    
    let data = await env.CARD_ORDER.get(userId);
    
    if (!data) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '数据不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let parsedData = JSON.parse(data);
    
    if (!parsedData.links) {
      parsedData.links = [];
    }
    
    if (!parsedData.categories) {
      parsedData.categories = {};
    }
    
    if (!parsedData.categories[oldName]) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '分类不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (parsedData.categories[newName]) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '分类名称已存在'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    parsedData.categories[newName] = parsedData.categories[oldName];
    delete parsedData.categories[oldName];
    
    parsedData.links.forEach(link => {
      if (link.category === oldName) {
        link.category = newName;
      }
    });
    
    await env.CARD_ORDER.put(userId, JSON.stringify(parsedData));
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '更新分类名称成功'
    }), { 
      status: 200,
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