"""Database module for historical data tracking"""

import json
import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime


logger = logging.getLogger(__name__)


class Database:
    """SQLite database manager for scan history"""

    def __init__(self, db_path: str = "data/inventory.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}", exc_info=True)
            raise
        finally:
            conn.close()

    def _init_db(self):
        """Initialize database schema"""
        import os

        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Scan history table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS scan_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME NOT NULL,
                    scan_type TEXT NOT NULL,
                    data TEXT NOT NULL,
                    summary TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Metrics table for aggregated stats
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME NOT NULL,
                    metric_name TEXT NOT NULL,
                    metric_value REAL NOT NULL,
                    metadata TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Create indexes
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_scan_history_timestamp
                ON scan_history(timestamp)
            """
            )

            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
                ON metrics(timestamp, metric_name)
            """
            )

            # User settings table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Diagram templates table
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS diagram_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    options TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """
            )

            # Insert default settings if they don't exist
            cursor.execute(
                """
                INSERT OR IGNORE INTO settings (key, value) VALUES
                ('auto_refresh_enabled', 'false'),
                ('status_poll_interval', '5000'),
                ('default_chart_time_range', '24'),
                ('theme', 'light'),
                ('scan_cooldown', '300'),
                ('diagram_include_containers', 'true'),
                ('diagram_include_vms', 'true'),
                ('diagram_include_iot_devices', 'true'),
                ('diagram_include_vlans', 'true'),
                ('diagram_include_aps', 'true'),
                ('diagram_theme', 'light'),
                ('diagram_last_template', '')
            """
            )

            logger.info(f"Database initialized at {self.db_path}")

    def save_scan(self, scan_data: dict, scan_type: str = "full") -> int:
        """
        Save scan results to history

        Args:
            scan_data: Complete scan data dictionary
            scan_type: Type of scan ('full', 'network', 'containers')

        Returns:
            Scan ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Generate summary
            summary = {
                "total_clients": len(scan_data.get("network", {}).get("clients", [])),
                "total_containers": len(scan_data.get("containers", [])),
                "total_networks": len(scan_data.get("network", {}).get("networks", [])),
                "total_aps": len(scan_data.get("network", {}).get("access_points", [])),
            }

            cursor.execute(
                """
                INSERT INTO scan_history (timestamp, scan_type, data, summary)
                VALUES (?, ?, ?, ?)
            """,
                (
                    scan_data.get("timestamp", datetime.now().isoformat()),
                    scan_type,
                    json.dumps(scan_data),
                    json.dumps(summary),
                ),
            )

            scan_id = cursor.lastrowid

            # Save individual metrics
            self._save_metrics(cursor, scan_data)

            logger.info(f"Saved scan history with ID {scan_id}")
            return scan_id

    def _save_metrics(self, cursor, scan_data: dict):
        """Save individual metrics for trend analysis"""
        timestamp = scan_data.get("timestamp", datetime.now().isoformat())

        metrics = [
            ("client_count", len(scan_data.get("network", {}).get("clients", []))),
            ("container_count", len(scan_data.get("containers", []))),
            ("network_count", len(scan_data.get("network", {}).get("networks", []))),
            ("ap_count", len(scan_data.get("network", {}).get("access_points", []))),
        ]

        # Count running vs stopped containers
        containers = scan_data.get("containers", [])
        running = sum(1 for c in containers if "running" in c.get("Status", "").lower())
        stopped = len(containers) - running
        metrics.extend(
            [
                ("containers_running", running),
                ("containers_stopped", stopped),
            ]
        )

        # WiFi signal metrics
        clients = scan_data.get("network", {}).get("clients", [])
        wireless_clients = [c for c in clients if not c.get("is_wired", True)]
        if wireless_clients:
            signals = [c.get("rssi", 0) for c in wireless_clients if c.get("rssi")]
            if signals:
                avg_signal = sum(signals) / len(signals)
                metrics.append(("avg_wifi_signal", avg_signal))

        for metric_name, metric_value in metrics:
            cursor.execute(
                """
                INSERT INTO metrics (timestamp, metric_name, metric_value)
                VALUES (?, ?, ?)
            """,
                (timestamp, metric_name, metric_value),
            )

    def get_recent_scans(self, limit: int = 10) -> list[dict]:
        """Get most recent scan summaries"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, timestamp, scan_type, summary, created_at
                FROM scan_history
                ORDER BY timestamp DESC
                LIMIT ?
            """,
                (limit,),
            )

            scans = []
            for row in cursor.fetchall():
                scans.append(
                    {
                        "id": row["id"],
                        "timestamp": row["timestamp"],
                        "scan_type": row["scan_type"],
                        "summary": json.loads(row["summary"]) if row["summary"] else {},
                        "created_at": row["created_at"],
                    }
                )

            return scans

    def get_scan_by_id(self, scan_id: int) -> dict | None:
        """Get full scan data by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT timestamp, scan_type, data, summary
                FROM scan_history
                WHERE id = ?
            """,
                (scan_id,),
            )

            row = cursor.fetchone()
            if row:
                return {
                    "timestamp": row["timestamp"],
                    "scan_type": row["scan_type"],
                    "data": json.loads(row["data"]),
                    "summary": json.loads(row["summary"]) if row["summary"] else {},
                }
            return None

    def get_metric_history(self, metric_name: str, hours: int = 24) -> list[dict]:
        """Get metric history for specified time period"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT timestamp, metric_value, metadata
                FROM metrics
                WHERE metric_name = ?
                AND datetime(timestamp) >= datetime('now', '-' || ? || ' hours')
                ORDER BY timestamp ASC
            """,
                (metric_name, hours),
            )

            return [
                {
                    "timestamp": row["timestamp"],
                    "value": row["metric_value"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                }
                for row in cursor.fetchall()
            ]

    def cleanup_old_data(self, days: int = 30):
        """Remove scan data older than specified days"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                DELETE FROM scan_history
                WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
            """,
                (days,),
            )

            deleted_scans = cursor.rowcount

            cursor.execute(
                """
                DELETE FROM metrics
                WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
            """,
                (days,),
            )

            deleted_metrics = cursor.rowcount

            logger.info(f"Cleaned up {deleted_scans} old scans and {deleted_metrics} old metrics")

            return {"deleted_scans": deleted_scans, "deleted_metrics": deleted_metrics}

    def get_setting(self, key: str, default: str = None) -> str:
        """Get a single setting value"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cursor.fetchone()
            return row["value"] if row else default

    def get_all_settings(self) -> dict:
        """Get all settings as a dictionary"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT key, value FROM settings")
            return {row["key"]: row["value"] for row in cursor.fetchall()}

    def set_setting(self, key: str, value: str):
        """Set a single setting value"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
            """,
                (key, value),
            )
            logger.debug(f"Setting updated: {key} = {value}")

    def update_settings(self, settings: dict):
        """Update multiple settings at once"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            for key, value in settings.items():
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO settings (key, value, updated_at)
                    VALUES (?, ?, datetime('now'))
                """,
                    (key, str(value)),
                )
            logger.info(f"Updated {len(settings)} settings")

    def save_diagram_template(self, name: str, options: dict) -> int:
        """
        Save a diagram template

        Args:
            name: Template name
            options: Diagram options dictionary

        Returns:
            Template ID
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO diagram_templates (name, options, updated_at)
                VALUES (?, ?, datetime('now'))
            """,
                (name, json.dumps(options)),
            )
            template_id = cursor.lastrowid
            logger.info(f"Saved diagram template: {name}")
            return template_id

    def get_diagram_templates(self) -> list[dict]:
        """Get all diagram templates"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, options, created_at, updated_at
                FROM diagram_templates
                ORDER BY name
            """
            )
            templates = []
            for row in cursor.fetchall():
                templates.append(
                    {
                        "id": row["id"],
                        "name": row["name"],
                        "options": json.loads(row["options"]),
                        "created_at": row["created_at"],
                        "updated_at": row["updated_at"],
                    }
                )
            return templates

    def get_diagram_template(self, name: str) -> dict:
        """Get a specific diagram template by name"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, name, options, created_at, updated_at
                FROM diagram_templates
                WHERE name = ?
            """,
                (name,),
            )
            row = cursor.fetchone()
            if row:
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "options": json.loads(row["options"]),
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                }
            return None

    def delete_diagram_template(self, name: str) -> bool:
        """Delete a diagram template"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM diagram_templates WHERE name = ?", (name,))
            deleted = cursor.rowcount > 0
            if deleted:
                logger.info(f"Deleted diagram template: {name}")
            return deleted
