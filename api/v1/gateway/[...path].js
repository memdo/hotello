export default async function handler(req, res) {
  try {
    const { path } = req.query; // path will be an array like ["hotels", "search"]
    
    if (!path || path.length === 0) {
      return res.status(400).json({ error: 'Invalid API path' });
    }

    const [service, ...rest] = path;
    const token = req.headers.authorization;
    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;

    // Map the requested service to the internal Vercel function path
    const routes = {
      hotels: `${baseUrl}/api/v1/hotels`,
      comments: `${baseUrl}/api/v1/comments`,
      ai: `${baseUrl}/api/v1/ai`,
      notifications: `${baseUrl}/api/v1/notifications`,
    };

    if (!routes[service]) {
      return res.status(404).json({ error: `Service '${service}' not found` });
    }

    // Reconstruct the target URL with query parameters
    let targetUrl = `${routes[service]}/${rest.join('/')}`;
    
    // Copy query parameters, excluding the 'path' parameter used by Vercel dynamic routing
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'path') {
            queryParams.append(key, value);
        }
    }
    
    if (queryParams.toString()) {
        targetUrl += `?${queryParams.toString()}`;
    }

    const fetchOptions = {
      method: req.method,
      headers: { 
        'Content-Type': 'application/json',
      },
    };
    
    // Forward the authorization token if present
    if (token) {
        fetchOptions.headers['Authorization'] = token;
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Forward the request
    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        return res.status(response.status).json(data);
    } else {
        const textData = await response.text();
        return res.status(response.status).send(textData);
    }

  } catch (error) {
    console.error('API Gateway Error:', error);
    return res.status(500).json({ error: 'Internal Gateway Error' });
  }
}
