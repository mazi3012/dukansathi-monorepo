from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Rate Limiting Middleware
class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 100, time_window: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = {}
    
    async def dispatch(self, request: Request, call_next):
        ip = request.client.host
        now = datetime.now()
        if ip not in self.requests:
            self.requests[ip] = []
        self.requests[ip] = [timestamp for timestamp in self.requests[ip] if (now - timestamp).seconds < self.time_window]
        if len(self.requests[ip]) < self.max_requests:
            self.requests[ip].append(now)
            response = await call_next(request)
            return response
        return Response("Too Many Requests", status_code=429)

app.add_middleware(RateLimitMiddleware)

# Security Headers Middleware
@app.middleware("http")
def add_security_headers(request: Request, call_next):
    response = call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Input Validation Middleware
@app.middleware("http")
def validate_input(request: Request, call_next):
    body = await request.json()  # For JSON body validation
    if "key" not in body:
        return Response("Invalid input: 'key' is required", status_code=400)
    response = await call_next(request)
    return response

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)