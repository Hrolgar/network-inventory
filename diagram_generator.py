#!/usr/bin/env python3
"""
Network Topology Diagram Generator
Generates hierarchical network topology diagrams using Graphviz
"""

from graphviz import Digraph
from typing import Dict, List, Any, Tuple


# Node icons (Unicode/Emoji)
ICONS = {
    'internet': '🌐',
    'gateway': '🔧',
    'network': '📁',
    'ap': '📡',
    'client_wired': '💻',
    'client_wireless': '📱',
    'container': '🐳',
    'vm': '🖥️',
    'vm_lxc': '📦',
}

# Node styling by type
NODE_STYLES = {
    'internet': {'shape': 'oval', 'fillcolor': '#e3f2fd', 'color': '#2196f3', 'fontcolor': '#0d47a1'},
    'gateway': {'shape': 'box', 'fillcolor': '#fff3e0', 'color': '#ff9800', 'fontcolor': '#e65100'},
    'network': {'shape': 'folder', 'fillcolor': '#f3e5f5', 'color': '#9c27b0', 'fontcolor': '#4a148c'},
    'ap': {'shape': 'box', 'fillcolor': '#e8f5e9', 'color': '#4caf50', 'fontcolor': '#1b5e20'},
    'client': {'shape': 'ellipse', 'fillcolor': '#e0f7fa', 'color': '#00bcd4', 'fontcolor': '#006064'},
    'container': {'shape': 'component', 'fillcolor': '#e1f5fe', 'color': '#03a9f4', 'fontcolor': '#01579b'},
    'vm': {'shape': 'box3d', 'fillcolor': '#fce4ec', 'color': '#e91e63', 'fontcolor': '#880e4f'},
    'group': {'shape': 'box', 'fillcolor': '#f5f5f5', 'color': '#9e9e9e', 'fontcolor': '#424242', 'style': 'rounded,filled,dashed'},
}

# Dark theme overrides
DARK_THEME_STYLES = {
    'internet': {'fillcolor': '#1e3a5f', 'color': '#2196f3', 'fontcolor': '#90caf9'},
    'gateway': {'fillcolor': '#3e2723', 'color': '#ff9800', 'fontcolor': '#ffb74d'},
    'network': {'fillcolor': '#311b92', 'color': '#9c27b0', 'fontcolor': '#ce93d8'},
    'ap': {'fillcolor': '#1b5e20', 'color': '#4caf50', 'fontcolor': '#a5d6a7'},
    'client': {'fillcolor': '#004d40', 'color': '#00bcd4', 'fontcolor': '#80deea'},
    'container': {'fillcolor': '#01579b', 'color': '#03a9f4', 'fontcolor': '#81d4fa'},
    'vm': {'fillcolor': '#4a148c', 'color': '#e91e63', 'fontcolor': '#f48fb1'},
    'group': {'fillcolor': '#2a2a2a', 'color': '#757575', 'fontcolor': '#e0e0e0', 'style': 'rounded,filled,dashed'},
}

# Smart grouping threshold
GROUP_THRESHOLD = 50


