export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || 'testUser';
  const authToken = request.headers.get('Authorization');

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

  try {
    let data = null;
    let foundKeyName = null;
    let allKeys = [];
    
    console.log('[getLinks] Starting request, userId:', userId);
    console.log('[getLinks] env keys:', Object.keys(env || {}));
    
    if (env.CARD_ORDER && typeof env.CARD_ORDER.get === 'function') {
      try {
        if (typeof env.CARD_ORDER.list === 'function') {
          try {
            const listResult = await env.CARD_ORDER.list({ limit: 50 });
            allKeys = listResult.keys.map(k => k.name);
            console.log('[getLinks] KV keys available:', allKeys);
          } catch (listError) {
            console.error('[getLinks] KV list error:', listError);
          }
        }
        
        console.log('[getLinks] Attempting to read requested userId:', userId);
        data = await env.CARD_ORDER.get(userId);
        if (data) {
          foundKeyName = userId;
          console.log('[getLinks] Successfully read userId:', userId);
        } else {
          console.log('[getLinks] userId not found, available keys:', allKeys);
        }
      } catch (kvError) {
        console.error('[getLinks] KV read error:', kvError);
      }
    } else {
      console.error('[getLinks] CARD_ORDER KV binding is not available');
    }

    const navTitle = env.NAV_TITLE || '我的导航';

    if (data) {
      try {
        const parsedData = JSON.parse(data);
        console.log('[getLinks] Parsed data:', JSON.stringify(parsedData).substring(0, 500));
        
        if (authToken) {
          const validation = await validateServerToken(authToken, env);
          if (!validation.isValid) {
            return new Response(JSON.stringify(validation.response), {
              status: validation.status,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return new Response(JSON.stringify({
            ...parsedData,
            navTitle: navTitle
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const filteredLinks = parsedData.links ? parsedData.links.filter(link => !link.isPrivate) : [];
        const filteredCategories = {};
        if (parsedData.categories) {
          Object.keys(parsedData.categories).forEach(category => {
            filteredCategories[category] = parsedData.categories[category].filter(link => !link.isPrivate);
          });
        }

        return new Response(JSON.stringify({
          links: filteredLinks,
          categories: filteredCategories,
          navTitle: navTitle
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (parseError) {
        console.error('[getLinks] JSON parse error:', parseError);
        return new Response(JSON.stringify({
          links: [],
          categories: {},
          navTitle: navTitle,
          error: '数据格式错误: ' + parseError.message
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('[getLinks] No data found for userId:', userId);
    
    let availableKeys = [];
    if (env.CARD_ORDER && typeof env.CARD_ORDER.list === 'function') {
      try {
        const listResult = await env.CARD_ORDER.list({ limit: 50 });
        availableKeys = listResult.keys.map(k => k.name);
      } catch (e) {
        console.error('[getLinks] Failed to list keys:', e);
      }
    }
    
    return new Response(JSON.stringify({
      links: [],
      categories: {},
      navTitle: navTitle,
      debug: 'KV中没有找到数据，可能需要先添加分类和链接',
      requestedUserId: userId,
      availableKeys: availableKeys
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error loading links:', error);
    return new Response(JSON.stringify({
      links: [],
      categories: {},
      navTitle: '我的导航',
      error: error.message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
