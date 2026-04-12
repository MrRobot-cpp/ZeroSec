"""
Attributes API — Departments and Clearance Levels (ABAC)
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from backend.database.db import db
from backend.database.models import Department, ClearanceLevel, User, Document
from backend.utils.rbac import require_permission, get_current_organization_id
from backend.utils.audit import log_audit
from flask_jwt_extended import get_jwt_identity

attributes_bp = Blueprint('attributes', __name__, url_prefix='/api/attributes')

_DEPT_NOT_FOUND = 'Department not found'
_CLEARANCE_NOT_FOUND = 'Clearance level not found'


def _dept_to_dict(dept):
    user_count = User.query.filter_by(department_id=dept.department_id).count()
    return {
        'department_id': dept.department_id,
        'name': dept.name,
        'description': dept.description or '',
        'color': dept.color or '#3b82f6',
        'user_count': user_count,
        'created_at': dept.created_at.isoformat() if dept.created_at else None,
    }


def _clearance_to_dict(cl):
    user_count = User.query.filter_by(clearance_level_id=cl.clearance_level_id).count()
    return {
        'clearance_level_id': cl.clearance_level_id,
        'name': cl.name,
        'description': cl.description or '',
        'level': cl.level,
        'color': cl.color or '#3b82f6',
        'user_count': user_count,
    }


# ─── Departments ──────────────────────────────────────────────────────────────

@attributes_bp.route('/departments', methods=['GET'])
@jwt_required()
def get_departments():
    organization_id = get_current_organization_id()
    try:
        depts = Department.query.filter_by(organization_id=organization_id).all()
        return jsonify({'departments': [_dept_to_dict(d) for d in depts]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/departments/<int:dept_id>', methods=['GET'])
@jwt_required()
def get_department(dept_id):
    organization_id = get_current_organization_id()
    try:
        dept = Department.query.get(dept_id)
        if not dept or dept.organization_id != organization_id:
            return jsonify({'error': _DEPT_NOT_FOUND}), 404
        return jsonify({'department': _dept_to_dict(dept)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/departments', methods=['POST'])
@jwt_required()
@require_permission('policy_manage')
def create_department():
    organization_id = get_current_organization_id()
    user_id = get_jwt_identity()
    try:
        data = request.get_json()
        name = (data or {}).get('name', '').strip()
        if not name:
            return jsonify({'error': 'Department name is required'}), 400

        existing = Department.query.filter_by(organization_id=organization_id, name=name).first()
        if existing:
            return jsonify({'error': f'Department "{name}" already exists'}), 409

        dept = Department(
            organization_id=organization_id,
            name=name,
            description=data.get('description', ''),
            color=data.get('color', '#3b82f6'),
        )
        db.session.add(dept)
        db.session.commit()

        log_audit(organization_id=organization_id, user_id=user_id,
                  action='department_created', target_type='Department',
                  target_id=dept.department_id, metadata={'name': name})

        return jsonify({'department': _dept_to_dict(dept)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/departments/<int:dept_id>', methods=['PUT'])
@jwt_required()
@require_permission('policy_manage')
def update_department(dept_id):
    organization_id = get_current_organization_id()
    user_id = get_jwt_identity()
    try:
        dept = Department.query.get(dept_id)
        if not dept or dept.organization_id != organization_id:
            return jsonify({'error': _DEPT_NOT_FOUND}), 404

        data = request.get_json() or {}
        if 'name' in data:
            dept.name = data['name'].strip()
        if 'description' in data:
            dept.description = data['description']
        if 'color' in data:
            dept.color = data['color']

        db.session.commit()

        log_audit(organization_id=organization_id, user_id=user_id,
                  action='department_updated', target_type='Department', target_id=dept_id)

        return jsonify({'department': _dept_to_dict(dept)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/departments/<int:dept_id>', methods=['DELETE'])
@jwt_required()
@require_permission('policy_manage')
def delete_department(dept_id):
    organization_id = get_current_organization_id()
    user_id = get_jwt_identity()
    try:
        dept = Department.query.get(dept_id)
        if not dept or dept.organization_id != organization_id:
            return jsonify({'error': _DEPT_NOT_FOUND}), 404

        user_count = User.query.filter_by(department_id=dept_id).count()
        if user_count > 0:
            return jsonify({'error': f'Cannot delete department with {user_count} assigned user(s)'}), 409

        log_audit(organization_id=organization_id, user_id=user_id,
                  action='department_deleted', target_type='Department',
                  target_id=dept_id, metadata={'name': dept.name})

        db.session.delete(dept)
        db.session.commit()
        return jsonify({'message': 'Department deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ─── Clearance Levels ─────────────────────────────────────────────────────────

@attributes_bp.route('/clearance-levels', methods=['GET'])
@jwt_required()
def get_clearance_levels():
    organization_id = get_current_organization_id()
    try:
        levels = ClearanceLevel.query.filter_by(organization_id=organization_id)\
            .order_by(ClearanceLevel.level.asc()).all()
        return jsonify({'clearanceLevels': [_clearance_to_dict(cl) for cl in levels]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/clearance-levels/<int:cl_id>', methods=['GET'])
@jwt_required()
def get_clearance_level(cl_id):
    organization_id = get_current_organization_id()
    try:
        cl = ClearanceLevel.query.get(cl_id)
        if not cl or cl.organization_id != organization_id:
            return jsonify({'error': _CLEARANCE_NOT_FOUND}), 404
        return jsonify({'clearanceLevel': _clearance_to_dict(cl)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/clearance-levels', methods=['POST'])
@jwt_required()
@require_permission('policy_manage')
def create_clearance_level():
    organization_id = get_current_organization_id()
    user_id = get_jwt_identity()
    try:
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        level = data.get('level')

        if not name:
            return jsonify({'error': 'Clearance level name is required'}), 400
        if level is None or not isinstance(level, int):
            return jsonify({'error': 'level must be an integer'}), 400

        existing = ClearanceLevel.query.filter_by(organization_id=organization_id, name=name).first()
        if existing:
            return jsonify({'error': f'Clearance level "{name}" already exists'}), 409

        cl = ClearanceLevel(
            organization_id=organization_id,
            name=name,
            level=level,
            description=data.get('description', ''),
            color=data.get('color'),
        )
        db.session.add(cl)
        db.session.commit()

        log_audit(organization_id=organization_id, user_id=user_id,
                  action='clearance_level_created', target_type='ClearanceLevel',
                  target_id=cl.clearance_level_id, metadata={'name': name, 'level': level})

        return jsonify({'clearanceLevel': _clearance_to_dict(cl)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/clearance-levels/<int:cl_id>', methods=['PUT'])
@jwt_required()
@require_permission('policy_manage')
def update_clearance_level(cl_id):
    organization_id = get_current_organization_id()
    user_id = get_jwt_identity()
    try:
        cl = ClearanceLevel.query.get(cl_id)
        if not cl or cl.organization_id != organization_id:
            return jsonify({'error': _CLEARANCE_NOT_FOUND}), 404

        data = request.get_json() or {}
        if 'name' in data:
            cl.name = data['name'].strip()
        if 'level' in data:
            if not isinstance(data['level'], int):
                return jsonify({'error': 'level must be an integer'}), 400
            cl.level = data['level']
        if 'description' in data:
            cl.description = data['description']
        if 'color' in data:
            cl.color = data['color']

        db.session.commit()

        log_audit(organization_id=organization_id, user_id=user_id,
                  action='clearance_level_updated', target_type='ClearanceLevel', target_id=cl_id)

        return jsonify({'clearanceLevel': _clearance_to_dict(cl)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@attributes_bp.route('/clearance-levels/<int:cl_id>', methods=['DELETE'])
@jwt_required()
@require_permission('policy_manage')
def delete_clearance_level(cl_id):
    organization_id = get_current_organization_id()
    user_id = get_jwt_identity()
    try:
        cl = ClearanceLevel.query.get(cl_id)
        if not cl or cl.organization_id != organization_id:
            return jsonify({'error': _CLEARANCE_NOT_FOUND}), 404

        user_count = User.query.filter_by(clearance_level_id=cl_id).count()
        doc_count = Document.query.filter_by(clearance_level_id=cl_id).count()
        if user_count > 0 or doc_count > 0:
            return jsonify({
                'error': f'Cannot delete clearance level assigned to {user_count} user(s) and {doc_count} document(s)'
            }), 409

        log_audit(organization_id=organization_id, user_id=user_id,
                  action='clearance_level_deleted', target_type='ClearanceLevel',
                  target_id=cl_id, metadata={'name': cl.name})

        db.session.delete(cl)
        db.session.commit()
        return jsonify({'message': 'Clearance level deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
