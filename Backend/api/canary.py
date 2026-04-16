from flask import Blueprint, request, send_file, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from backend.services.canary_service import watermark_txt, watermark_pdf, watermark_docx, OUTPUT_DIR
from backend.database.repository import CanaryTokenRepository
from backend.utils.audit import log_audit
import os
import logging

logger = logging.getLogger(__name__)

canary_bp = Blueprint("canary_bp", __name__)

# 1x1 transparent GIF — returned by the ping endpoint so browsers/viewers
# treat the request as a valid image load and don't show errors.
_PIXEL_GIF = (
    b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00'
    b'\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00'
    b'\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02'
    b'\x44\x01\x00\x3b'
)


def _geolocate(ip: str) -> dict:
    """
    Look up country and city for an IP via ip-api.com (free, no key needed).
    Returns {'country': ..., 'city': ...} or empty strings on failure.
    """
    try:
        import urllib.request, json as _json
        if ip in ('127.0.0.1', '::1', 'localhost'):
            return {'country': 'Local', 'city': 'Localhost'}
        with urllib.request.urlopen(
            f'http://ip-api.com/json/{ip}?fields=country,city,status',
            timeout=3
        ) as resp:
            data = _json.loads(resp.read())
            if data.get('status') == 'success':
                return {'country': data.get('country', ''), 'city': data.get('city', '')}
    except Exception:
        pass
    return {'country': '', 'city': ''}


