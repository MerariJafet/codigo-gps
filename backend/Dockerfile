FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code to /app/backend to match python package structure expected by imports
COPY . backend/

# Run from /app so "backend.main" is resolvable
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
