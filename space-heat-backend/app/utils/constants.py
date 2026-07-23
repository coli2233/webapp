# Datos de los materiales (k en W/mK, densidad en kg/m3, calor_especifico en J/kgK)
# Datos aproximados para fines de simulación

MATERIALES = {
    "carton": {
        "id": "carton",
        "name": "Cartón Corrugado",
        "k_value": 0.05,
        "density": 100,
        "specific_heat": 1300,
        "description": "Material económico, pero con bajo aislamiento térmico para bajas temperaturas extremas.",
        "image_url": "https://img.freepik.com/foto-gratis/textura-carton_1194-6761.jpg"
    },
    "aluminio": {
        "id": "aluminio",
        "name": "Panel de Aluminio",
        "k_value": 205.0,
        "density": 2700,
        "specific_heat": 900,
        "description": "Excelente conductor de calor. Pésimo aislante, permitirá que el calor se escape rápidamente.",
        "image_url": "https://img.freepik.com/foto-gratis/textura-metal_1194-5264.jpg"
    },
    "tecnopor": {
        "id": "tecnopor",
        "name": "Tecnopor (Poliestireno)",
        "k_value": 0.03,
        "density": 20,
        "specific_heat": 1300,
        "description": "Excelente aislante térmico. Atrapa el aire en su estructura, reduciendo la transferencia de calor.",
        "image_url": "https://img.freepik.com/foto-gratis/textura-blanca-poliestireno-expandido_1194-7389.jpg"
    }
}
