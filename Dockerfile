# Use a lightweight Python base
FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
# We add pkg-config and build-essential because sentencepiece 
# sometimes needs to compile during installation
RUN apt-get update && apt-get install -y pkg-config build-essential && \
    pip install --no-cache-dir -r requirements.txt

# Install Python requirements
# We copy this first to cache the heavy downloads (like torch)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# This is the standard 'root' copy
COPY requirements.txt /app/requirements.txt
# Copy your source code
COPY . .

# Run your script (ensure your script is named main.py)
CMD ["python", "main.py"]
