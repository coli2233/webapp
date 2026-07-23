#!/bin/bash
set -e
cd /home/site/wwwroot
export PORT=${PORT:-8000}
python -m pip install --disable-pip-version-check --upgrade pip
python -m pip install --disable-pip-version-check -r requirements.txt
python -m gunicorn --bind 0.0.0.0:${PORT} --timeout 600 --worker-class uvicorn.workers.UvicornWorker app.main:app
