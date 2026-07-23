import importlib.util
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
sys.path.insert(0, ROOT)


def install_requirements():
    requirements_path = os.path.join(ROOT, "requirements.txt")
    if os.path.exists(requirements_path):
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--disable-pip-version-check", "-r", requirements_path]
        )


def ensure_dependencies():
    required_modules = ["uvicorn", "fastapi", "pydantic"]
    missing = [name for name in required_modules if importlib.util.find_spec(name) is None]
    if missing:
        install_requirements()


ensure_dependencies()
import uvicorn


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), reload=False)
