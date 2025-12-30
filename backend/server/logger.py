import logging
import json
import os
from pathlib import Path
from datetime import datetime

# Log Directory
LOG_DIR = Path.home() / ".codigo_gps" / "logs"
LOG_FILE = LOG_DIR / "server.log"

def setup_logger():
    if not LOG_DIR.exists():
        LOG_DIR.mkdir(parents=True)
        # Secure log dir
        os.chmod(LOG_DIR, 0o700)

    logger = logging.getLogger("codigo_gps")
    logger.setLevel(logging.INFO)
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger

    # JSON Formatter
    class JsonFormatter(logging.Formatter):
        def format(self, record):
            log_record = {
                "timestamp": datetime.fromtimestamp(record.created).isoformat(),
                "level": record.levelname,
                "message": record.getMessage(),
                "module": record.module,
                "func": record.funcName
            }
            # Add extra fields if present
            if hasattr(record, "extra_data"):
                log_record.update(record.extra_data)
                
            return json.dumps(log_record)

    # File Handler
    file_handler = logging.FileHandler(LOG_FILE)
    file_handler.setFormatter(JsonFormatter())
    logger.addHandler(file_handler)
    
    # Console Handler (Human readable for dev)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logger.addHandler(console_handler)

    return logger

logger = setup_logger()
