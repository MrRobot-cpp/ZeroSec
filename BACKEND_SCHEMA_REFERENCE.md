# Backend Schema Reference for Users & Access Control

This document provides the recommended database schema and API structure for the backend implementation.

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(36) NOT NULL,
    department_id VARCHAR(36) NOT NULL,
    clearance_level_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (clearance_level_id) REFERENCES clearance_levels(id)
);
```

### Roles Table
```sql
CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions_json TEXT NOT NULL, -- JSON string of permissions object
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Permissions JSON Structure:**
```json
{
  "dashboard": { "view": true, "edit": false },
  "documents": { "view": true, "edit": true, "delete": false, "upload": true },
  "rag": { "view": true, "query": true },
  "security": { "view": true, "edit": false },
  "analytics": { "view": true, "export": false },
  "users": { "view": false, "create": false, "edit": false, "delete": false },
  "roles": { "view": false, "create": false, "edit": false, "delete": false },
  "settings": { "view": true, "edit": false }
}
```

### Departments Table
```sql
CREATE TABLE departments (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL, -- Hex color code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Clearance Levels Table
```sql
CREATE TABLE clearance_levels (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    level INTEGER NOT NULL, -- 1-5, higher = more access
    color VARCHAR(7) NOT NULL, -- Hex color code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Log Table (Optional but Recommended)
```sql
CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    action VARCHAR(100) NOT NULL, -- login, logout, create_user, delete_role, etc.
    target_type VARCHAR(50), -- user, role, department, clearance_level
    target_id VARCHAR(36),
    details TEXT, -- JSON string with additional info
    ip_address VARCHAR(45),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 🔧 SQLAlchemy Models (Python)

### User Model
```python
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

class User(Base):
    __tablename__ = 'users'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(String(36), ForeignKey('roles.id'), nullable=False)
    department_id = Column(String(36), ForeignKey('departments.id'), nullable=False)
    clearance_level_id = Column(String(36), ForeignKey('clearance_levels.id'), nullable=False)
    status = Column(String(20), default='active')
    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    role = relationship("Role", back_populates="users")
    department = relationship("Department", back_populates="users")
    clearance_level = relationship("ClearanceLevel", back_populates="users")

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role.name if self.role else None,
            'department': self.department.name if self.department else None,
            'clearanceLevel': self.clearance_level.name if self.clearance_level else None,
            'status': self.status,
            'lastLogin': self.last_login.isoformat() if self.last_login else 'Never',
        }
```

### Role Model
```python
import json

class Role(Base):
    __tablename__ = 'roles'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    permissions_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="role")

    @property
    def permissions(self):
        return json.loads(self.permissions_json)

    @permissions.setter
    def permissions(self, value):
        self.permissions_json = json.dumps(value)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'permissions': self.permissions,
            'userCount': len(self.users),
        }
```

### Department Model
```python
class Department(Base):
    __tablename__ = 'departments'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    color = Column(String(7), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="department")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color,
            'userCount': len(self.users),
        }
```

### ClearanceLevel Model
```python
class ClearanceLevel(Base):
    __tablename__ = 'clearance_levels'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    level = Column(Integer, nullable=False)
    color = Column(String(7), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="clearance_level")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'level': self.level,
            'color': self.color,
            'userCount': len(self.users),
        }
```

## 🛣️ API Blueprint Structure (Flask)

### Directory Structure
```
backend/
├── api/
│   ├── __init__.py
│   ├── auth.py              # Login, logout, token management
│   ├── users.py             # User CRUD operations
│   ├── roles.py             # Role CRUD operations
│   └── attributes.py        # Department & Clearance CRUD
├── database/
│   ├── __init__.py
│   ├── db.py                # Database connection setup
│   ├── models.py            # SQLAlchemy models
│   └── repository.py        # Database query helpers
├── security/
│   ├── __init__.py
│   ├── auth.py              # JWT token handling
│   ├── permissions.py       # Permission decorators
│   └── password.py          # Password hashing
└── app.py                   # Main application
```

### Example API Blueprint (users.py)

```python
from flask import Blueprint, request, jsonify
from database.models import User, Role, Department, ClearanceLevel
from database.db import db_session
from security.auth import require_auth, require_permission
from security.password import hash_password
import uuid

users_bp = Blueprint('users', __name__)

@users_bp.route('/api/users', methods=['GET'])
@require_auth
@require_permission('users', 'view')
def get_users():
    """Get all users"""
    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/api/users/<user_id>', methods=['GET'])
