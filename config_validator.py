"""Configuration validation module"""

import logging
import os
import sys

from pydantic import BaseModel, Field, ValidationError, field_validator


logger = logging.getLogger(__name__)


class NetworkScanConfig(BaseModel):
    """Network scan configuration"""

    enabled: bool = True
    subnet: str = Field(..., pattern=r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$")


class UniFiConfig(BaseModel):
    """UniFi controller configuration"""

    enabled: bool = True
    host: str
    port: int = Field(default=443, ge=1, le=65535)
    username: str
    password: str
    site: str = "default"

    @field_validator("host")
    @classmethod
    def validate_host(cls, v: str) -> str:
        if not v or v.strip() == "":
            raise ValueError("UniFi host cannot be empty")
        return v


class PortainerInstanceConfig(BaseModel):
    """Single Portainer instance configuration"""

    name: str
    enabled: bool = True
    url: str
    api_token: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("Portainer URL must start with http:// or https://")
        return v


class AppConfig(BaseModel):
    """Complete application configuration"""

    network_scan: NetworkScanConfig | None = None
    unifi: UniFiConfig | None = None
    portainer: list[PortainerInstanceConfig] | None = None


def validate_config(config: dict) -> AppConfig:
    """
    Validate configuration dictionary against schema

    Args:
        config: Configuration dictionary

    Returns:
        Validated AppConfig object

    Raises:
        ValidationError: If configuration is invalid
    """
    try:
        return AppConfig(**config)
    except ValidationError as e:
        logger.error(f"Configuration validation failed: {e}")
        raise


def validate_environment() -> list[str]:
    """
    Validate required environment variables are set

    Returns:
        List of validation warnings (not fatal errors)
    """
    warnings = []

    # Check if at least one data source is enabled
    network_enabled = os.getenv("NETWORK_SCAN_ENABLED", "true").lower() == "true"
    unifi_enabled = os.getenv("UNIFI_ENABLED", "true").lower() == "true"
    portainer_enabled = os.getenv("PORTAINER_ENABLED", "true").lower() == "true"

    if not any([network_enabled, unifi_enabled, portainer_enabled]):
        warnings.append("WARNING: All data sources are disabled. Enable at least one.")

    # Check UniFi credentials if enabled
    if unifi_enabled:
        if not os.getenv("UNIFI_HOST"):
            warnings.append("ERROR: UNIFI_HOST is required when UniFi is enabled")
        if not os.getenv("UNIFI_USERNAME"):
            warnings.append("ERROR: UNIFI_USERNAME is required when UniFi is enabled")
        if not os.getenv("UNIFI_PASSWORD"):
            warnings.append("ERROR: UNIFI_PASSWORD is required when UniFi is enabled")

    # Check Portainer credentials if enabled
    if portainer_enabled:
        if not os.getenv("PORTAINER_URL"):
            warnings.append("ERROR: PORTAINER_URL is required when Portainer is enabled")
        if not os.getenv("PORTAINER_API_TOKEN"):
            warnings.append("ERROR: PORTAINER_API_TOKEN is required when Portainer is enabled")

    # Check network subnet if network scan enabled
    if network_enabled:
        subnet = os.getenv("NETWORK_SUBNET")
        if not subnet:
            warnings.append("WARNING: NETWORK_SUBNET not set, using default: 10.69.1.0/24")

    return warnings


def check_fatal_errors(warnings: list[str]) -> bool:
    """
    Check if any warnings are fatal errors

    Args:
        warnings: List of validation warnings

    Returns:
        True if fatal errors exist
    """
    return any(w.startswith("ERROR:") for w in warnings)


if __name__ == "__main__":
    # Test validation
    warnings = validate_environment()
    for warning in warnings:
        print(warning)

    if check_fatal_errors(warnings):
        print("\n❌ Fatal configuration errors detected!")
        sys.exit(1)
    else:
        print("\n✅ Configuration validation passed")
