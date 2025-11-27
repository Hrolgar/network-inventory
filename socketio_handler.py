"""WebSocket handler using Flask-SocketIO"""

import logging

from flask_socketio import SocketIO


logger = logging.getLogger(__name__)

# Global socketio instance (initialized in app.py)
socketio = None


def init_socketio(app):
    """Initialize SocketIO with Flask app"""
    global socketio
    socketio = SocketIO(
        app, cors_allowed_origins="*", async_mode="threading", logger=False, engineio_logger=False
    )
    logger.info("WebSocket support initialized")
    return socketio


def emit_scan_started():
    """Emit event when scan starts"""
    if socketio:
        logger.debug("Emitting scan_started event")
        socketio.emit("scan_started", {"status": "scanning"})


def emit_scan_completed(scan_data):
    """Emit event when scan completes"""
    if socketio:
        logger.debug("Emitting scan_completed event")
        # Send summary instead of full data to reduce bandwidth
        summary = {
            "timestamp": scan_data.get("timestamp"),
            "total_clients": len(scan_data.get("network", {}).get("clients", [])),
            "total_containers": len(scan_data.get("containers", [])),
            "can_refresh": scan_data.get("can_refresh", False),
        }
        socketio.emit("scan_completed", summary)


def emit_scan_failed(error_message):
    """Emit event when scan fails"""
    if socketio:
        logger.debug(f"Emitting scan_failed event: {error_message}")
        socketio.emit("scan_failed", {"error": error_message})


def emit_status_update(status_data):
    """Emit status update event"""
    if socketio:
        logger.debug("Emitting status_update event")
        socketio.emit("status_update", status_data)
