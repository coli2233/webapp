# Space Heat Backend

API RESTful construida con FastAPI para el Simulador Interactivo de Transferencia de Calor.

## Requisitos
- Python 3.9+

## Instalación

1. Crear un entorno virtual (opcional pero recomendado):
```bash
python -m venv venv
# Activar entorno (Windows)
venv\Scripts\activate
# Activar entorno (Linux/Mac)
source venv/bin/activate
```

2. Instalar dependencias:
```bash
pip install -r requirements.txt
```

## Ejecución

Para iniciar el servidor de desarrollo en `http://localhost:8000`:
```bash
uvicorn app.main:app --reload
```

## Endpoints Principales
- `GET /materiales`: Obtiene los datos de conductividad térmica de los materiales (Cartón, Aluminio, Tecnopor).
- `POST /calcular-perdida`: Recibe parámetros físicos (temperaturas, espesor, área, material) y devuelve el cálculo de Fourier.
- `GET /docs`: Interfaz Swagger UI para probar la API.
