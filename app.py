#!/usr/bin/env python3
"""
Network & Container Inventory Web Application
Flask web server with auto-refresh and enhanced features
"""
import logging
import os
import sys
import threading
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler

import yaml
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_swagger_ui import get_swaggerui_blueprint

from config_validator import check_fatal_errors, validate_environment
from database import Database
from inventory_scanner import NetworkInventory
from socketio_handler import (
    emit_scan_completed,
    emit_scan_failed,
    emit_scan_started,
    init_socketio,
)


# Load environment variables
load_dotenv()

# Configure logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# Add file handler for persistent logs
if not os.path.exists("logs"):
    os.makedirs("logs")

file_handler = RotatingFileHandler("logs/app.log", maxBytes=10485760, backupCount=5)  # 10MB
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
logging.getLogger().addHandler(file_handler)

logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="frontend/dist", static_url_path="/")

# Initialize WebSocket support
socketio = init_socketio(app)

# Swagger UI configuration
SWAGGER_URL = "/api/docs"
API_URL = "/swagger.json"  # Will be served by custom route
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL, API_URL, config={"app_name": "Network Inventory Dashboard API"}
)
app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

# Initialize database
db = Database()

# Configuration
SCAN_COOLDOWN = int(os.getenv("SCAN_COOLDOWN", "300"))  # 5 minutes default
HISTORY_ENABLED = os.getenv("HISTORY_ENABLED", "true").lower() == "true"
last_scan_time = None
last_scan_data = None
scan_lock = threading.Lock()
is_scanning = False


def load_config():
    """Load configuration from file or environment variables"""
    config_path = os.getenv("CONFIG_PATH", "config.yaml")

    if os.path.exists(config_path):
        logger.info(f"Loading configuration from {config_path}")
        with open(config_path) as f:
            config = yaml.safe_load(f)
            if config:
                logger.info("Configuration loaded successfully from YAML file")
                return config

    # Fallback to environment variables
    logger.info("Using environment variables for configuration")
    return {
        "network_scan": {
            "enabled": os.getenv("NETWORK_SCAN_ENABLED", "true").lower() == "true",
            "subnet": os.getenv("NETWORK_SUBNET", "10.69.1.0/24"),
        },
        "unifi": {
            "enabled": os.getenv("UNIFI_ENABLED", "true").lower() == "true",
            "host": os.getenv("UNIFI_HOST"),
            "port": int(os.getenv("UNIFI_PORT", "443")),
            "username": os.getenv("UNIFI_USERNAME"),
            "password": os.getenv("UNIFI_PASSWORD"),
            "site": os.getenv("UNIFI_SITE", "default"),
        },
        "portainer": [
            {
                "name": os.getenv("PORTAINER_NAME", "Main Portainer"),
                "enabled": os.getenv("PORTAINER_ENABLED", "true").lower() == "true",
                "url": os.getenv("PORTAINER_URL"),
                "api_token": os.getenv("PORTAINER_API_TOKEN"),
            }
        ],
        "proxmox": [
            {
                "name": os.getenv("PROXMOX_NAME", "Main Proxmox"),
                "enabled": os.getenv("PROXMOX_ENABLED", "false").lower() == "true",
                "host": os.getenv("PROXMOX_HOST"),
                "api_token_name": os.getenv("PROXMOX_API_TOKEN_NAME"),
                "api_token_value": os.getenv("PROXMOX_API_TOKEN_VALUE"),
                "verify_ssl": os.getenv("PROXMOX_VERIFY_SSL", "false").lower() == "true",
            }
        ] if os.getenv("PROXMOX_HOST") else [],
    }


def can_scan():
    """Check if enough time has passed since last scan"""
    global last_scan_time
    if last_scan_time is None:
        return True

    time_since_scan = (datetime.now() - last_scan_time).total_seconds()
    return time_since_scan >= SCAN_COOLDOWN


