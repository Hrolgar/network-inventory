#!/usr/bin/env python3
"""
Network Inventory Scanner Module
Refactored from network_inventory.py to be importable
"""

import re
import subprocess

import requests
import urllib3


# Disable SSL warnings for local/self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class NetworkScanner:
    """Handles network scanning using nmap"""

    def __init__(self, subnet: str = "192.168.1.0/24"):
        self.subnet = subnet

    def scan_network(self) -> list[dict]:
        """Scan network for active devices"""
        print(f"[*] Scanning network {self.subnet}...")
        devices = []

        try:
            result = subprocess.run(
                ["nmap", "-sn", "-T4", self.subnet], capture_output=True, text=True, timeout=120
            )

            current_device = {}
            for line in result.stdout.split("\n"):
                if "Nmap scan report for" in line:
                    if current_device:
                        devices.append(current_device)
                    current_device = {}
                    match = re.search(r"for (.+?) \((.+?)\)", line)
                    if match:
                        current_device["hostname"] = match.group(1)
                        current_device["ip"] = match.group(2)
                    else:
                        match = re.search(r"for (.+)$", line)
                        if match:
                            current_device["ip"] = match.group(1).strip()
                            current_device["hostname"] = ""

                elif "MAC Address:" in line:
                    match = re.search(r"MAC Address: (.+?) \((.+?)\)", line)
                    if match:
                        current_device["mac"] = match.group(1)
                        current_device["vendor"] = match.group(2)
                    else:
                        match = re.search(r"MAC Address: (.+)$", line)
                        if match:
                            current_device["mac"] = match.group(1).strip()

            if current_device:
                devices.append(current_device)

            print(f"[+] Found {len(devices)} devices")
            return devices

        except subprocess.TimeoutExpired:
            print("[!] Network scan timed out")
            return []
        except FileNotFoundError:
            print("[!] nmap not found. Install with: sudo apt install nmap")
            return []
        except Exception as e:
            print(f"[!] Error scanning network: {e}")
            return []


