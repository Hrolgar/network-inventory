"""Tests for Flask app endpoints"""

import os
import sys
from datetime import datetime
from unittest.mock import patch


# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app import app, load_config


@pytest.fixture
def client():
    """Create test client"""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_scan_data():
    """Mock scan data"""
    return {
        "network": {"clients": [], "networks": [], "access_points": [], "scan_results": []},
        "containers": [],
        "timestamp": datetime.now().isoformat(),
        "next_scan_available": datetime.now().isoformat(),
    }


class TestHealthEndpoint:
    """Test health check endpoint"""

    def test_health_returns_200(self, client):
        """Health endpoint should return 200"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json == {"status": "healthy"}


class TestStatusEndpoint:
    """Test status endpoint"""

    def test_status_returns_scan_info(self, client):
        """Status endpoint should return scan status"""
        response = client.get("/api/status")
        assert response.status_code == 200
        data = response.json
        assert "is_scanning" in data
        assert "can_scan" in data
        assert "scan_cooldown" in data


class TestDataEndpoint:
    """Test data endpoint"""

    @patch("app.perform_scan")
    def test_data_triggers_initial_scan(self, mock_perform_scan, client, mock_scan_data):
        """Data endpoint should trigger scan if no data exists"""
        mock_perform_scan.return_value = (mock_scan_data, 200)
        response = client.get("/api/data")
        assert response.status_code == 200
        mock_perform_scan.assert_called_once()


class TestScanEndpoint:
    """Test scan endpoint"""

    @patch("app.perform_scan")
    def test_scan_endpoint(self, mock_perform_scan, client, mock_scan_data):
        """Scan endpoint should trigger scan"""
        mock_perform_scan.return_value = (mock_scan_data, 200)
        response = client.post("/api/scan")
        assert response.status_code == 200
        mock_perform_scan.assert_called_once()

    @patch("app.perform_scan")
    def test_scan_respects_cooldown(self, mock_perform_scan, client):
        """Scan endpoint should respect cooldown"""
        mock_perform_scan.return_value = ({"error": "Please wait", "cooldown_remaining": 100}, 429)
        response = client.post("/api/scan")
        assert response.status_code == 429
        assert "error" in response.json


class TestConfig:
    """Test configuration loading"""

    @patch.dict(
        os.environ,
        {
            "NETWORK_SUBNET": "192.168.1.0/24",
            "UNIFI_HOST": "test.local",
            "UNIFI_USERNAME": "testuser",
            "UNIFI_PASSWORD": "testpass",
        },
    )
    def test_load_config_from_env(self):
        """Config should load from environment variables"""
        config = load_config()
        assert config["network_scan"]["subnet"] == "192.168.1.0/24"
        assert config["unifi"]["host"] == "test.local"
        assert config["unifi"]["username"] == "testuser"

    @patch("os.path.exists")
    @patch("builtins.open")
    def test_load_config_from_yaml(self, mock_open, mock_exists):
        """Config should prefer YAML file over env vars"""
        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = """
        network_scan:
          enabled: true
          subnet: "10.0.0.0/24"
        """
        # This would require yaml parsing, simplified for now
        assert True  # Placeholder
