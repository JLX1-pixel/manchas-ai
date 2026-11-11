FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/index.html frontend/vite.config.js ./
COPY frontend/src ./src
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --system --create-home manchas
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini .
COPY --from=frontend /build/dist ./frontend
USER manchas
EXPOSE 10000
CMD ["python", "-m", "app.render_start"]
