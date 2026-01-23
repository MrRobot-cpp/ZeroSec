# Users & Access Control - Frontend Implementation

## Overview
A complete frontend UI for Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) in ZeroSec. The page contains 3 tabs: Users, Roles, and Attributes (Departments & Clearance Levels).

## 🎨 What Was Built

### 1. Page Structure
- **Route**: `/users`
- **Location**: `frontend/src/app/users/page.js`
- **Main Component**: `UsersAccessControl.jsx`

### 2. Components Created

#### Main Component
- **UsersAccessControl.jsx** - Tab container with 3 sections:
  - 👥 Users Tab
  - 🔑 Roles Tab
  - 🏷️ Attributes Tab (Departments & Clearance Levels)

#### Tab Components
1. **UsersTab.jsx**
   - User table with columns: Username, Email, Role, Department, Clearance, Status, Last Login
   - Create/Edit user modal with form validation
   - Delete confirmation modal
   - Status badges (active, inactive, suspended)
   - Empty state with placeholder

2. **RolesTab.jsx**
   - Role cards in grid layout
   - Comprehensive permissions system:
     - Dashboard (view, edit)
     - Documents (view, edit, delete, upload)
     - RAG Assistant (view, query)
     - Data Security (view, edit)
     - Analytics (view, export)
     - Users (view, create, edit, delete)
     - Roles (view, create, edit, delete)
     - Settings (view, edit)
   - Create/Edit role modal with permission checkboxes
   - Delete confirmation modal
   - User count per role

3. **AttributesTab.jsx**
   - Two subsections with toggle: Departments | Clearance Levels
   - **Departments**: Card-based layout with color coding
   - **Clearance Levels**: Table layout sorted by security level (L1-L5)
   - Color picker for visual identification
   - Create/Edit modals for both types
   - Delete confirmation modals

### 3. Custom Hooks (with Placeholder Data)

#### useUsers.js
- Fetches and manages user data
- CRUD operations: create, update, delete users
- Placeholder users:
  - admin (Admin, Top Secret)
  - analyst1 (Security Analyst, Secret)
  - auditor1 (Auditor, Confidential)
  - engineer1 (User, Internal)
  - tempuser (User, Suspended)

#### useRoles.js
- Fetches and manages role data
- CRUD operations: create, update, delete roles
- Placeholder roles:
  - Admin (full access)
  - Security Analyst (security-focused permissions)
  - Auditor (read-only access)
  - User (basic permissions)

#### useAttributes.js
- Fetches and manages departments and clearance levels
- CRUD operations for both types
- Placeholder departments:
  - Security, Engineering, Operations, Compliance
- Placeholder clearance levels:
  - Public (L1), Internal (L2), Confidential (L3), Secret (L4), Top Secret (L5)

### 4. Service Layer (API Ready)

All service files are ready to connect to backend APIs:

#### userService.js
```
Endpoints to implement:
- GET    /api/users              - Get all users
- GET    /api/users/:id          - Get user by ID
- POST   /api/users              - Create new user
- PUT    /api/users/:id          - Update user
- DELETE /api/users/:id          - Delete user
- POST   /api/users/:id/suspend  - Suspend user
- POST   /api/users/:id/activate - Activate user
```

#### roleService.js
```
Endpoints to implement:
- GET    /api/roles        - Get all roles
- GET    /api/roles/:id    - Get role by ID
- POST   /api/roles        - Create new role
- PUT    /api/roles/:id    - Update role
- DELETE /api/roles/:id    - Delete role
```

#### attributeService.js
```
Endpoints to implement:
Departments:
- GET    /api/attributes/departments        - Get all departments
- GET    /api/attributes/departments/:id    - Get department by ID
- POST   /api/attributes/departments        - Create new department
- PUT    /api/attributes/departments/:id    - Update department
- DELETE /api/attributes/departments/:id    - Delete department

Clearance Levels:
- GET    /api/attributes/clearance-levels        - Get all clearance levels
- GET    /api/attributes/clearance-levels/:id    - Get clearance level by ID
- POST   /api/attributes/clearance-levels        - Create new clearance level
- PUT    /api/attributes/clearance-levels/:id    - Update clearance level
- DELETE /api/attributes/clearance-levels/:id    - Delete clearance level
```

### 5. Navigation Update
- Added "Users & Access" link to Sidebar with 👥 icon
- Located between Analytics and Settings

## 🎨 Design Features

### UI/UX Components
- **Dark theme** consistent with ZeroSec design (gray-900/800)
- **Color-coded badges** for status, roles, and clearance levels
- **Responsive modals** with form validation
- **Empty states** with helpful prompts
- **Hover effects** and smooth transitions
- **Icon-based navigation** for better UX
- **Grid and table layouts** optimized for different data types

