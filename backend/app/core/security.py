"""Protections for a web server that only runs on the user's own computer.

1. Cross-site requests: any website the user visits can send simple form posts (including file
   uploads) to http://127.0.0.1. Every request that changes something must carry the
   X-CareerPilot header; browsers only let another site add a custom header after a CORS
   pre-flight, which CareerPilot refuses for unknown origins.
2. DNS rebinding: a site could point its own domain at 127.0.0.1 and then read the API as
   "same origin". Only requests addressed to this computer's own names are accepted.
3. Standard security headers on every response.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

CSRF_HEADER = "x-careerpilot"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]", "tauri.localhost", "testserver"}

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
}


class LocalSecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        host = (request.headers.get("host") or "").rsplit(":", 1)[0].lower()
        if host.startswith("[") and "]" in host:  # IPv6 "[::1]:8000"
            host = host[: host.index("]") + 1]
        if host not in ALLOWED_HOSTS:
            return JSONResponse({"detail": "Requests must be addressed to this computer."}, 400)

        if request.method not in SAFE_METHODS and request.headers.get(CSRF_HEADER) != "1":
            return JSONResponse(
                {"detail": "Missing the X-CareerPilot header (blocks cross-site requests)."}, 403
            )

        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response
