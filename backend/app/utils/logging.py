import logging
import sys
import structlog

def configure_logging():
    """
    Configure structlog and standard logging for JSON output, contextvars, and Flask integration.
    Should be called once at app startup.
    """
    # Standard logging: output to stdout, no reformatting (structlog handles JSON)
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

    # structlog processors for JSON output and contextvars
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

def get_logger(name=None):
    """
    Get a structlog logger, optionally with a name.
    """
    if name:
        return structlog.get_logger(name)
    return structlog.get_logger()