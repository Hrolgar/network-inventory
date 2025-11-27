# Network Inventory Dashboard

Web dashboard for monitoring UniFi networks, Docker containers across multiple Portainer instances, and Proxmox VMs. Built this for my homelab, figured others might find it useful.

## What It Does

- Shows all devices on your UniFi network with signal strength, IPs, and MACs
- Lists Docker containers across multiple Portainer instances
- Monitors Proxmox VMs and LXC containers
- **Generate network topology diagrams** - Visual hierarchical diagrams showing your entire infrastructure
- Groups everything by network/endpoint in tabs
- Search/sort/filter everything
- Export data (JSON, CSV, XML)
- Dark mode with localStorage
- Auto-refresh with rate limiting so you don't spam your APIs
- Historical data tracking with SQLite
- Real-time WebSocket updates
- Interactive API documentation

Works with UniFi OS (UDM/UDM Pro) and traditional controllers.

## Setup (Docker)

This is the recommended way to run the application.

### Prerequisites

- Docker and Docker Compose
- A `.env` file with your credentials (see `Configuration` below).

### Install

1.  Clone the repository.
2.  Create a `.env` file from the example: `cp .env.example .env`
3.  Add your credentials to the `.env` file.
4.  Build and run the container:
    ```bash
    docker compose up --build -d
    ```
    This command builds both the React frontend and the Python backend into a single, self-contained Docker image.

5.  Open [http://localhost:5000](http://localhost:5000) in your browser.

## Development

If you want to contribute to the development, you'll need to run the backend (Python/Flask) and frontend (React/Bun) servers separately.

### Prerequisites

- Python 3.11+
- [Bun](https://bun.sh/)
- `nmap` installed on your system (`sudo apt install nmap` or equivalent)
- A configured `.env` file in the project root.

### Quick Start

A Makefile is provided for common tasks. Run `make help` to see all commands.

```bash
make install    # Install all dependencies
make test       # Run tests
```

### Backend Setup

The backend is a Python Flask application. It's recommended to run it in a virtual environment.

1.  **Create and activate a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Run the backend server:**
    ```bash
    python3 app.py
    ```
    The backend will be running on [http://localhost:5000](http://localhost:5000).

### Frontend Setup

The frontend is a React application built with TypeScript and Bun.

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    bun install
    ```
3.  **Run the frontend development server:**
    ```bash
    bun start
    ```
    The frontend dev server will be running on [http://localhost:3000](http://localhost:3000) and will proxy API requests to the backend on port 5000. Open this URL in your browser.

### Testing

```bash
# Backend tests
pytest -v
make test-backend

# Frontend tests
cd frontend && bun test
make test-frontend

# All tests
make test
```

**Philosophy:** This project focuses on working code over perfect formatting. Tests must pass, formatting is optional.

## Configuration

Edit the `.env` file in the project root:

```bash
# Scan settings
SCAN_COOLDOWN=300
PORT=5000

# Network scanning
NETWORK_SCAN_ENABLED=true
NETWORK_SUBNET=10.69.1.0/24

# UniFi Controller
UNIFI_ENABLED=true
UNIFI_HOST=10.69.1.1
UNIFI_PORT=443
UNIFI_USERNAME=your_username
UNIFI_PASSWORD=your_password
UNIFI_SITE=default

# Portainer
PORTAINER_ENABLED=true
PORTAINER_NAME=Main Portainer
PORTAINER_URL=https://10.69.1.4:9443
PORTAINER_API_TOKEN=ptr_your_token_here

# Proxmox VE (optional)
PROXMOX_ENABLED=false
PROXMOX_NAME=Main Proxmox
PROXMOX_HOST=10.69.1.10
PROXMOX_API_TOKEN_NAME=root@pam!monitoring
PROXMOX_API_TOKEN_VALUE=your_token_secret_here
PROXMOX_VERIFY_SSL=false

# Optional features
HISTORY_ENABLED=true       # Store scan history in SQLite
LOG_LEVEL=INFO            # Logging level: DEBUG, INFO, WARNING, ERROR
```

**Multiple Portainer/Proxmox instances?** Use `config.yaml` instead of environment variables (see `config.example.yaml` for structure).

**Proxmox API Token Setup:**
1. Log into Proxmox web UI
2. Go to Datacenter → Permissions → API Tokens
3. Click "Add" to create a new token
4. Select user (e.g., `root@pam`), enter token ID (e.g., `monitoring`)
5. Uncheck "Privilege Separation" if you want full access
6. Copy the token secret (shown only once!)
7. Token name format: `username@realm!tokenid` (e.g., `root@pam!monitoring`)

---

## Features

- Network device discovery (nmap)
- UniFi integration (clients, networks, APs, signal strength)
- Multi-instance Portainer support
- **Proxmox VE integration** (QEMU VMs and LXC containers with API token authentication)
- **Network topology diagram generator:**
  - Visual hierarchical diagrams of your entire infrastructure
  - Customizable component selection (containers, VMs, IoT devices, VLANs, APs)
  - Smart grouping for large networks (>50 devices)
  - Save/load diagram templates
  - Export as PNG or SVG
  - Light/dark theme support
  - Shows proper hierarchy: Networks → Docker Hosts → Containers
- Global search across everything
- Sortable tables
- Dark/light theme with database-backed user preferences
- Auto-refresh with configurable cooldown
- Responsive design
- Alerts for stopped containers and poor WiFi signals
- Data export (JSON, CSV, XML)
- Historical data tracking with SQLite
- Interactive time-series charts for trend analysis
- Real-time WebSocket updates
- User settings system (persisted to database)
- Interactive API documentation (Swagger UI at `/api/docs`)
- Structured logging with rotation
- Environment validation on startup

## API

Interactive documentation available at [http://localhost:5000/api/docs](http://localhost:5000/api/docs) when running.

## Troubleshooting

### Can't connect to UniFi

Check the port:
- UDM/UDM Pro/UDR: port 443
- Traditional controller: port 8443

Logs (when running with Docker): `docker-compose logs -f`

### Can't connect to Portainer

Make sure your token is valid. Regenerate if needed.

### No devices found

Check your subnet in `.env` or `config.yaml`. For better network scanning when using Docker, you can try host network mode by uncommenting the `network_mode: host` line in `docker-compose.yml`.

### Container won't start

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f
```

## Contributing

PRs welcome. Keep it simple.

## License

MIT