def _fire_canary(token_hash: str, source_ip: str, user_agent: str,
                 referer: str, trigger_source: str) -> None:
    """
    Shared logic: mark token triggered, write forensics, fire audit log.
    Called from both the HTTP ping endpoint and the webhook receiver.
    """
    from backend.database.models import CanaryToken
    from backend.database.db import db
    from datetime import datetime, timezone

    token = CanaryToken.query.filter_by(token_hash=token_hash).first()
    if not token:
        logger.warning("Canary ping for unknown token_hash=%s from %s", token_hash, source_ip)
        return

    # Only geo-lookup on first trigger (don't hammer ip-api on repeated pings)
    geo = _geolocate(source_ip) if not token.is_triggered else {}

    token.is_triggered   = True
    token.triggered_at   = datetime.now(timezone.utc)
    token.source_ip      = source_ip
    token.user_agent     = user_agent[:500] if user_agent else None
    token.referer        = referer[:500] if referer else None
    token.geo_country    = geo.get('country') or token.geo_country
    token.geo_city       = geo.get('city') or token.geo_city
    token.trigger_source = trigger_source
    db.session.commit()

    log_audit(
        organization_id=token.organization_id,
        user_id=None,
        action='canary_token_triggered',
        target_type='CanaryToken',
        target_id=token.canary_token_id,
        metadata={
            'token_hash':     token_hash,
            'source_ip':      source_ip,
            'user_agent':     user_agent,
            'geo_country':    token.geo_country,
            'geo_city':       token.geo_city,
            'trigger_source': trigger_source,
            'document_id':    token.document_id,
            'document_name':  token.document_name,
            'referer':        referer,
        }
    )

    logger.warning(
        "CANARY FIRED | token=%s | ip=%s | %s, %s | ua=%s | source=%s",
        token_hash[:12], source_ip,
        token.geo_city, token.geo_country,
        (user_agent or '')[:80], trigger_source,
    )

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@canary_bp.route("/canary/watermark", methods=["POST"])
def watermark():
    if "file" not in request.files:
        return jsonify({"error": "Missing file"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Missing file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file type"}), 400
    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[1].lower()
    temp_path = os.path.join(OUTPUT_DIR, "temp_" + filename)
    file.save(temp_path)
    try:
        if ext == "txt":
            meta = watermark_txt(temp_path)
        elif ext == "pdf":
            meta = watermark_pdf(temp_path)
        elif ext == "docx":
            meta = watermark_docx(temp_path)
        else:
            return jsonify({"error": "Unsupported file type"}), 400
        output_path = meta["output_path"]
        canary_id   = meta["canary_id"]
        token_hash  = meta.get("token_hash", "")
        hash_val    = meta.get("hash", "")

        # Persist the token_hash so the ping endpoint can look it up
        if token_hash:
            try:
                from backend.database.models import CanaryToken
                from backend.database.db import db
                # Find the most recently created canary record for this file
                # (created by canary_service via generate_metadata)
                existing = CanaryToken.query.filter_by(token_hash=token_hash).first()
                if not existing:
                    # Create a new record linked to document_id=0 (no doc yet)
                    record = CanaryToken(
                        document_id=0,
                        organization_id=1,
                        token_hash=token_hash,
                        document_name=filename,
                        trigger_source=None,
                    )
                    db.session.add(record)
                    db.session.commit()
            except Exception as db_err:
                logger.warning("Could not persist canary token to DB: %s", db_err)

        # Prefer the HTML canary wrapper — fires in any browser on open.
        # Fall back to the binary file if HTML generation failed.
        html_path   = meta.get("html_path", "")
        serve_path  = html_path if html_path and os.path.exists(html_path) else output_path
        base_name   = filename.rsplit(".", 1)[0]
        download_nm = (base_name + "_canary.html") if (serve_path == html_path) else (base_name + "_canary." + ext)

        response = send_file(
            serve_path,
            as_attachment=True,
            download_name=download_nm
        )
        response.headers["X-Canary-ID"]   = str(canary_id)
        response.headers["X-Output-Path"] = str(serve_path)
        response.headers["X-Canary-Hash"] = str(hash_val)

        import json
        meta_json = json.dumps({
            "canary_id":   str(canary_id),
            "token_hash":  str(token_hash),
            "hash":        str(hash_val),
            "output_path": str(serve_path),
            "html_path":   str(html_path),
            "filename":    download_nm,
            "ping_url":    meta.get("ping_url", ""),
        })
        response.headers["X-Canary-Meta"] = meta_json
        return response
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@canary_bp.route("/api/canary/tokens", methods=["GET"])
@jwt_required()
def get_canary_tokens():
    """Get all canary tokens for the user's organization"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        from backend.database.models import CanaryToken
        tokens = CanaryToken.query.filter_by(
            organization_id=organization_id
        ).order_by(CanaryToken.canary_token_id.desc()).all()

        tokens_data = [{
            'canary_token_id': token.canary_token_id,
            'document_id': token.document_id,
            'organization_id': token.organization_id,
            'token_hash': token.token_hash,
            'is_triggered': token.is_triggered,
            'triggered_at': token.triggered_at.isoformat() if token.triggered_at else None
        } for token in tokens]

        return jsonify({'tokens': tokens_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@canary_bp.route("/api/canary/tokens/triggered", methods=["GET"])
@jwt_required()
def get_triggered_tokens():
    """Get all triggered canary tokens"""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        triggered_tokens = CanaryTokenRepository.get_triggered_tokens(organization_id)

        tokens_data = [{
            'canary_token_id': token.canary_token_id,
            'document_id': token.document_id,
            'token_hash': token.token_hash,
            'triggered_at': token.triggered_at.isoformat() if token.triggered_at else None
        } for token in triggered_tokens]

        return jsonify({'triggered_tokens': tokens_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@canary_bp.route("/api/canary/trigger/<token_hash>", methods=["POST"])
@jwt_required()
def trigger_token(token_hash):
    """Manually trigger a canary token (for testing or incident reporting)"""
    from flask_jwt_extended import get_jwt
    user_id = get_jwt_identity()
    claims = get_jwt()
    organization_id = claims.get('organization_id')

    try:
        canary = CanaryTokenRepository.trigger_canary_token(token_hash)

        if not canary:
            return jsonify({"error": "Canary token not found"}), 404

        # Log audit event
        log_audit(
            organization_id=organization_id,
            user_id=user_id,
            action='canary_token_triggered',
            target_type='CanaryToken',
            target_id=canary.canary_token_id,
            meta_data={
                'token_hash': token_hash,
                'triggered_manually': True
            }
        )

        return jsonify({
            'message': 'Canary token triggered successfully',
            'canary_token_id': canary.canary_token_id,
            'triggered_at': canary.triggered_at.isoformat() if canary.triggered_at else None
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Self-hosted canary ping endpoint  (NO auth — must be publicly reachable)
# URL format embedded in documents:
#   http://<your-server>/api/canary/ping/<token_hash>
#
# Browsers, PDF viewers, and Office auto-fetch this URL when rendering the doc.
# We capture IP + User-Agent directly — no third-party dependency.
# ---------------------------------------------------------------------------

@canary_bp.route("/api/canary/ping/<token_hash>", methods=["GET", "HEAD"])
def canary_ping(token_hash):
    """
    Tracking pixel endpoint. Embedded as an image src in watermarked documents.
    Returns a 1x1 transparent GIF so the request looks like a normal image load.
    No authentication — must be reachable from the outside world.
    """
    source_ip  = (
        request.headers.get('X-Forwarded-For', '').split(',')[0].strip()
        or request.remote_addr
        or 'unknown'
    )
    user_agent = request.headers.get('User-Agent', '')
    referer    = request.headers.get('Referer', '')

    try:
        _fire_canary(
            token_hash    = token_hash,
            source_ip     = source_ip,
            user_agent    = user_agent,
            referer       = referer,
            trigger_source= 'http_ping',
        )
    except Exception as exc:
        logger.error("canary_ping error: %s", exc)

    return Response(_PIXEL_GIF, mimetype='image/gif',
                    headers={'Cache-Control': 'no-store, no-cache'})


# ---------------------------------------------------------------------------
# Webhook receiver  (for canarytokens.org or any external canary service)
# Configure canarytokens.org to POST to:
#   http://<ngrok-or-public-ip>/api/canary/webhook
# ---------------------------------------------------------------------------

@canary_bp.route("/api/canary/webhook", methods=["POST"])
def canary_webhook():
    """
    Receive alert payloads from canarytokens.org or similar external services.
    Expected JSON payload (canarytokens.org format):
      {
        "manage_url": "...",
        "memo": "<token_hash>",          ← put your token_hash in the memo field
        "src_ip": "1.2.3.4",
        "useragent": "Mozilla/5.0 ...",
        "geo": {"country": "...", "city": "..."},
        "time": "2026-04-14T..."
      }
    """
    try:
        data = request.get_json(force=True, silent=True) or {}

        # canarytokens.org puts the memo in 'memo'; token hash should be in it
        token_hash = (
            data.get('memo') or
            data.get('token') or
            data.get('token_hash') or
            ''
        ).strip()

        source_ip  = data.get('src_ip') or data.get('ip') or 'unknown'
        user_agent = data.get('useragent') or data.get('user_agent') or ''
        geo        = data.get('geo') or {}
        country    = geo.get('country', '')
        city       = geo.get('city', '')

        if not token_hash:
            return jsonify({'error': 'No token_hash in payload'}), 400

        _fire_canary(
            token_hash    = token_hash,
            source_ip     = source_ip,
            user_agent    = user_agent,
            referer       = '',
            trigger_source= 'webhook',
        )

        # Override geo with what canarytokens.org already resolved
        if country or city:
            from backend.database.models import CanaryToken
            from backend.database.db import db
            t = CanaryToken.query.filter_by(token_hash=token_hash).first()
            if t:
                t.geo_country = country or t.geo_country
                t.geo_city    = city    or t.geo_city
                db.session.commit()

        return jsonify({'status': 'received'}), 200

    except Exception as exc:
        logger.error("canary_webhook error: %s", exc)
        return jsonify({'error': str(exc)}), 500


@canary_bp.route("/api/canary/tokens/<int:token_id>/forensics", methods=["GET"])
@jwt_required()
def get_token_forensics(token_id):
    """Return full forensic detail for a single triggered canary token."""
    from flask_jwt_extended import get_jwt
    claims = get_jwt()
    org_id = claims.get('organization_id')

    from backend.database.models import CanaryToken, Document
    token = CanaryToken.query.filter_by(
        canary_token_id=token_id,
        organization_id=org_id,
    ).first()

    if not token:
        return jsonify({'error': 'Not found'}), 404

    doc_name = token.document_name
    if not doc_name and token.document_id:
        doc = Document.query.get(token.document_id)
        doc_name = doc.title if doc else None

    return jsonify({
        'canary_token_id': token.canary_token_id,
        'document_id':     token.document_id,
        'document_name':   doc_name,
        'token_hash':      token.token_hash,
        'is_triggered':    token.is_triggered,
        'triggered_at':    token.triggered_at.isoformat() if token.triggered_at else None,
        'source_ip':       token.source_ip,
        'user_agent':      token.user_agent,
        'referer':         token.referer,
        'geo_country':     token.geo_country,
        'geo_city':        token.geo_city,
        'trigger_source':  token.trigger_source,
    }), 200


# ---------------------------------------------------------------------------
# Canary base URL configuration — lets the UI set the public ngrok URL
# so watermarked documents embed the correct external address.
# ---------------------------------------------------------------------------

@canary_bp.route("/api/canary/config", methods=["GET"])
@jwt_required()
def get_canary_config():
    """Return the current CANARY_BASE_URL used when embedding ping URLs."""
    import backend.services.canary_service as _svc
    return jsonify({"canary_base_url": _svc.CANARY_BASE_URL}), 200


@canary_bp.route("/api/canary/config", methods=["POST"])
@jwt_required()
def set_canary_config():
    """
    Update the CANARY_BASE_URL at runtime.
    Takes effect immediately for all subsequent watermark operations — no restart needed.
    Body: { "canary_base_url": "https://abc123.ngrok.io" }
    """
    data = request.get_json(force=True, silent=True) or {}
    new_url = (data.get("canary_base_url") or "").strip().rstrip("/")

    if not new_url:
        return jsonify({"error": "canary_base_url is required"}), 400
    if not new_url.startswith(("http://", "https://")):
        return jsonify({"error": "canary_base_url must start with http:// or https://"}), 400

    import backend.services.canary_service as _svc
    _svc.CANARY_BASE_URL = new_url
    logger.info("CANARY_BASE_URL updated to %s", new_url)

    return jsonify({"canary_base_url": new_url, "message": "Updated — new watermarks will use this URL"}), 200
