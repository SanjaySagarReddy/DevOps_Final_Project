FROM python:3.13-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m pip uninstall -y pip \
    && addgroup -S -g 10001 app \
    && adduser -S -D -H -u 10001 -G app app

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini

USER 10001:10001
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
