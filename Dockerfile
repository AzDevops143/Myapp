# 1. Use a lightweight Python base image
FROM python:3.9-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Install system dependencies (needed for some NLP libraries)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy only requirements first to leverage Docker cache
# This makes subsequent builds much faster
COPY requirements.txt .

# 5. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of your application code
COPY . .

# 7. Set default environment variables (can be overridden by GitHub Actions)
ENV PYTHONUNBUFFERED=1

# 8. Command to run your script
# Replace 'main.py' with the actual name of your entry script
CMD ["python", "main.py"]