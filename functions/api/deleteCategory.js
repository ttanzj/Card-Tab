export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (url.pathname !== '/api/deleteCategory') {
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
    const { category } = await request.json();
    const userId = 'testUser';
    const kvBinding = validation.kvBinding || 'CARD_ORDER';
    const kvStore = env[kvBinding];
    
    let data = await kvStore.get(userId);
    
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
    
    if (!parsedData.categories[category]) {
      return new Response(JSON.stringify({ 
        success: false,
        error: '分类不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    parsedData.links = parsedData.links.filter(link => link.category !== category);
    
    delete parsedData.categories[category];
    
    await kvStore.put(userId, JSON.stringify(parsedData));
    
    return new Response(JSON.stringify({ 
      success: true,
      message: '删除分类成功'
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