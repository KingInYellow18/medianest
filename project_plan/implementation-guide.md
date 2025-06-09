# Development Implementation Guide

## Quick Start Commands

### Development Setup
```bash
# Clone repository
git clone <repository-url>
cd media-management-app

# Start development environment
docker-compose up -d

# Install dependencies
cd backend && pip install -r requirements.txt
cd ../frontend && npm install

# Run migrations
cd backend && flask db upgrade

# Start development servers
cd backend && flask run
cd ../frontend && npm start
```

### Docker Commands
```bash
# Build all services
docker-compose build

# Start services with logs
docker-compose up

# Run in detached mode
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Execute commands in container
docker-compose exec backend bash
docker-compose exec frontend bash
```

## Database Management

### Migration Commands
```bash
# Create new migration
flask db migrate -m "Description of changes"

# Apply migrations
flask db upgrade

# Rollback migration
flask db downgrade

# Show migration history
flask db history
```

### SQLAlchemy Models Example
```python
from app import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), default='user')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

class MediaRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    media_type = db.Column(db.String(20), nullable=False)  # movie, tv
    status = db.Column(db.String(20), default='pending')
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
```

## API Implementation Patterns

### JWT Authentication Decorator
```python
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User

def require_role(role):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def wrapper(*args, **kwargs):
            current_user = User.query.get(get_jwt_identity())
            if not current_user or current_user.role != role:
                return {'message': 'Insufficient permissions'}, 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

# Usage
@app.route('/api/admin/users')
@require_role('admin')
def get_all_users():
    pass
```

### API Response Patterns
```python
from flask import jsonify

def success_response(data=None, message="Success"):
    response = {
        'success': True,
        'message': message
    }
    if data is not None:
        response['data'] = data
    return jsonify(response)

def error_response(message, status_code=400):
    return jsonify({
        'success': False,
        'error': message
    }), status_code

# Usage
@app.route('/api/users')
def get_users():
    try:
        users = User.query.all()
        return success_response([user.to_dict() for user in users])
    except Exception as e:
        return error_response(str(e), 500)
```

## Frontend Development Patterns

### React Component Structure
```typescript
// components/MediaRequest/MediaRequestCard.tsx
import React from 'react';
import { MediaRequest } from '../../types';

interface MediaRequestCardProps {
  request: MediaRequest;
  onStatusChange: (id: number, status: string) => void;
}

export const MediaRequestCard: React.FC<MediaRequestCardProps> = ({
  request,
  onStatusChange
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold">{request.title}</h3>
      <p className="text-gray-600">{request.mediaType}</p>
      <div className="mt-4">
        <span className={`px-2 py-1 rounded text-sm ${
          request.status === 'approved' ? 'bg-green-100 text-green-800' :
          request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {request.status}
        </span>
      </div>
    </div>
  );
};
```

### Custom Hooks for API Calls
```typescript
// hooks/useMediaRequests.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaService } from '../services/mediaService';

export const useMediaRequests = () => {
  return useQuery({
    queryKey: ['mediaRequests'],
    queryFn: mediaService.getRequests,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useCreateMediaRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: mediaService.createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries(['mediaRequests']);
    },
  });
};
```

### API Service Layer
```typescript
// services/apiClient.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh or redirect to login
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { apiClient };
```

## External Service Integration

### Uptime Kuma Integration
```python
# services/uptime_kuma.py
import asyncio
import websockets
import json
from typing import Dict, List

class UptimeKumaService:
    def __init__(self, url: str, username: str, password: str):
        self.url = url
        self.username = username
        self.password = password
        self.token = None

    async def authenticate(self):
        uri = f"{self.url}/socket.io/?EIO=4&transport=websocket"
        async with websockets.connect(uri) as websocket:
            # Implement WebSocket authentication
            pass

    def get_monitor_status(self) -> Dict:
        # Implementation for getting monitor status
        pass
```

### YouTube Download Integration
```python
# services/youtube_dl.py
import yt_dlp
import os
from typing import Dict, Optional

