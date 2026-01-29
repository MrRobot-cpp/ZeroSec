from datetime import timezone
from backend.app import app
from backend.database.db import db
from backend.database.models import User, Role, UserRole, Department

with app.app_context():
    admin = User.query.filter_by(username='admin').first()
    if admin:
        print(f"User: {admin.username}")
        print(f"Department: {admin.department.name if admin.department else 'None'}")
        
        user_role = UserRole.query.filter_by(user_id=admin.user_id).first()
        if user_role:
            print(f"Role Table: {user_role.role.name}")
        else:
            print("Role Table: None")
            
        # Check through relationship
        print(f"User.user_roles: {[ur.role.name for ur in admin.user_roles]}")
    else:
        print("Admin user not found")
