# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List
import os

from app.models import (
    HeatCalculationRequest, HeatCalculationResponse, Material,
    ConveccionRequest, ConveccionResponse,
    RadiacionRequest, RadiacionResponse
)
from app.services.calor_service import CalorService
from app.services.conveccion_service import ConveccionService
from app.services.radiacion_service import RadiacionService
from app.utils.constants import MATERIALES

app = FastAPI(
    title="Simulador de Transferencia de Calor API",
    description="API para calcular la transferencia de calor: Conducción, Convección y Radiación",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
has_static = os.path.exists(static_dir)

# ── API endpoints bajo /api ──
@app.get("/api")
def read_root():
    return {"message": "Bienvenido al Simulador de Transferencia de Calor API v2.0"}

@app.get("/api/materiales", response_model=List[Material])
def get_materiales():
    return [Material(**mat_data) for mat_data in MATERIALES.values()]

@app.post("/api/calcular-conduccion", response_model=HeatCalculationResponse)
def calcular_conduccion(request: HeatCalculationRequest):
    return CalorService.calculate_heat_loss(request)

@app.post("/api/calcular-conveccion", response_model=ConveccionResponse)
def calcular_conveccion(request: ConveccionRequest):
    return ConveccionService.calculate(request)

@app.post("/api/calcular-radiacion", response_model=RadiacionResponse)
def calcular_radiacion(request: RadiacionRequest):
    return RadiacionService.calculate(request)

@app.get("/api/info")
def get_info():
    return {
        "endpoints": {
            "GET /api/materiales": "Lista de materiales disponibles",
            "POST /api/calcular-conduccion": "Cálculo de conducción (Ley de Fourier)",
            "POST /api/calcular-conveccion": "Cálculo de convección (Ley de Newton)",
            "POST /api/calcular-radiacion": "Cálculo de radiación (Ley de Stefan-Boltzmann)"
        },
        "mecanismos": [
            {"id": "conduccion", "nombre": "Conducción", "ley": "Ley de Fourier", "formula": "Q = k·A·ΔT / L"},
            {"id": "conveccion", "nombre": "Convección", "ley": "Ley de Newton del enfriamiento", "formula": "Q = h·A·ΔT"},
            {"id": "radiacion", "nombre": "Radiación", "ley": "Ley de Stefan-Boltzmann", "formula": "Q = ε·σ·A·(T₁⁴ - T₂⁴)"}
        ]
    }

# ── Servir Frontend Estático (React build) ──
if has_static:
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    # favicon y otros recursos públicos
    public_dir = os.path.join(static_dir, "..", "transferencia-de-calor-frontend", "public")
    if os.path.exists(public_dir):
        app.mount("/", StaticFiles(directory=public_dir, html=False), name="public")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return FileResponse(index_path)