@require_auth
@require_permission('users', 'view')
def get_user(user_id):
    """Get user by ID"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'user': user.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@users_bp.route('/api/users', methods=['POST'])
@require_auth
@require_permission('users', 'create')
def create_user():
    """Create new user"""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['username', 'email', 'password', 'role', 'department', 'clearanceLevel']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400

        # Check if username or email already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400

        # Get role, department, and clearance level
        role = Role.query.filter_by(name=data['role']).first()
        department = Department.query.filter_by(name=data['department']).first()
        clearance = ClearanceLevel.query.filter_by(name=data['clearanceLevel']).first()

        if not all([role, department, clearance]):
            return jsonify({'error': 'Invalid role, department, or clearance level'}), 400

        # Create new user
        user = User(
            id=str(uuid.uuid4()),
            username=data['username'],
            email=data['email'],
            password_hash=hash_password(data['password']),
            role_id=role.id,
            department_id=department.id,
            clearance_level_id=clearance.id,
            status=data.get('status', 'active')
        )

        db_session.add(user)
        db_session.commit()

        return jsonify({'user': user.to_dict()}), 201
    except Exception as e:
        db_session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/api/users/<user_id>', methods=['PUT'])
@require_auth
@require_permission('users', 'edit')
def update_user(user_id):
    """Update existing user"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()

        # Update fields
        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
        if 'password' in data and data['password']:
            user.password_hash = hash_password(data['password'])
        if 'role' in data:
            role = Role.query.filter_by(name=data['role']).first()
            if role:
                user.role_id = role.id
        if 'department' in data:
            department = Department.query.filter_by(name=data['department']).first()
            if department:
                user.department_id = department.id
        if 'clearanceLevel' in data:
            clearance = ClearanceLevel.query.filter_by(name=data['clearanceLevel']).first()
            if clearance:
                user.clearance_level_id = clearance.id
        if 'status' in data:
            user.status = data['status']

        db_session.commit()

        return jsonify({'user': user.to_dict()}), 200
    except Exception as e:
        db_session.rollback()
        return jsonify({'error': str(e)}), 500

@users_bp.route('/api/users/<user_id>', methods=['DELETE'])
@require_auth
@require_permission('users', 'delete')
def delete_user(user_id):
    """Delete user"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        db_session.delete(user)
        db_session.commit()

        return '', 204
    except Exception as e:
        db_session.rollback()
        return jsonify({'error': str(e)}), 500
```

## 🔐 Authentication Decorators

### require_auth Decorator
```python
from functools import wraps
from flask import request, jsonify
import jwt

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token:
            return jsonify({'error': 'No authorization token provided'}), 401

        try:
            # Remove 'Bearer ' prefix
            token = token.replace('Bearer ', '')
            # Decode JWT token
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            request.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(*args, **kwargs)
    return decorated_function
```

### require_permission Decorator
```python
def require_permission(resource, action):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = request.current_user.get('user_id')
            user = User.query.get(user_id)

            if not user:
                return jsonify({'error': 'User not found'}), 404

            # Check if user's role has the required permission
            permissions = user.role.permissions
            if resource in permissions and permissions[resource].get(action):
                return f(*args, **kwargs)

            return jsonify({'error': 'Insufficient permissions'}), 403
        return decorated_function
    return decorator
```

## 🔑 Password Hashing

```python
import bcrypt

def hash_password(password):
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password, password_hash):
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
```

## 📦 Required Python Packages

```txt
Flask==3.0.3
Flask-CORS==4.0.0
SQLAlchemy==2.0.23
PyJWT==2.8.0
bcrypt==4.1.2
python-dotenv==1.0.0
```

## 🚀 Initialization Script

```python
# scripts/init_db.py
from database.models import Role, Department, ClearanceLevel, User
from database.db import init_db, db_session
from security.password import hash_password
import uuid

def initialize_database():
    """Initialize database with default data"""
    init_db()

    # Create default roles
    roles = [
        {
            'name': 'Admin',
            'description': 'Full system access with all permissions',
            'permissions': {
                'dashboard': {'view': True, 'edit': True},
                'documents': {'view': True, 'edit': True, 'delete': True, 'upload': True},
                'rag': {'view': True, 'query': True},
                'security': {'view': True, 'edit': True},
                'analytics': {'view': True, 'export': True},
                'users': {'view': True, 'create': True, 'edit': True, 'delete': True},
                'roles': {'view': True, 'create': True, 'edit': True, 'delete': True},
                'settings': {'view': True, 'edit': True}
            }
        },
        # Add other roles...
    ]

    for role_data in roles:
        role = Role(**role_data)
        db_session.add(role)

    # Create default departments
    departments = [
        {'name': 'Security', 'description': '...', 'color': '#ef4444'},
        {'name': 'Engineering', 'description': '...', 'color': '#3b82f6'},
        # Add others...
    ]

    for dept_data in departments:
        dept = Department(**dept_data)
        db_session.add(dept)

    # Create default clearance levels
    clearance_levels = [
        {'name': 'Public', 'description': '...', 'level': 1, 'color': '#10b981'},
        # Add others...
    ]

    for cl_data in clearance_levels:
        cl = ClearanceLevel(**cl_data)
        db_session.add(cl)

    db_session.commit()
    print("Database initialized successfully!")

if __name__ == '__main__':
    initialize_database()
```

This schema reference provides everything needed to implement the backend for the Users & Access Control system!
