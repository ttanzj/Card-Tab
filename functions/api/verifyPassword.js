export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    let password;
    try {
      const body = await request.json();
      password = body.password;
    } catch (e) {
      return new Response(JSON.stringify({ 
        valid: false,
        error: 'Invalid request body'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!password) {
      return new Response(JSON.stringify({ 
        valid: false,
        error: 'Password is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const adminPassword = env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
      return new Response(JSON.stringify({ 
        valid: false,
        error: 'Server configuration error: ADMIN_PASSWORD not set'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const isValid = password === adminPassword;
    
    if (isValid) {
      const timestamp = Date.now();
      const tokenData = timestamp + "_" + adminPassword; 
      const encoder = new TextEncoder();
      const data = encoder.encode(tokenData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      const token = timestamp + "." + btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
      
      return new Response(JSON.stringify({ 
        valid: true,
        token: token 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      valid: false,
      error: 'Invalid password'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      valid: false,
      error: error.message || 'Server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}