### Color Scheme
- Blue (#3b82f6) - Primary actions, roles
- Purple (#8b5cf6) - Clearance levels, attributes
- Green (#10b981) - Active status, success
- Red (#ef4444) - Delete actions, suspended status
- Orange (#f59e0b) - Warnings, medium priority
- Gray scales - Background, borders, text

## 🔧 How to Connect to Backend

### Step 1: Uncomment Service Imports in Hooks
In each hook file (`useUsers.js`, `useRoles.js`, `useAttributes.js`), uncomment the import statement:

```javascript
// Change this:
// import { getUsers, createUser, ... } from "@/services/userService";

// To this:
import { getUsers, createUser, ... } from "@/services/userService";
```

### Step 2: Replace Placeholder Logic
In each hook, replace the placeholder API simulation:

```javascript
// Remove this:
await new Promise((resolve) => setTimeout(resolve, 500));
setUsers(PLACEHOLDER_USERS);

// Replace with:
const data = await getUsers();
setUsers(data);
```

### Step 3: Implement Backend Endpoints
Create Flask blueprints in the backend matching the service layer endpoints:

```python
# backend/api/users.py
from flask import Blueprint, request, jsonify

users_bp = Blueprint('users', __name__)

@users_bp.route('/api/users', methods=['GET'])
def get_users():
    # Implementation here
    pass

@users_bp.route('/api/users', methods=['POST'])
def create_user():
    # Implementation here
    pass

# ... etc
```

### Step 4: Add Authentication
When auth is implemented, uncomment authorization headers in service files:

```javascript
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${getAuthToken()}`,
},
```

## 📁 File Structure

```
frontend/
├── src/
│   ├── app/
│   │   └── users/
│   │       └── page.js                    # Route entry point
│   ├── components/
│   │   ├── UsersAccessControl.jsx         # Main component with tabs
│   │   ├── UsersTab.jsx                   # Users management
│   │   ├── RolesTab.jsx                   # Roles management
│   │   ├── AttributesTab.jsx              # Departments & Clearance
│   │   └── Sidebar.jsx                    # Updated with new link
│   ├── hooks/
│   │   ├── useUsers.js                    # User state management
│   │   ├── useRoles.js                    # Role state management
│   │   └── useAttributes.js               # Attribute state management
│   └── services/
│       ├── userService.js                 # User API calls
│       ├── roleService.js                 # Role API calls
│       └── attributeService.js            # Attribute API calls
```

## 🚀 Testing the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000/users
   ```

5. You should see:
   - Three tabs: Users, Roles, Attributes
   - Placeholder data in all sections
   - Fully functional UI (forms, modals, CRUD operations work with placeholder data)

## ✅ Features Implemented

### Users Tab
- ✅ User table with all relevant fields
- ✅ Create user form with validation
- ✅ Edit user form (pre-populated)
- ✅ Delete user confirmation
- ✅ Status badges (active, inactive, suspended)
- ✅ Role and clearance level dropdowns
- ✅ Empty state

### Roles Tab
- ✅ Role cards with grid layout
- ✅ Granular permissions system (8 categories, 20+ permissions)
- ✅ Create role with permission checkboxes
- ✅ Edit role (pre-populated permissions)
- ✅ Delete role confirmation
- ✅ User count per role
- ✅ Permission visualization
- ✅ Empty state

### Attributes Tab
- ✅ Department management (card layout)
- ✅ Clearance level management (table layout)
- ✅ Color picker for visual identification
- ✅ Security level selector (L1-L5)
- ✅ Create/Edit forms for both types
- ✅ Delete confirmation modals
- ✅ User count per attribute
- ✅ Toggle between departments/clearance
- ✅ Empty states

### General Features
- ✅ Responsive design
- ✅ Dark theme consistency
- ✅ Form validation
- ✅ Loading states
- ✅ Error handling
- ✅ Smooth animations
- ✅ Keyboard accessible
- ✅ Icon-based navigation

## 🔜 Next Steps (Backend Implementation)

1. **Database Schema**
   - Users table (id, username, email, password_hash, role_id, department_id, clearance_id, status, last_login)
   - Roles table (id, name, description, permissions_json)
   - Departments table (id, name, description, color)
   - Clearance_levels table (id, name, description, level, color)

2. **Authentication System**
   - JWT token generation
   - Password hashing (bcrypt)
   - Login/logout endpoints
   - Token validation middleware

3. **API Endpoints**
   - Implement all endpoints listed in service files
   - Add authorization checks
   - Add input validation
   - Add error handling

4. **Authorization Middleware**
   - Role-based permission checks
   - Attribute-based policy enforcement
   - Route protection decorators

5. **Audit Logging**
   - Log all auth events
   - Log permission changes
   - Log user management actions

## 📝 Notes

- All components follow ZeroSec's existing design patterns
- PropTypes validation ready to be added where needed
- All TODO comments clearly marked in code
- Service layer is production-ready (just needs backend)
- Placeholder data provides realistic testing environment
- No external dependencies added - uses existing project stack

## 🎯 Summary

The frontend is **100% complete** and ready to use. You can:
- ✅ Test the entire UI with placeholder data
- ✅ See how all features work together
- ✅ Get user feedback before building the backend
- ✅ Connect to backend APIs when ready (well-documented)

The implementation follows all ZeroSec conventions and integrates seamlessly with the existing codebase.
