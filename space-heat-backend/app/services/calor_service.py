from app.models import HeatCalculationRequest, HeatCalculationResponse, Material
from app.utils.constants import MATERIALES
# pyrefly: ignore [missing-import]
from fastapi import HTTPException

class CalorService:
    @staticmethod
    def calculate_heat_loss(data: HeatCalculationRequest) -> HeatCalculationResponse:
        material_data = MATERIALES.get(data.material_id)
        if not material_data:
            raise HTTPException(status_code=404, detail="Material no encontrado")
            
        material = Material(**material_data)
        
        # Diferencia de temperatura (delta T)
        delta_t = data.temp_in - data.temp_out
        
        # 1. Conducción Térmica (Ley de Fourier)
        # H = (k * A * (Ti - Tf)) / L
        # Donde: H en Watts (J/s)
        h_watts = (material.k_value * data.area * delta_t) / data.thickness
        
        # 2. Calor transferido en 1 hora (Q = H * tiempo)
        # 1 hora = 3600 segundos
        q_joules_per_hour = h_watts * 3600
        
        # Resistencia térmica de la pared (R = L / (k * A))
        thermal_resistance = data.thickness / (material.k_value * data.area)
        
        # Evaluación de Eficiencia (Arbitraria para fines de la simulación)
        # Mientras mayor sea k, peor es el aislante (menos eficiencia).
        # Un buen aislante como el Tecnopor (k=0.03) debería tener cerca de 100% de eficiencia.
        # k_max en nuestro set es Aluminio (~205)
        
        # Escala logarítmica para la puntuación, porque k varía drásticamente
        import math
        k_min = 0.03 # Tecnopor
        k_max = 205.0 # Aluminio
        
        if material.k_value <= k_min:
            score = 100.0
        elif material.k_value >= k_max:
            score = 0.0
        else:
            # Puntuación inversa logarítmica
            score = 100.0 * (1 - (math.log(material.k_value) - math.log(k_min)) / (math.log(k_max) - math.log(k_min)))
            
        score = max(0.0, min(100.0, score))
        
        suggestions = CalorService.get_suggestions(score, h_watts, delta_t)
        
        return HeatCalculationResponse(
            h_watts=round(h_watts, 2),
            q_joules_per_hour=round(q_joules_per_hour, 2),
            thermal_resistance=round(thermal_resistance, 4),
            efficiency_score=round(score, 1),
            suggestions=suggestions,
            material=material
        )
        
    @staticmethod
    def get_suggestions(score: float, h_watts: float, delta_t: float) -> str:
        if delta_t <= 0:
            return "La temperatura exterior es mayor o igual a la interior. No hay pérdida de calor hacia el exterior."
            
        if score > 80:
            return "Excelente aislamiento térmico. La pérdida de energía es mínima, ideal para climas fríos como Arequipa en invierno."
        elif score > 40:
            return "Aislamiento regular. Considera usar un material con menor conductividad térmica (k) para reducir la factura de calefacción."
        else:
            return f"¡Alerta! Pérdida masiva de calor ({round(h_watts, 2)} W). Este material transfiere el calor rápidamente al exterior. No recomendado como aislante."
