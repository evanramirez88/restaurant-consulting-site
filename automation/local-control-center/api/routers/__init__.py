"""
Phase 3 API Routers

- automation: Job queue management and real-time status
- intelligence: Decision engine and client health scoring
- toast: Toast POS integration management
"""

from . import automation
from . import intelligence
from . import toast

__all__ = ["automation", "intelligence", "toast"]