def perform_scan():
    """Perform network and container inventory scan"""
    global last_scan_time, last_scan_data, is_scanning

    with scan_lock:
        if is_scanning:
            logger.warning("Scan request rejected: scan already in progress")
            return {"error": "Scan already in progress"}, 429

        if not can_scan():
            time_remaining = SCAN_COOLDOWN - (datetime.now() - last_scan_time).total_seconds()
            logger.info(
                f"Scan request rejected: cooldown active ({int(time_remaining)}s remaining)"
            )
            return {
                "error": f"Please wait {int(time_remaining)} seconds before scanning again",
                "cooldown_remaining": int(time_remaining),
            }, 429

        is_scanning = True

    try:
        logger.info("Starting network and container inventory scan")
        emit_scan_started()

        config = load_config()
        inventory = NetworkInventory(config)

        network_data, container_data, vm_data = inventory.scan_all()

        last_scan_time = datetime.now()
        last_scan_data = {
            "network": network_data,
            "containers": container_data,
            "vms": vm_data,
            "timestamp": last_scan_time.isoformat(),
            "next_scan_available": (last_scan_time + timedelta(seconds=SCAN_COOLDOWN)).isoformat(),
        }

        # Save to history if enabled
        if HISTORY_ENABLED:
            try:
                db.save_scan(last_scan_data)
                logger.info("Scan data saved to history")
            except Exception as e:
                logger.error(f"Failed to save scan to history: {e}")

        logger.info(
            f"Scan completed successfully: {len(network_data.get('clients', []))} UniFi clients, "
            f"{len(container_data)} containers"
        )

        emit_scan_completed(last_scan_data)
        return last_scan_data, 200

    except Exception as e:
        logger.error(f"Scan failed with error: {e}", exc_info=True)
        emit_scan_failed(str(e))
        return {"error": "Scan failed", "message": str(e)}, 500

    finally:
        with scan_lock:
            is_scanning = False


@app.route("/swagger.json")
def swagger_spec():
    """Serve OpenAPI/Swagger specification"""
    import json

    swagger_path = os.path.join(os.path.dirname(__file__), "static", "swagger.json")
    with open(swagger_path) as f:
        spec = json.load(f)
    return jsonify(spec)


@app.route("/")
def index():
    """Serve the main dashboard (React app)"""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/scan", methods=["POST"])
def trigger_scan():
    """API endpoint to trigger a new scan"""
    data, status_code = perform_scan()
    return jsonify(data), status_code


@app.route("/api/data", methods=["GET"])
def get_data():
    """Get the last scan data without triggering a new scan"""
    if last_scan_data is None:
        # If no data exists, perform initial scan
        data, status_code = perform_scan()
        return jsonify(data), status_code

    # Return cached data with freshness info
    response = last_scan_data.copy()
    response["is_cached"] = True
    response["can_refresh"] = can_scan()

    if last_scan_time:
        response["age_seconds"] = (datetime.now() - last_scan_time).total_seconds()

    return jsonify(response)


@app.route("/api/status", methods=["GET"])
def get_status():
    """Get scan status information"""
    status = {
        "is_scanning": is_scanning,
        "can_scan": can_scan(),
        "last_scan": last_scan_time.isoformat() if last_scan_time else None,
        "scan_cooldown": SCAN_COOLDOWN,
    }

    if last_scan_time and not can_scan():
        time_remaining = SCAN_COOLDOWN - (datetime.now() - last_scan_time).total_seconds()
        status["cooldown_remaining"] = int(time_remaining)

    return jsonify(status)


@app.route("/health")
def health():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200


@app.route("/api/history", methods=["GET"])
def get_history():
    """Get scan history"""
    if not HISTORY_ENABLED:
        return jsonify({"error": "History feature is disabled"}), 404

    limit = request.args.get("limit", 10, type=int)
    scans = db.get_recent_scans(limit=min(limit, 100))
    return jsonify({"scans": scans})


@app.route("/api/history/<int:scan_id>", methods=["GET"])
def get_history_scan(scan_id):
    """Get specific historical scan by ID"""
    if not HISTORY_ENABLED:
        return jsonify({"error": "History feature is disabled"}), 404

    scan = db.get_scan_by_id(scan_id)
    if scan:
        return jsonify(scan)
    return jsonify({"error": "Scan not found"}), 404


@app.route("/api/metrics/<metric_name>", methods=["GET"])
def get_metrics(metric_name):
    """Get metric history for trend analysis"""
    if not HISTORY_ENABLED:
        return jsonify({"error": "History feature is disabled"}), 404

    hours = request.args.get("hours", 24, type=int)
    metrics = db.get_metric_history(metric_name, hours=min(hours, 168))  # Max 1 week
    return jsonify({"metric": metric_name, "data": metrics})


@app.route("/api/history/cleanup", methods=["POST"])
def cleanup_history():
    """Cleanup old historical data"""
    if not HISTORY_ENABLED:
        return jsonify({"error": "History feature is disabled"}), 404

    days = request.args.get("days", 30, type=int)
    result = db.cleanup_old_data(days=days)
    return jsonify(result)


@app.route("/api/settings", methods=["GET"])
def get_settings():
    """Get all user settings"""
    try:
        settings = db.get_all_settings()
        return jsonify({"settings": settings})
    except Exception as e:
        logger.error(f"Failed to get settings: {e}")
        return jsonify({"error": "Failed to retrieve settings"}), 500


@app.route("/api/settings", methods=["PUT"])
def update_settings():
    """Update user settings"""
    try:
        data = request.get_json()
        if not data or "settings" not in data:
            return jsonify({"error": "Invalid request body"}), 400

        settings = data["settings"]
        db.update_settings(settings)
        logger.info(f"Settings updated: {list(settings.keys())}")
        return jsonify({"success": True, "settings": settings})
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        return jsonify({"error": "Failed to update settings"}), 500