class YouTubeDownloadService:
    def __init__(self, download_path: str):
        self.download_path = download_path
        
    def download_video(self, url: str, format_selector: str = 'best') -> Dict:
        ydl_opts = {
            'outtmpl': os.path.join(self.download_path, '%(title)s.%(ext)s'),
            'format': format_selector,
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                ydl.download([url])
                return {
                    'success': True,
                    'title': info.get('title'),
                    'duration': info.get('duration'),
                    'filename': f"{info.get('title')}.{info.get('ext')}"
                }
        except Exception as e:
            return {'success': False, 'error': str(e)}
```

## Configuration Management

### YAML Configuration Loader
```python
# config/config_manager.py
import yaml
import os
from typing import Dict, Any

class ConfigManager:
    def __init__(self, config_file: str = 'config/app.yaml'):
        self.config_file = config_file
        self.config = self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        with open(self.config_file, 'r') as file:
            config = yaml.safe_load(file)
        
        # Replace environment variables
        return self._replace_env_vars(config)
    
    def _replace_env_vars(self, obj):
        if isinstance(obj, dict):
            return {k: self._replace_env_vars(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._replace_env_vars(item) for item in obj]
        elif isinstance(obj, str) and obj.startswith('${') and obj.endswith('}'):
            env_var = obj[2:-1]
            return os.getenv(env_var, obj)
        return obj
    
    def get(self, key: str, default=None):
        keys = key.split('.')
        value = self.config
        for k in keys:
            value = value.get(k)
            if value is None:
                return default
        return value
```

## Testing Patterns

### Backend Unit Tests
```python
# tests/test_auth.py
import pytest
from app import create_app, db
from app.models import User

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

def test_login_valid_credentials(client):
    # Create test user
    user = User(username='test', email='test@example.com')
    user.set_password('password')
    db.session.add(user)
    db.session.commit()
    
    response = client.post('/api/auth/login', json={
        'username': 'test',
        'password': 'password'
    })
    
    assert response.status_code == 200
    assert 'access_token' in response.get_json()
```

### Frontend Component Tests
```typescript
// __tests__/MediaRequestCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaRequestCard } from '../components/MediaRequest/MediaRequestCard';

const mockRequest = {
  id: 1,
  title: 'Test Movie',
  mediaType: 'movie',
  status: 'pending',
  requestedAt: '2025-01-01'
};

test('renders media request card', () => {
  render(
    <MediaRequestCard 
      request={mockRequest} 
      onStatusChange={jest.fn()} 
    />
  );
  
  expect(screen.getByText('Test Movie')).toBeInTheDocument();
  expect(screen.getByText('movie')).toBeInTheDocument();
  expect(screen.getByText('pending')).toBeInTheDocument();
});
```

## Security Implementation

### Input Validation with Marshmallow
```python
# schemas/user.py
from marshmallow import Schema, fields, validate, validates_schema, ValidationError

class UserRegistrationSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3, max=80))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8))
    role = fields.Str(validate=validate.OneOf(['user', 'admin']), missing='user')
    
    @validates_schema
    def validate_password_strength(self, data, **kwargs):
        password = data.get('password', '')
        if not any(c.isupper() for c in password):
            raise ValidationError('Password must contain uppercase letter')
        if not any(c.islower() for c in password):
            raise ValidationError('Password must contain lowercase letter')
        if not any(c.isdigit() for c in password):
            raise ValidationError('Password must contain digit')
```

### Rate Limiting
```python
# app/__init__.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Usage on routes
@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    pass
```

## Performance Optimization

### Database Query Optimization
```python
# Eager loading to avoid N+1 queries
users_with_requests = db.session.query(User).options(
    joinedload(User.media_requests)
).all()

# Pagination for large datasets
def get_paginated_requests(page=1, per_page=20):
    return MediaRequest.query.paginate(
        page=page, 
        per_page=per_page, 
        error_out=False
    )
```

### Frontend Performance
```typescript
// Lazy loading components
const AdminPanel = lazy(() => import('./components/AdminPanel'));

// Memoization for expensive calculations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Debounced search
const debouncedSearch = useCallback(
  debounce((query: string) => {
    setSearchQuery(query);
  }, 300),
  []
);
```

## Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Performance benchmarks met
- [ ] Documentation updated

### Production Environment
- [ ] SSL certificates installed
- [ ] Reverse proxy configured
- [ ] Log aggregation setup
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Security headers configured

### Post-deployment
- [ ] Health checks verified
- [ ] Performance monitoring active
- [ ] Error tracking functional
- [ ] User acceptance testing completed
- [ ] Rollback procedure tested