class UniFiAPI:
    """Handles UniFi Controller API interactions"""

    def __init__(
        self, host: str, username: str, password: str, port: int = 8443, site: str = "default"
    ):
        self.base_url = f"https://{host}:{port}"
        self.username = username
        self.password = password
        self.site = site
        self.session = requests.Session()
        self.session.verify = False
        self.logged_in = False
        self.is_unifi_os = False
        self.api_prefix = ""

    def login(self) -> bool:
        """Login to UniFi Controller (auto-detects traditional vs UniFi OS)"""
        try:
            print("[*] Logging into UniFi Controller...")

            # Try UniFi OS first (UDM/UDM Pro)
            response = self.session.post(
                f"{self.base_url}/api/auth/login",
                json={"username": self.username, "password": self.password},
                timeout=10,
            )

            if response.status_code == 200:
                self.logged_in = True
                self.is_unifi_os = True
                self.api_prefix = "/proxy/network"
                print("[+] Successfully logged into UniFi OS (UDM/UDM Pro)")
                return True

            # Try traditional UniFi Controller
            response = self.session.post(
                f"{self.base_url}/api/login",
                json={"username": self.username, "password": self.password},
                timeout=10,
            )

            if response.status_code == 200:
                self.logged_in = True
                self.is_unifi_os = False
                self.api_prefix = ""
                print("[+] Successfully logged into UniFi Controller")
                return True
            else:
                print(f"[!] UniFi login failed: {response.status_code}")
                return False

        except Exception as e:
            print(f"[!] Error connecting to UniFi: {e}")
            return False

    def get_clients(self) -> list[dict]:
        """Get all connected clients"""
        if not self.logged_in:
            return []

        try:
            print("[*] Fetching UniFi clients...")
            response = self.session.get(
                f"{self.base_url}{self.api_prefix}/api/s/{self.site}/stat/sta", timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                clients = data.get("data", [])
                print(f"[+] Found {len(clients)} connected clients")
                return clients
            else:
                print(f"[!] Failed to fetch clients: {response.status_code}")
                return []

        except Exception as e:
            print(f"[!] Error fetching clients: {e}")
            return []

    def get_networks(self) -> list[dict]:
        """Get all configured networks"""
        if not self.logged_in:
            return []

        try:
            print("[*] Fetching UniFi networks...")
            response = self.session.get(
                f"{self.base_url}{self.api_prefix}/api/s/{self.site}/rest/networkconf", timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                networks = data.get("data", [])
                print(f"[+] Found {len(networks)} configured networks")
                return networks
            else:
                print(f"[!] Failed to fetch networks: {response.status_code}")
                return []

        except Exception as e:
            print(f"[!] Error fetching networks: {e}")
            return []

    def get_access_points(self) -> list[dict]:
        """Get all access points"""
        if not self.logged_in:
            return []

        try:
            print("[*] Fetching UniFi access points...")
            response = self.session.get(
                f"{self.base_url}{self.api_prefix}/api/s/{self.site}/stat/device", timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                devices = data.get("data", [])
                aps = [d for d in devices if d.get("type") in ["uap", "udm", "uxg"]]
                print(f"[+] Found {len(aps)} access points")
                return aps
            else:
                print(f"[!] Failed to fetch APs: {response.status_code}")
                return []

        except Exception as e:
            print(f"[!] Error fetching APs: {e}")
            return []

    def logout(self):
        """Logout from UniFi Controller"""
        if self.logged_in:
            try:
                self.session.post(f"{self.base_url}/api/logout")
                print("[+] Logged out from UniFi")
            except Exception:
                pass


class PortainerAPI:
    """Handles Portainer API interactions"""

    def __init__(self, name: str, url: str, api_token: str):
        self.name = name
        self.url = url.rstrip("/")
        self.api_token = api_token
        self.headers = {"X-API-Key": api_token}

    def get_endpoints(self) -> list[dict]:
        """Get all Docker endpoints"""
        try:
            print(f"[*] Fetching endpoints from {self.name}...")
            response = requests.get(
                f"{self.url}/api/endpoints", headers=self.headers, timeout=10, verify=False
            )

            if response.status_code == 200:
                endpoints = response.json()
                print(f"[+] Found {len(endpoints)} endpoints")
                return endpoints
            else:
                print(f"[!] Failed to fetch endpoints: {response.status_code}")
                return []

        except Exception as e:
            print(f"[!] Error connecting to {self.name}: {e}")
            return []

    def get_containers(self, endpoint_id: int) -> list[dict]:
        """Get all containers for an endpoint"""
        try:
            response = requests.get(
                f"{self.url}/api/endpoints/{endpoint_id}/docker/containers/json?all=1",
                headers=self.headers,
                timeout=10,
                verify=False,
            )

            if response.status_code == 200:
                containers = response.json()
                return containers
            else:
                print(
                    f"[!] Failed to fetch containers for endpoint {endpoint_id}: {response.status_code}"
                )
                return []

        except Exception as e:
            print(f"[!] Error fetching containers: {e}")
            return []

    def get_all_containers(self) -> list[dict]:
        """Get all containers from all endpoints"""
        all_containers = []
        endpoints = self.get_endpoints()

        for endpoint in endpoints:
            endpoint_id = endpoint["Id"]
            endpoint_name = endpoint["Name"]
            print(f"[*] Fetching containers from endpoint: {endpoint_name}...")

            containers = self.get_containers(endpoint_id)

            for container in containers:
                container["portainer_instance"] = self.name
                container["endpoint_name"] = endpoint_name
                container["endpoint_id"] = endpoint_id
                all_containers.append(container)

        print(f"[+] Found {len(all_containers)} total containers on {self.name}")
        return all_containers


class NetworkInventory:
    """Main inventory class that coordinates all scanners"""

    def __init__(self, config: dict):
        self.config = config

    def scan_all(self):
        """Perform complete inventory scan"""
        network_data = {"clients": [], "networks": [], "access_points": [], "scan_results": []}
        container_data = []

        # Network scanning
        if self.config.get("network_scan", {}).get("enabled", False):
            subnet = self.config["network_scan"].get("subnet", "192.168.1.0/24")
            scanner = NetworkScanner(subnet)
            network_data["scan_results"] = scanner.scan_network()

        # UniFi API
        if self.config.get("unifi", {}).get("enabled", False):
            unifi_config = self.config["unifi"]
            unifi = UniFiAPI(
                host=unifi_config["host"],
                username=unifi_config["username"],
                password=unifi_config["password"],
                port=unifi_config.get("port", 8443),
                site=unifi_config.get("site", "default"),
            )

            if unifi.login():
                network_data["clients"] = unifi.get_clients()
                network_data["networks"] = unifi.get_networks()
                network_data["access_points"] = unifi.get_access_points()
                unifi.logout()

        # Portainer instances
        if self.config.get("portainer"):
            for instance in self.config["portainer"]:
                if instance.get("enabled", True):
                    portainer = PortainerAPI(
                        name=instance["name"], url=instance["url"], api_token=instance["api_token"]
                    )
                    containers = portainer.get_all_containers()
                    container_data.extend(containers)

        return network_data, container_data
