import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:8000';

// ─────────────────────────────────────────────
//  TESTS: API - Raíz y materiales
// ─────────────────────────────────────────────
test.describe('API Backend - Endpoints básicos', () => {
  test('GET / debe responder con mensaje de bienvenida', async ({ request }) => {
    const response = await request.get(`${API_URL}/`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('message');
    expect(body.message).toMatch(/bienvenido|simulador|calor/i);
  });

  test('GET /materiales debe retornar lista de materiales', async ({ request }) => {
    const response = await request.get(`${API_URL}/materiales`);
    expect(response.status()).toBe(200);
    const materiales = await response.json();
    expect(Array.isArray(materiales)).toBe(true);
    expect(materiales.length).toBeGreaterThan(0);
    // Verificar estructura de cada material
    for (const mat of materiales) {
      expect(mat).toHaveProperty('id');
      expect(mat).toHaveProperty('name');
      expect(mat).toHaveProperty('k_value');
    }
  });

  test('GET /info debe retornar descripción de endpoints', async ({ request }) => {
    const response = await request.get(`${API_URL}/info`);
    expect(response.status()).toBe(200);
    const info = await response.json();
    expect(info).toHaveProperty('endpoints');
    expect(info).toHaveProperty('mecanismos');
    expect(info.mecanismos.length).toBe(3);
  });
});

// ─────────────────────────────────────────────
//  TESTS: API - Conducción (Ley de Fourier)
// ─────────────────────────────────────────────
test.describe('API Backend - Conducción de Calor', () => {
  test('POST /calcular-conduccion con datos válidos', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-conduccion`, {
      data: {
        material_id: 'aluminio',
        temp_in: 100,
        temp_out: 25,
        thickness: 0.01,
        area: 1.0,
      },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result).toHaveProperty('h_watts');
    expect(result).toHaveProperty('q_joules_per_hour');
    expect(result).toHaveProperty('thermal_resistance');
    expect(result).toHaveProperty('efficiency_score');
    expect(result).toHaveProperty('suggestions');
    expect(result).toHaveProperty('material');
    expect(typeof result.h_watts).toBe('number');
    expect(result.h_watts).toBeGreaterThan(0);
  });

  test('POST /calcular-conduccion calcula correctamente con temperatura igual', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-conduccion`, {
      data: {
        material_id: 'aluminio',
        temp_in: 25,
        temp_out: 25,
        thickness: 0.01,
        area: 1.0,
      },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    // Sin diferencia de temperatura, debe ser 0 o muy cerca
    expect(result.h_watts).toBeCloseTo(0, 2);
  });

  test('POST /calcular-conduccion con material inválido debe fallar', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-conduccion`, {
      data: {
        material_id: 'material_inexistente_xyz',
        temp_in: 100,
        temp_out: 25,
        thickness: 0.01,
      },
    });
    // Debe retornar error (404 o 422)
    expect([404, 422, 400]).toContain(response.status());
  });

  test('POST /calcular-conduccion sin datos debe retornar 422', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-conduccion`, {
      data: {},
    });
    expect(response.status()).toBe(422);
  });
});

// ─────────────────────────────────────────────
//  TESTS: API - Convección (Ley de Newton)
// ─────────────────────────────────────────────
test.describe('API Backend - Convección de Calor', () => {
  test('POST /calcular-conveccion natural con datos válidos', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-conveccion`, {
      data: {
        temp_superficie: 80,
        temp_fluido: 25,
        tipo: 'natural',
        area: 1.0,
      },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result).toHaveProperty('h_watts');
    expect(result).toHaveProperty('coeficiente_h');
    expect(result).toHaveProperty('tipo');
    expect(result).toHaveProperty('q_joules_per_hour');
    expect(result).toHaveProperty('suggestions');
    expect(result.tipo).toBe('natural');
    expect(result.h_watts).toBeGreaterThan(0);
  });

  test('POST /calcular-conveccion forzada con velocidad', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-conveccion`, {
      data: {
        temp_superficie: 80,
        temp_fluido: 25,
        tipo: 'forced',
        area: 1.0,
        velocidad_fluido: 5.0,
      },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.tipo).toBe('forced');
    // Forzada debe tener coeficiente mayor que natural
    expect(result.coeficiente_h).toBeGreaterThan(0);
  });

  test('POST /calcular-conveccion sin datos debe retornar 422', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-conveccion`, {
      data: {},
    });
    expect(response.status()).toBe(422);
  });
});

// ─────────────────────────────────────────────
//  TESTS: API - Radiación (Stefan-Boltzmann)
// ─────────────────────────────────────────────
test.describe('API Backend - Radiación de Calor', () => {
  test('POST /calcular-radiacion con datos válidos', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-radiacion`, {
      data: {
        temp_emisor: 200,
        temp_receptor: 25,
        area: 1.0,
        emisividad: 0.9,
      },
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result).toHaveProperty('h_watts');
    expect(result).toHaveProperty('flujo_superficial');
    expect(result).toHaveProperty('emisividad');
    expect(result).toHaveProperty('q_joules_per_hour');
    expect(result).toHaveProperty('suggestions');
    expect(result.h_watts).toBeGreaterThan(0);
  });

  test('POST /calcular-radiacion con emisividad fuera de rango debe fallar', async ({ request }) => {
    const response = await request.post(`${API_URL}/calcular-radiacion`, {
      data: {
        temp_emisor: 200,
        temp_receptor: 25,
        area: 1.0,
        emisividad: 1.5, // > 1.0, inválido
      },
    });
    expect(response.status()).toBe(422);
  });

  test('POST /calcular-radiacion con cuerpo más frío emitiendo menos', async ({ request }) => {
    const responseCaliente = await request.post(`${API_URL}/calcular-radiacion`, {
      data: { temp_emisor: 500, temp_receptor: 25, area: 1.0, emisividad: 0.8 },
    });
    const responseFrio = await request.post(`${API_URL}/calcular-radiacion`, {
      data: { temp_emisor: 100, temp_receptor: 25, area: 1.0, emisividad: 0.8 },
    });
    const resultCaliente = await responseCaliente.json();
    const resultFrio = await responseFrio.json();
    // Mayor temperatura = mayor radiación
    expect(resultCaliente.h_watts).toBeGreaterThan(resultFrio.h_watts);
  });
});
