# pyrefly: ignore [missing-import]
from fastapi import HTTPException
from app.models import ConveccionRequest, ConveccionResponse, ConvectionType

class ConveccionService:

    @staticmethod
    def calculate(data: ConveccionRequest) -> ConveccionResponse:
        T_s = data.temp_superficie
        T_f = data.temp_fluido
        A = data.area

        # Coeficiente de convección h (W/m²K)
        # Convección natural: correlación empírica para placa horizontal/vertical
        # h = 5 + 3.8 * ΔT^0.25 (aproximación para aire natural)
        # Convección forzada: depende de la velocidad del fluido
        # h = 10 + 5 * v (aproximación para aire forzado)

        if data.tipo == ConvectionType.NATURAL:
            delta_t = abs(T_s - T_f)
            if delta_t < 0.1:
                h = 5.0  # Sin transferencia significativa
            else:
                # Correlación para convección natural en aire (placa vertical)
                # Nu = 0.59 * Ra_L^0.25 (para 10^4 < Ra < 10^9)
                # h = Nu * k_aire / L (tomamos L=1m como característica)
                k_aire = 0.026  # W/mK conductividad del aire
                beta = 1 / (273 + (T_s + T_f) / 2)  # 1/K coeficiente de expansión
                nu = 15.89e-6  # m²/s viscosidad cinemática del aire
                alpha = 22.5e-6  # m²/s difusividad térmica
                g = 9.81  # m/s²
                L = 1.0  # m longitud característica

                Ra = (g * beta * delta_t * L**3) / (nu * alpha)
                if Ra < 1e4:
                    Nu = 0.5 * Ra**0.25
                elif Ra < 1e9:
                    Nu = 0.59 * Ra**0.25
                else:
                    Nu = 0.1 * Ra**(1/3)

                h = Nu * k_aire / L
                h = max(2, min(h, 100))  # Limitar a rango físico

        else:  # FORZADA
            v = data.velocidad_flujo if data.velocidad_fluido > 0 else 5.0
            # Correlación para flujo forzado sobre placa plana
            # Nu = 0.664 * Re^0.5 * Pr^0.33 (régimen laminar)
            # h = 10 + 5 * v (aproximación simple para aire a 25°C)
            h = 10 + 5 * v
            h = max(10, min(h, 500))

        # Q = h * A * ΔT
        delta_t = T_s - T_f
        h_watts = h * A * delta_t
        q_joules_per_hour = h_watts * 3600

        suggestions = ConveccionService.get_suggestions(h, data.tipo, delta_t, T_s, T_f)

        return ConveccionResponse(
            h_watts=round(h_watts, 2),
            coeficiente_h=round(h, 2),
            tipo=data.tipo,
            q_joules_per_hour=round(q_joules_per_hour, 2),
            suggestions=suggestions
        )

    @staticmethod
    def get_suggestions(h: float, tipo: ConvectionType, delta_t: float, T_s: float, T_f: float) -> str:
        if abs(delta_t) < 0.5:
            return "No hay transferencia de calor significativa: las temperaturas son casi iguales."

        if tipo == ConvectionType.NATURAL:
            if h < 10:
                return "Convección natural débil. El aire se mueve lentamente. Ideal para espacios cerrados sin ventilación."
            elif h < 30:
                return "Convección natural moderada. Flujo térmico comfortable para aislamiento natural."
            else:
                return "Convección natural intensa. Gran diferencia de temperatura entre superficie y ambiente."
        else:  # FORZADA
            if h < 50:
                return "Convección forzada suave. Suitable para calentamiento/ventilación con bajo consumo de energía."
            elif h < 200:
                return "Convección forzada moderada. Común en sistemas de calefacción por aire forzado."
            else:
                return f"Convección forzada intensa (h={h:.0f} W/m²K). Usado en secadores industriales, turbinas de gas."