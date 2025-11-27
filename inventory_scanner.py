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


class ProxmoxAPI:
    """Handles Proxmox VE API interactions"""

    def __init__(self, name: str, host: str, api_token_name: str, api_token_value: str, verify_ssl: bool = False):
        self.name = name
        self.host = host
        self.api_token_name = api_token_name
        self.api_token_value = api_token_value
        self.verify_ssl = verify_ssl
        self.proxmox = None

    def connect(self) -> bool:
        """Connect to Proxmox API using API token"""
        try:
            from proxmoxer import ProxmoxAPI as ProxmoxerAPI

            print(f"[*] Connecting to {self.name} at {self.host}...")

            # Parse token name: username@realm!tokenname
            user_realm, token_name = self.api_token_name.rsplit('!', 1)

            self.proxmox = ProxmoxerAPI(
                self.host,
                user=user_realm,
                token_name=token_name,
                token_value=self.api_token_value,
                verify_ssl=self.verify_ssl
            )

            # Test connection by getting version
            version = self.proxmox.version.get()
            print(f"[+] Connected to {self.name} (Proxmox VE {version.get('version', 'unknown')})")
            return True

        except ImportError:
            print("[!] proxmoxer not installed. Install with: pip install proxmoxer")
            return False
        except Exception as e:
            print(f"[!] Error connecting to {self.name}: {e}")
            return False

    def get_nodes(self) -> list[dict]:
        """Get all Proxmox cluster nodes"""
        try:
            nodes = self.proxmox.nodes.get()
            return nodes
        except Exception as e:
            print(f"[!] Error fetching nodes from {self.name}: {e}")
            return []

    def get_vms(self) -> list[dict]:
        """Get all VMs (QEMU) and Containers (LXC) across all nodes"""
        all_vms = []

        try:
            nodes = self.get_nodes()

            for node in nodes:
                node_name = node['node']
                print(f"[*] Fetching VMs from node: {node_name}...")

                # Get QEMU VMs
                try:
                    qemu_vms = self.proxmox.nodes(node_name).qemu.get()
                    for vm in qemu_vms:
                        vm_data = {
                            "node": node_name,
                            "vmid": vm.get("vmid"),
                            "name": vm.get("name"),
                            "status": vm.get("status"),
                            "cpu": vm.get("cpus", 0),
                            "memory": vm.get("maxmem", 0) // (1024 * 1024),  # Convert to MB
                            "type": "qemu",
                            "proxmox_instance": self.name
                        }

                        # Try to get network config for IP addresses
                        try:
                            config = self.proxmox.nodes(node_name).qemu(vm["vmid"]).config.get()
                            vm_data["ip_addresses"] = []
                            vm_data["mac_addresses"] = []

                            # Parse network interfaces
                            for key, value in config.items():
                                if key.startswith('net'):
                                    # Extract MAC address
                                    mac_match = re.search(r'([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})', str(value))
                                    if mac_match:
                                        vm_data["mac_addresses"].append(mac_match.group(0))
                        except Exception:
                            vm_data["ip_addresses"] = []
                            vm_data["mac_addresses"] = []

                        all_vms.append(vm_data)

                except Exception as e:
                    print(f"[!] Error fetching QEMU VMs from {node_name}: {e}")

                # Get LXC containers
                try:
                    lxc_containers = self.proxmox.nodes(node_name).lxc.get()
                    for container in lxc_containers:
                        container_data = {
                            "node": node_name,
                            "vmid": container.get("vmid"),
                            "name": container.get("name"),
                            "status": container.get("status"),
                            "cpu": container.get("cpus", 0),
                            "memory": container.get("maxmem", 0) // (1024 * 1024),  # Convert to MB
                            "type": "lxc",
                            "proxmox_instance": self.name,
                            "ip_addresses": [],
                            "mac_addresses": []
                        }
                        all_vms.append(container_data)

                except Exception as e:
                    print(f"[!] Error fetching LXC containers from {node_name}: {e}")

            print(f"[+] Found {len(all_vms)} total VMs/containers on {self.name}")
            return all_vms

        except Exception as e:
            print(f"[!] Error fetching VMs from {self.name}: {e}")
            return []


class NetworkInventory:
    """Main inventory class that coordinates all scanners"""

    def __init__(self, config: dict):
        self.config = config

    def scan_all(self):
        """Perform complete inventory scan"""
        network_data = {"clients": [], "networks": [], "access_points": [], "scan_results": []}
        container_data = []
        vm_data = []

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

        # Proxmox instances
        if self.config.get("proxmox"):
            for instance in self.config["proxmox"]:
                if instance.get("enabled", True):
                    proxmox = ProxmoxAPI(
                        name=instance["name"],
                        host=instance["host"],
                        api_token_name=instance["api_token_name"],
                        api_token_value=instance["api_token_value"],
                        verify_ssl=instance.get("verify_ssl", False)
                    )
                    if proxmox.connect():
                        vms = proxmox.get_vms()
                        vm_data.extend(vms)

        return network_data, container_data, vm_data