class TopologyDiagramGenerator:
    """Generates network topology diagrams using Graphviz"""

    def __init__(self, scan_data: Dict[str, Any], options: Dict[str, Any]):
        """
        Initialize diagram generator

        Args:
            scan_data: Complete scan data from NetworkInventory
            options: User-selected diagram options
        """
        self.scan_data = scan_data
        self.options = options
        self.graph = None
        self.theme = options.get('theme', 'light')
        self.node_styles = DARK_THEME_STYLES if self.theme == 'dark' else NODE_STYLES

        # Endpoint filtering
        self.included_endpoints = options.get('included_endpoints', [])

        # Data extraction
        self.network = scan_data.get('network', {})
        self.containers = scan_data.get('containers', [])
        self.vms = scan_data.get('vms', [])

        # Grouping info
        self.grouped_items = []

    def generate(self, format: str = 'png') -> bytes:
        """
        Generate diagram and return as bytes

        Args:
            format: Output format ('png' or 'svg')

        Returns:
            Binary diagram data
        """
        self._create_graph()
        self._add_nodes()
        self._add_edges()
        return self._render(format)

    def _create_graph(self) -> None:
        """Initialize Graphviz Digraph with styling"""
        bg_color = '#1a1a1a' if self.theme == 'dark' else 'white'
        text_color = '#ffffff' if self.theme == 'dark' else '#000000'

        self.graph = Digraph(
            name='NetworkTopology',
            format='png',
            engine='dot',  # Hierarchical layout
            graph_attr={
                'rankdir': 'TB',  # Top to Bottom
                'splines': 'ortho',  # Orthogonal edges
                'nodesep': '0.6',
                'ranksep': '1.0',
                'bgcolor': bg_color,
                'fontname': 'Arial',
                'fontcolor': text_color,
                'pad': '0.5',
                'labelloc': 't',
                'label': 'Network Topology Diagram',
                'fontsize': '16'
            },
            node_attr={
                'shape': 'box',
                'style': 'rounded,filled',
                'fontname': 'Arial',
                'fontsize': '10',
                'margin': '0.3,0.15'
            },
            edge_attr={
                'fontname': 'Arial',
                'fontsize': '8',
                'color': '#666666' if self.theme == 'light' else '#cccccc'
            }
        )

    def _format_node_label(self, node_type: str, name: str, details: str = '') -> str:
        """Format node label with icon and text"""
        icon = ICONS.get(node_type, '•')
        label = f'{icon} {name}'
        if details:
            label += f'\\n{details}'
        return label

    def _should_include_endpoint(self, endpoint_name: str) -> bool:
        """Check if endpoint should be included based on filter"""
        # If no filter specified, include all
        if not self.included_endpoints:
            return True
        # Otherwise, check if endpoint is in the filter list
        return endpoint_name in self.included_endpoints

    def _apply_smart_grouping(self, items: List[Dict], category: str) -> Tuple[List[Dict], List[Dict]]:
        """
        Apply smart grouping for large collections

        Args:
            items: List of items to potentially group
            category: Category name for grouping

        Returns:
            Tuple of (individual_items, grouped_items)
        """
        if len(items) <= GROUP_THRESHOLD:
            return items, []

        # Group items - return a summary node
        grouped = [{
            'type': 'group',
            'category': category,
            'count': len(items),
            'name': f'{len(items)} {category}'
        }]

        self.grouped_items.append(f"{len(items)} {category} grouped for readability")

        return [], grouped

    def _add_nodes(self) -> None:
        """Add all nodes to the graph"""
        # Internet / Gateway (always show if any network exists)
        if self.network.get('networks') or self.network.get('access_points'):
            self.graph.node(
                'internet',
                label=self._format_node_label('internet', 'Internet'),
                **self.node_styles['internet']
            )

        # Networks (VLANs)
        if self.options.get('include_vlans', True):
            networks = self.network.get('networks', [])
            for network in networks:
                node_id = f"net_{network.get('name', 'unknown').replace(' ', '_')}"
                vlan = network.get('vlan', '?')
                subnet = network.get('ip_subnet', '')
                label = self._format_node_label(
                    'network',
                    network.get('name', 'Unknown'),
                    f'VLAN {vlan}\\n{subnet}'
                )
                self.graph.node(node_id, label=label, **self.node_styles['network'])

        # Access Points
        if self.options.get('include_aps', True):
            aps = self.network.get('access_points', [])
            for idx, ap in enumerate(aps):
                node_id = f"ap_{idx}"
                clients = ap.get('num_sta', 0)
                label = self._format_node_label(
                    'ap',
                    ap.get('name', 'Access Point'),
                    f"{ap.get('model', 'Unknown')}\\n{clients} clients"
                )
                self.graph.node(node_id, label=label, **self.node_styles['ap'])

        # Network Clients (IoT devices)
        if self.options.get('include_iot_devices', True):
            clients = self.network.get('clients', [])
            individual_clients, grouped_clients = self._apply_smart_grouping(clients, 'Network Devices')

            # Add individual clients
            for idx, client in enumerate(individual_clients):
                node_id = f"client_{idx}"
                is_wired = client.get('is_wired', False)
                client_type = 'client_wired' if is_wired else 'client_wireless'
                hostname = client.get('hostname') or client.get('ip', 'Unknown')
                network_name = client.get('network', '')

                details = f"{client.get('ip', '')}"
                if not is_wired:
                    rssi = client.get('rssi')
                    if rssi:
                        details += f"\\nSignal: {rssi} dBm"

                label = self._format_node_label(client_type, hostname, details)
                self.graph.node(node_id, label=label, **self.node_styles['client'])

            # Add grouped clients
            for group in grouped_clients:
                node_id = f"client_group"
                label = self._format_node_label('network', group['name'])
                self.graph.node(node_id, label=label, **self.node_styles['group'])

        # Docker Containers - Group by Portainer endpoint
        if self.options.get('include_containers', True):
            # Group containers by endpoint
            endpoints_map = {}
            for container in self.containers:
                portainer_instance = container.get('portainer_instance', 'Unknown')
                endpoint_name = container.get('endpoint_name', 'Unknown')
                endpoint_key = f"{portainer_instance}:{endpoint_name}"

                if endpoint_key not in endpoints_map:
                    endpoints_map[endpoint_key] = {
                        'portainer_instance': portainer_instance,
                        'endpoint_name': endpoint_name,
                        'containers': []
                    }
                endpoints_map[endpoint_key]['containers'].append(container)

            # Create endpoint nodes and their containers
            for endpoint_key, endpoint_data in endpoints_map.items():
                endpoint_id = endpoint_key.replace(':', '_').replace(' ', '_')
                portainer = endpoint_data['portainer_instance']
                endpoint = endpoint_data['endpoint_name']
                containers = endpoint_data['containers']

                # Apply endpoint filter
                if not self._should_include_endpoint(endpoint):
                    continue

                # Count running vs stopped
                running = sum(1 for c in containers if c.get('State') == 'running')

                # Create endpoint node (represents the VM/host)
                endpoint_label = self._format_node_label(
                    'vm',
                    f"{endpoint}",
                    f"Portainer: {portainer}\\n{running}/{len(containers)} running"
                )
                self.graph.node(f"endpoint_{endpoint_id}", label=endpoint_label, **self.node_styles['vm'])

                # Add containers under this endpoint (with smart grouping per endpoint)
                individual_containers, grouped_containers = self._apply_smart_grouping(containers, f'{endpoint} containers')

                # Add individual containers
                for idx, container in enumerate(individual_containers):
                    node_id = f"container_{endpoint_id}_{idx}"
                    name = container.get('Names', ['Unknown'])[0].lstrip('/')
                    image = container.get('Image', 'Unknown')
                    status = container.get('State', 'unknown')

                    # Truncate long image names
                    if len(image) > 30:
                        image = image[:27] + '...'

                    details = f"{image}\\n{status}"
                    label = self._format_node_label('container', name, details)
                    self.graph.node(node_id, label=label, **self.node_styles['container'])

                # Add grouped containers for this endpoint
                if grouped_containers:
                    group_id = f"container_group_{endpoint_id}"
                    label = self._format_node_label('container', grouped_containers[0]['name'])
                    self.graph.node(group_id, label=label, **self.node_styles['group'])

        # Proxmox VMs
        if self.options.get('include_vms', True):
            individual_vms, grouped_vms = self._apply_smart_grouping(self.vms, 'VMs')

            # Add individual VMs
            for idx, vm in enumerate(individual_vms):
                node_id = f"vm_{idx}"
                name = vm.get('name', 'Unknown VM')
                node = vm.get('node', 'unknown')
                status = vm.get('status', 'unknown')
                vm_type = vm.get('type', 'qemu')

                icon_type = 'vm' if vm_type == 'qemu' else 'vm_lxc'
                details = f"Node: {node}\\nStatus: {status}"
                label = self._format_node_label(icon_type, name, details)
                self.graph.node(node_id, label=label, **self.node_styles['vm'])

            # Add grouped VMs
            for group in grouped_vms:
                node_id = f"vm_group"
                label = self._format_node_label('vm', group['name'])
                self.graph.node(node_id, label=label, **self.node_styles['group'])

    def _add_edges(self) -> None:
        """Add edges (connections) between nodes"""
        # Simple hierarchical connections
        # Internet -> Networks
        if self.options.get('include_vlans', True):
            networks = self.network.get('networks', [])
            for network in networks:
                node_id = f"net_{network.get('name', 'unknown').replace(' ', '_')}"
                if self.graph.body:  # Check if internet node exists
                    self.graph.edge('internet', node_id)

        # Networks -> Access Points
        if self.options.get('include_aps', True) and self.options.get('include_vlans', True):
            aps = self.network.get('access_points', [])
            networks = self.network.get('networks', [])
            if networks and aps:
                # Connect APs to first network (simplified)
                first_network = f"net_{networks[0].get('name', 'unknown').replace(' ', '_')}"
                for idx, ap in enumerate(aps):
                    ap_id = f"ap_{idx}"
                    self.graph.edge(first_network, ap_id)

        # Connect Endpoints (VMs/hosts) to network and containers to endpoints
        if self.options.get('include_containers', True) and self.options.get('include_vlans', True):
            networks = self.network.get('networks', [])
            if networks and self.containers:
                first_network = f"net_{networks[0].get('name', 'unknown').replace(' ', '_')}"

                # Group containers by endpoint to get the structure
                endpoints_map = {}
                for container in self.containers:
                    portainer_instance = container.get('portainer_instance', 'Unknown')
                    endpoint_name = container.get('endpoint_name', 'Unknown')
                    endpoint_key = f"{portainer_instance}:{endpoint_name}"

                    if endpoint_key not in endpoints_map:
                        endpoints_map[endpoint_key] = {
                            'containers': []
                        }
                    endpoints_map[endpoint_key]['containers'].append(container)

                # Connect each endpoint to network
                for endpoint_key, endpoint_data in endpoints_map.items():
                    endpoint_id = endpoint_key.replace(':', '_').replace(' ', '_')
                    containers = endpoint_data['containers']

                    # Extract endpoint name for filtering
                    endpoint_name = endpoint_key.split(':')[1] if ':' in endpoint_key else endpoint_key

                    # Apply endpoint filter
                    if not self._should_include_endpoint(endpoint_name):
                        continue

                    # Network -> Endpoint (VM/host)
                    self.graph.edge(first_network, f"endpoint_{endpoint_id}")

                    # Endpoint -> Containers
                    individual_containers, grouped_containers = self._apply_smart_grouping(containers, f'{endpoint_key} containers')

                    if individual_containers:
                        for idx in range(len(individual_containers)):
                            self.graph.edge(f"endpoint_{endpoint_id}", f"container_{endpoint_id}_{idx}")

                    if grouped_containers:
                        self.graph.edge(f"endpoint_{endpoint_id}", f"container_group_{endpoint_id}")

        # Connect VMs to networks (simplified - connect to first network)
        if self.options.get('include_vms', True) and self.options.get('include_vlans', True):
            networks = self.network.get('networks', [])
            if networks and self.vms:
                first_network = f"net_{networks[0].get('name', 'unknown').replace(' ', '_')}"

                # Check if we have individual VMs or grouped
                individual_vms, grouped_vms = self._apply_smart_grouping(self.vms, 'VMs')

                if individual_vms:
                    for idx in range(len(individual_vms)):
                        self.graph.edge(first_network, f"vm_{idx}")

                if grouped_vms:
                    self.graph.edge(first_network, "vm_group")

        # Simple note about grouped items
        if self.grouped_items:
            # Add a note node about grouping
            note = "ℹ️ Large network:\\n" + "\\n".join(self.grouped_items)
            self.graph.node('grouping_note', label=note, shape='note',
                          fillcolor='#fffde7' if self.theme == 'light' else '#3e3e3e',
                          color='#fbc02d' if self.theme == 'light' else '#fdd835')

    def _render(self, format: str) -> bytes:
        """
        Render the graph to the specified format

        Args:
            format: 'png' or 'svg'

        Returns:
            Binary diagram data
        """
        self.graph.format = format

        try:
            # Render to bytes
            diagram_bytes = self.graph.pipe(format=format)
            return diagram_bytes
        except Exception as e:
            raise RuntimeError(f"Failed to render diagram: {e}")

    def get_grouping_info(self) -> List[str]:
        """Get information about grouped items (for UI display)"""
        return self.grouped_items
