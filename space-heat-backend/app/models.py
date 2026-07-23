# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum

class Material(BaseModel):
    id: str
    name: str
    k_value: float
    density: float
    specific_heat: float
    description: str
    image_url: str

class ConvectionType(str, Enum):
    NATURAL = "natural"
    FORCED = "forced"

# ========== CONDUCCIÓN ==========
class HeatCalculationRequest(BaseModel):
    material_id: str = Field(..., description="ID del material (carton, aluminio, tecnopor)")
    temp_in: float = Field(..., description="Temperatura interior en °C")
    temp_out: float = Field(..., description="Temperatura exterior en °C")
    thickness: float = Field(..., description="Espesor de la pared en metros")
    area: Optional[float] = Field(10.0, description="Área de la pared en metros cuadrados")

# ========== CONVECCIÓN ==========
class ConveccionRequest(BaseModel):
    temp_superficie: float = Field(..., description="Temperatura de la superficie en °C")
    temp_fluido: float = Field(..., description="Temperatura del fluido ambiente en °C")
    tipo: ConvectionType = Field(..., description="Tipo de convección: natural o forzada")
    area: Optional[float] = Field(1.0, description="Área de la superficie en m²")
    velocidad_fluido: Optional[float] = Field(0.0, description="Velocidad del fluido en m/s (solo forzada)")

# ========== RADIACIÓN ==========
class RadiacionRequest(BaseModel):
    temp_emisor: float = Field(..., description="Temperatura del cuerpo emisor en °C")
    temp_receptor: float = Field(..., description="Temperatura del cuerpo receptor en °C")
    area: Optional[float] = Field(1.0, description="Área de la superficie radiante en m²")
    emisividad: float = Field(..., ge=0.0, le=1.0, description="Emisividad del material (0-1)")

# ========== CONDUCCIÓN RESPONSE ==========
class HeatCalculationResponse(BaseModel):
    h_watts: float = Field(..., description="Rapidez de transferencia de calor en Watts (J/s)")
    q_joules_per_hour: float = Field(..., description="Calor transferido en una hora (Joules)")
    thermal_resistance: float = Field(..., description="Resistencia térmica del material (K/W)")
    efficiency_score: float = Field(..., description="Puntuación de eficiencia del 0 al 100")
    suggestions: str = Field(..., description="Sugerencia o retroalimentación sobre la eficiencia")
    material: Material

# ========== CONVECCIÓN RESPONSE ==========
class ConveccionResponse(BaseModel):
    h_watts: float = Field(..., description="Rapidez de transferencia de calor en Watts")
    coeficiente_h: float = Field(..., description="Coeficiente de transferencia por convección (W/m²K)")
    tipo: ConvectionType
    q_joules_per_hour: float
    suggestions: str

# ========== RADIACIÓN RESPONSE ==========
class RadiacionResponse(BaseModel):
    h_watts: float = Field(..., description="Rapidez de transferencia de calor por radiación en Watts")
    flujo_superficial: float = Field(..., description="Flujo de calor por unidad de área (W/m²)")
    emisividad: float
    q_joules_per_hour: float
    suggestions: str