@app.route("/api/diagram/generate", methods=["POST"])
def generate_diagram():
    """Generate network topology diagram"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request body"}), 400

        format = data.get("format", "png")  # png or svg
        options = data.get("options", {})

        if format not in ['png', 'svg']:
            return jsonify({"error": "Invalid format. Use 'png' or 'svg'"}), 400

        # Get latest scan data or use cached
        if last_scan_data is None:
            return jsonify({"error": "No scan data available. Please run a scan first."}), 404

        # Generate diagram
        from diagram_generator import TopologyDiagramGenerator
        import io

        generator = TopologyDiagramGenerator(last_scan_data, options)
        diagram_bytes = generator.generate(format=format)

        # Return as downloadable file
        mimetype = 'image/png' if format == 'png' else 'image/svg+xml'
        filename = f'network-topology.{format}'

        return send_file(
            io.BytesIO(diagram_bytes),
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )

    except Exception as e:
        logger.error(f"Diagram generation failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/diagram/preview", methods=["POST"])
def preview_diagram():
    """Generate SVG preview for display in UI"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request body"}), 400

        options = data.get("options", {})

        # Get latest scan data or use cached
        if last_scan_data is None:
            return jsonify({"error": "No scan data available. Please run a scan first."}), 404

        # Generate diagram as SVG
        from diagram_generator import TopologyDiagramGenerator
        import io

        generator = TopologyDiagramGenerator(last_scan_data, options)
        diagram_bytes = generator.generate(format='svg')

        # Get grouping info
        grouping_info = generator.get_grouping_info()

        # Return SVG inline with grouping metadata
        return send_file(
            io.BytesIO(diagram_bytes),
            mimetype='image/svg+xml',
            as_attachment=False  # Display inline
        )

    except Exception as e:
        logger.error(f"Diagram preview failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/diagram/templates", methods=["GET"])
def get_diagram_templates():
    """Get all diagram templates"""
    try:
        templates = db.get_diagram_templates()
        return jsonify({"templates": templates})
    except Exception as e:
        logger.error(f"Failed to fetch diagram templates: {e}")
        return jsonify({"error": "Failed to fetch templates"}), 500


@app.route("/api/diagram/templates", methods=["POST"])
def save_diagram_template():
    """Save a new diagram template"""
    try:
        data = request.get_json()
        if not data or "name" not in data or "options" not in data:
            return jsonify({"error": "Invalid request body. Required: name, options"}), 400

        name = data["name"]
        options = data["options"]

        template_id = db.save_diagram_template(name, options)
        logger.info(f"Saved diagram template: {name}")

        return jsonify({
            "success": True,
            "id": template_id,
            "name": name
        })
    except Exception as e:
        logger.error(f"Failed to save diagram template: {e}")
        return jsonify({"error": "Failed to save template"}), 500


@app.route("/api/diagram/templates/<name>", methods=["DELETE"])
def delete_diagram_template(name):
    """Delete a diagram template"""
    try:
        deleted = db.delete_diagram_template(name)
        if deleted:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Template not found"}), 404
    except Exception as e:
        logger.error(f"Failed to delete diagram template: {e}")
        return jsonify({"error": "Failed to delete template"}), 500


if __name__ == "__main__":
    # Validate environment before starting
    logger.info("Validating configuration...")
    warnings = validate_environment()

    if warnings:
        print("\n" + "=" * 70)
        print("  Configuration Validation Results")
        print("=" * 70)
        for warning in warnings:
            if warning.startswith("ERROR:"):
                print(f"  ❌ {warning}")
            else:
                print(f"  ⚠️  {warning}")
        print("=" * 70 + "\n")

    if check_fatal_errors(warnings):
        logger.error("Fatal configuration errors detected. Exiting.")
        sys.exit(1)

    # Run Flask app
    port = int(os.getenv("PORT", "5000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"

    logger.info("=" * 70)
    logger.info("  Network Inventory Dashboard Starting")
    logger.info("=" * 70)
    logger.info(f"  Port: {port}")
    logger.info(f"  Log Level: {LOG_LEVEL}")
    logger.info(f"  Scan Cooldown: {SCAN_COOLDOWN} seconds")
    logger.info(f"  History Tracking: {'Enabled' if HISTORY_ENABLED else 'Disabled'}")
    logger.info("  WebSocket: Enabled")
    logger.info(f"  Debug Mode: {debug}")
    logger.info(f"  API Docs: http://localhost:{port}/api/docs")
    logger.info("=" * 70)

    socketio.run(app, host="0.0.0.0", port=port, debug=debug, allow_unsafe_werkzeug=True)
