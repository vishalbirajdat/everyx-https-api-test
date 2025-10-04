/**
 * Sanitizes API response data for consistent snapshot testing
 * Removes or replaces dynamic values that change between test runs
 */
function sanitizeResponse(response) {
    if (!response || typeof response !== 'object') {
        return response;
    }

    const sanitized = { ...response };

    // Remove or sanitize dynamic fields that change between test runs
    if (sanitized.id) {
        sanitized.id = '[DYNAMIC_ID]';
    }

    if (sanitized.created_at) {
        sanitized.created_at = '[DYNAMIC_TIMESTAMP]';
    }

    if (sanitized.updated_at) {
        sanitized.updated_at = '[DYNAMIC_TIMESTAMP]';
    }

    if (sanitized.timestamp) {
        sanitized.timestamp = '[DYNAMIC_TIMESTAMP]';
    }

    // Sanitize JWT token fields
    if (sanitized.token) {
        sanitized.token = '[DYNAMIC_JWT_TOKEN]';
    }

    if (sanitized.iat) {
        sanitized.iat = '[DYNAMIC_TIMESTAMP]';
    }

    if (sanitized.exp) {
        sanitized.exp = '[DYNAMIC_TIMESTAMP]';
    }

    // Sanitize any nested objects or arrays
    Object.keys(sanitized).forEach(key => {
        if (Array.isArray(sanitized[key])) {
            sanitized[key] = sanitized[key].map(item => 
                typeof item === 'object' ? sanitizeResponse(item) : item
            );
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeResponse(sanitized[key]);
        }
    });

    return sanitized;
}

module.exports = {
    sanitizeResponse
};
