/**
 * SEC-02 — Frontend API Client
 * All state-changing calls go through api() which adds:
 *   - credentials: 'include' (sends HttpOnly authToken cookie)
 *   - X-CSRF-Token header (sends non-HttpOnly csrfToken cookie value)
 */

let _csrfToken = null;

function getCookieValue(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

export async function getCsrfToken() {
    if (!_csrfToken) _csrfToken = getCookieValue('csrfToken');
    if (!_csrfToken) {
        try {
            const res = await fetch('/api/auth/csrf', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                _csrfToken = data.csrfToken;
            }
        } catch (e) { console.error('Failed to fetch CSRF token', e); }
    }
    return _csrfToken;
}

export function clearCsrfToken() { _csrfToken = null; }

export async function api(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const stateMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    const headers = { ...(options.headers || {}) };
    if (stateMutating) {
        const csrf = await getCsrfToken();
        if (csrf) headers['X-CSRF-Token'] = csrf;
    }
    return fetch(url, { ...options, credentials: 'include', headers });
}
