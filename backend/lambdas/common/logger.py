"""Logger that does not double-attach handlers across Lambda warm starts."""

from __future__ import annotations

import logging
import os
import sys

_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def get_logger(name: str) -> logging.Logger:
    log = logging.getLogger(name)
    if log.handlers:
        return log
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT))
    log.addHandler(handler)
    log.setLevel(getattr(logging, os.environ.get("LOG_LEVEL", "INFO"), logging.INFO))
    log.propagate = False
    return log
