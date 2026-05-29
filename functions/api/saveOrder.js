export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname !== '/api/saveOrder') {
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
    const { userId, links, categories } = await request.json();
    await env.CARD_ORDER.put(userId, JSON.stringify({ links, categories }));
    return new Response(JSON.stringify({ 
      success: true,
      message: '保存成功'
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