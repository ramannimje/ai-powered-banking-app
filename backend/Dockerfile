FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run migrations + uvicorn
CMD ["sh", "-c", "alembic upgrade head && uvicorn core.main:app --host 0.0.0.0 --port 8000 --reload"]