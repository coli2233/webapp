# pyrefly: ignore [missing-import]
from app.models import RadiacionRequest, RadiacionResponse

class RadiacionService:

    @staticmethod
    def calculate(data: RadiacionRequest) -> RadiacionResponse:
        sigma = 5.67e-8  # Constante de Stefan-Boltzmann (W/m²K⁴)
        epsilon = data.emisividad
        A = data.area

        T_emisor_K = data.temp_emisor + 273.15
        T_receptor_K = data.temp_receptor + 273.15

        h_watts = epsilon * sigma * A * (T_emisor_K**4 - T_receptor_K**4)
        flujo_superficial = epsilon * sigma * (T_emisor_K**4 - T_receptor_K**4)
        q_joules_per_hour = h_watts * 3600

        suggestions = RadiacionService.get_suggestions(h_watts, epsilon, T_emisor_K, T_receptor_K)

        return RadiacionResponse(
            h_watts=round(h_watts, 2),
            flujo_superficial=round(flujo_superficial, 2),
            emisividad=epsilon,
            q_joules_per_hour=round(q_joules_per_hour, 2),
            suggestions=suggestions
        )

    @staticmethod
    def get_suggestions(h_watts: float, epsilon: float, T_emisor_K: float, T_receptor_K: float) -> str:
        if h_watts < 0:
            return "El cuerpo emisor está más frío que el receptor. La radiación térmica fluye en dirección inversa."

        if epsilon < 0.1:
            base = f"Emisividad muy baja ({epsilon}). Material reflector como oro pulido o aluminio. Minimiza pérdidas por radiación."
        elif epsilon < 0.5:
            base = f"Emisividad moderada ({epsilon}). Materiales pintados o superficie mate. Balance entre absorción y emisión."
        elif epsilon < 0.9:
            base = f"Emisividad alta ({epsilon}). Materiales como pintura negra, ladrillo. Buena emisión de calor radiante."
        else:
            base = f"Emisividad muy alta ({epsilon}). Approx. cuerpo negro ideal. Radiación térmica máxima."

        if T_emisor_K > 800:
            return base + " ¡Alta temperatura! La radiación infrarroja es muy significativa."
        elif T_emisor_K > 400:
            return base + " Temperatura moderada-alta. Materiales oscuros absorben más que los claros."
        else:
            return base + " Temperatura baja. La radiación térmica es leve en estas condiciones."