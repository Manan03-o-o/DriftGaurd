import logging
import sys

def setup_logging():
    log_format = "%(asctime)s | %(levelname)-7s | %(name)s:%(lineno)d - %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
    # Silence noisy loggers if necessary
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

logger = logging.getLogger("driftguard")
