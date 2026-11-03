FROM python:3.13-slim@sha256:7c61056e61ac89e852de05f3dc6fa51a6dd2181797bceed46aa725dd7cb2cd3b

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --disable-pip-version-check --requirement requirements.txt \
    && addgroup --system --gid 10001 app \
    && adduser --system --uid 10001 --ingroup app app

ENV HOME=/home/app
RUN install -d -o app -g app "$HOME"

COPY --chown=app:app app ./app

USER app
RUN test -w "$HOME"
EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WEB_CONCURRENCY:-2} --proxy-headers --forwarded-allow-ips=*"]
