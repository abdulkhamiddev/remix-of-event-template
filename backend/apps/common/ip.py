from __future__ import annotations

import ipaddress
import os
from functools import lru_cache


@lru_cache(maxsize=1)
def _trusted_proxy_nets() -> list[ipaddress._BaseNetwork]:
    """
    Parse TRUSTED_PROXY_NETS from env as comma-separated CIDRs.

    Safe default: empty => do not trust X-Forwarded-For.
    Invalid CIDRs are ignored defensively to avoid crashing on bad config.
    """
    raw = (os.getenv("TRUSTED_PROXY_NETS", "") or "").strip()
    if not raw:
        return []
    nets: list[ipaddress._BaseNetwork] = []
    for part in raw.split(","):
        cidr = part.strip()
        if not cidr:
            continue
        try:
            nets.append(ipaddress.ip_network(cidr, strict=False))
        except ValueError:
            # Misconfiguration should not silently expand trust; ignore bad entries.
            continue
    return nets


def _ip_in_trusted_proxies(remote_addr: str) -> bool:
    nets = _trusted_proxy_nets()
    if not nets:
        return False
    try:
        remote_ip = ipaddress.ip_address(remote_addr)
    except ValueError:
        return False
    return any(remote_ip in net for net in nets)


def request_ip(request) -> str:
    """
    Returns a best-effort client IP with a safe-by-default trust model.

    - Always prefer the actual connecting IP: REMOTE_ADDR.
    - Only if REMOTE_ADDR is within TRUSTED_PROXY_NETS, trust X-Forwarded-For
      and use the left-most valid IP (original client).

    Sanity notes:
    - This intentionally ignores X-Forwarded-For from arbitrary clients to prevent spoofing.
    - If you run behind a reverse proxy, configure TRUSTED_PROXY_NETS to your proxy CIDRs
      (for example: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16" or your LB subnet).
    """
    remote = (request.META.get("REMOTE_ADDR") or "").strip()
    if not remote:
        return "unknown"

    if _ip_in_trusted_proxies(remote):
        xff = (request.META.get("HTTP_X_FORWARDED_FOR") or "").strip()
        if xff:
            for candidate in (part.strip() for part in xff.split(",")):
                if not candidate:
                    continue
                try:
                    ipaddress.ip_address(candidate)
                except ValueError:
                    continue
                return candidate

        # Optional compatibility with some reverse-proxy setups.
        x_real_ip = (request.META.get("HTTP_X_REAL_IP") or "").strip()
        if x_real_ip:
            try:
                ipaddress.ip_address(x_real_ip)
                return x_real_ip
            except ValueError:
                pass

    # Fallback: the connecting peer.
    return remote

