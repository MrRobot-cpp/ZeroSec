"""
Database configuration and initialization
"""
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager

# Initialize extensions
db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()

def init_db(app):
    """
    Initialize database with Flask app

    Args:
        app: Flask application instance
    """
    db.init_app(app)
    bcrypt.init_app(app)
    jwt.init_app(app)

    with app.app_context():
        # Import models to ensure they are registered
        from backend.database.models import (
            Organization, Department, User, Role, RolePermission,
            ClearanceLevel, Policy, Document, Upload, CanaryToken,
            Subscription, Plan, UsageMetric, AuditLog, UserRole
        )

        # Create all tables
        db.create_all()

        # Initialize default data
        _initialize_default_data()

def _initialize_default_data():
    """Initialize default data (roles, permissions, clearance levels, etc.)"""
    from backend.database.models import (
        Role, RolePermission, ClearanceLevel, Plan,
        Organization, Department, User
    )

    # Check if data already exists
    if Role.query.first() is not None:
        return

    # Create default organization
    default_org = Organization(
        name="Default Organization",
        created_at=db.func.now()
    )
    db.session.add(default_org)
    db.session.flush()  # Get the organization ID

    # Create default department
    default_dept = Department(
        organization_id=default_org.organization_id,
        name="General",
        created_at=db.func.now()
    )
    db.session.add(default_dept)
    db.session.flush()

    # Create clearance levels
    clearance_levels = [
        ClearanceLevel(
            organization_id=default_org.organization_id,
            name="Public",
            level=0
        ),
        ClearanceLevel(
            organization_id=default_org.organization_id,
            name="Internal",
            level=1
        ),
        ClearanceLevel(
            organization_id=default_org.organization_id,
            name="Confidential",
            level=2
        ),
        ClearanceLevel(
            organization_id=default_org.organization_id,
            name="Secret",
            level=3
        ),
        ClearanceLevel(
            organization_id=default_org.organization_id,
            name="Top Secret",
            level=4
        )
    ]
    for cl in clearance_levels:
        db.session.add(cl)
    db.session.flush()

    # Create default roles
    roles_data = [
        {
            "name": "Super Admin",
            "description": "Full system access",
            "permissions": ["create", "read", "update", "delete", "admin"]
        },
        {
            "name": "Admin",
            "description": "Administrative access",
            "permissions": ["create", "read", "update", "delete"]
        },
        {
            "name": "Manager",
            "description": "Manager access",
            "permissions": ["create", "read", "update"]
        },
        {
            "name": "User",
            "description": "Standard user access",
            "permissions": ["read", "create"]
        },
        {
            "name": "Viewer",
            "description": "Read-only access",
            "permissions": ["read"]
        }
    ]

    roles = {}
    for role_data in roles_data:
        role = Role(
            organization_id=default_org.organization_id,
            name=role_data["name"],
            description=role_data["description"],
            created_at=db.func.now()
        )
        db.session.add(role)
        db.session.flush()

        # Add permissions
        for permission in role_data["permissions"]:
            role_perm = RolePermission(
                role_id=role.role_id,
                permission=permission
            )
            db.session.add(role_perm)

        roles[role_data["name"]] = role

    # Create default plans
    plans = [
        Plan(
            name="Free",
            features_page="Basic features",
            limits={"documents": 10, "users": 3, "storage_mb": 100},
            created_at=db.func.now()
        ),
        Plan(
            name="Pro",
            features_page="Advanced features",
            limits={"documents": 100, "users": 20, "storage_mb": 1000},
            created_at=db.func.now()
        ),
        Plan(
            name="Enterprise",
            features_page="All features",
            limits={"documents": -1, "users": -1, "storage_mb": -1},
            created_at=db.func.now()
        )
    ]
    for plan in plans:
        db.session.add(plan)

    # Create default admin user
    admin_user = User(
        organization_id=default_org.organization_id,
        department_id=default_dept.department_id,
        clearance_level_id=clearance_levels[4].clearance_level_id,  # Top Secret
        username="admin",
        email="admin@zerosec.local",
        password_hash=bcrypt.generate_password_hash("admin123").decode('utf-8'),
        status="Active",
        created_at=db.func.now()
    )
    db.session.add(admin_user)
    db.session.flush()

    # Assign Super Admin role to admin user
    from backend.database.models import UserRole
    admin_user_role = UserRole(
        user_id=admin_user.user_id,
        role_id=roles["Super Admin"].role_id
    )
    db.session.add(admin_user_role)

    # Commit all changes
    db.session.commit()

    print("✓ Database initialized with default data")
    print("✓ Default admin user created: username='admin', password='admin123'")
    print("  ⚠ IMPORTANT: Change the default password immediately!")

def reset_db(app):
    """
    Drop all tables and recreate them (USE WITH CAUTION!)

    Args:
        app: Flask application instance
    """
    with app.app_context():
        db.drop_all()
        db.create_all()
        _initialize_default_data()
        print("✓ Database reset successfully")
