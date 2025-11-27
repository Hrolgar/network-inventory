"""Tests for inventory scanner modules"""

import os
import sys
from unittest.mock import MagicMock, patch


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from inventory_scanner import NetworkInventory, NetworkScanner, PortainerAPI, UniFiAPI


class TestNetworkScanner:
    """Test NetworkScanner class"""

    def test_scanner_init(self):
        """Scanner should initialize with subnet"""
        scanner = NetworkScanner("192.168.1.0/24")
        assert scanner.subnet == "192.168.1.0/24"

    @patch("subprocess.run")
    def test_scan_network_success(self, mock_run):
        """Network scan should parse nmap output correctly"""
        mock_run.return_value = MagicMock(
            stdout="""
            Nmap scan report for router (192.168.1.1)
            MAC Address: AA:BB:CC:DD:EE:FF (Vendor Name)
            """,
            returncode=0,
        )
        scanner = NetworkScanner("192.168.1.0/24")
        devices = scanner.scan_network()
        assert isinstance(devices, list)

    @patch("subprocess.run")
    def test_scan_network_timeout(self, mock_run):
        """Network scan should handle timeout gracefully"""
        mock_run.side_effect = Exception("Timeout")
        scanner = NetworkScanner("192.168.1.0/24")
        devices = scanner.scan_network()
        assert devices == []


class TestUniFiAPI:
    """Test UniFiAPI class"""

    def test_unifi_init(self):
        """UniFi API should initialize with credentials"""
        api = UniFiAPI("host", "user", "pass", 443, "default")
        assert api.base_url == "https://host:443"
        assert api.username == "user"
        assert api.password == "pass"
        assert api.site == "default"

    @patch("requests.Session.post")
    def test_login_unifi_os(self, mock_post):
        """Should detect UniFi OS login"""
        mock_post.return_value = MagicMock(status_code=200)
        api = UniFiAPI("host", "user", "pass")
        result = api.login()
        assert result is True
        assert api.is_unifi_os is True
        assert api.api_prefix == "/proxy/network"

    @patch("requests.Session.post")
    def test_login_traditional(self, mock_post):
        """Should detect traditional controller login"""
        mock_post.side_effect = [
            MagicMock(status_code=404),  # UniFi OS fails
            MagicMock(status_code=200),  # Traditional succeeds
        ]
        api = UniFiAPI("host", "user", "pass")
        result = api.login()
        assert result is True
        assert api.is_unifi_os is False
        assert api.api_prefix == ""

    @patch("requests.Session.get")
    def test_get_clients(self, mock_get):
        """Should fetch clients list"""
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: {"data": [{"mac": "AA:BB:CC:DD:EE:FF"}]}
        )
        api = UniFiAPI("host", "user", "pass")
        api.logged_in = True
        clients = api.get_clients()
        assert len(clients) == 1
        assert clients[0]["mac"] == "AA:BB:CC:DD:EE:FF"


class TestPortainerAPI:
    """Test PortainerAPI class"""

    def test_portainer_init(self):
        """Portainer API should initialize with credentials"""
        api = PortainerAPI("Main", "https://host:9443", "token123")
        assert api.name == "Main"
        assert api.url == "https://host:9443"
        assert api.api_token == "token123"

    @patch("requests.get")
    def test_get_endpoints(self, mock_get):
        """Should fetch endpoints"""
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: [{"Id": 1, "Name": "local"}]
        )
        api = PortainerAPI("Main", "https://host:9443", "token")
        endpoints = api.get_endpoints()
        assert len(endpoints) == 1
        assert endpoints[0]["Name"] == "local"

    @patch("requests.get")
    def test_get_containers(self, mock_get):
        """Should fetch containers for endpoint"""
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: [{"Id": "abc123", "Names": ["/test"]}]
        )
        api = PortainerAPI("Main", "https://host:9443", "token")
        containers = api.get_containers(1)
        assert len(containers) == 1


class TestNetworkInventory:
    """Test NetworkInventory orchestrator"""

    def test_inventory_init(self):
        """Inventory should initialize with config"""
        config = {"network_scan": {"enabled": False}}
        inventory = NetworkInventory(config)
        assert inventory.config == config

    @patch("inventory_scanner.NetworkScanner.scan_network")
    def test_scan_all_network_disabled(self, mock_scan):
        """Should skip network scan when disabled"""
        config = {"network_scan": {"enabled": False}}
        inventory = NetworkInventory(config)
        network_data, container_data = inventory.scan_all()
        mock_scan.assert_not_called()
        assert network_data["scan_results"] == []

    @patch("inventory_scanner.UniFiAPI")
    def test_scan_all_unifi_enabled(self, mock_unifi):
        """Should scan UniFi when enabled"""
        mock_instance = MagicMock()
        mock_instance.login.return_value = True
        mock_instance.get_clients.return_value = []
        mock_instance.get_networks.return_value = []
        mock_instance.get_access_points.return_value = []
        mock_unifi.return_value = mock_instance

        config = {
            "network_scan": {"enabled": False},
            "unifi": {"enabled": True, "host": "host", "username": "user", "password": "pass"},
        }
        inventory = NetworkInventory(config)
        network_data, _ = inventory.scan_all()
        mock_instance.login.assert_called_once()
        mock_instance.get_clients.assert_called_once()
