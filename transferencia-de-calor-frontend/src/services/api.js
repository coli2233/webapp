import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

export const getMaterials = async () => {
  const response = await api.get('/materiales');
  return response.data;
};

export const calculateConduccion = async (data) => {
  const response = await api.post('/calcular-conduccion', data);
  return response.data;
};

export const calculateConveccion = async (data) => {
  const response = await api.post('/calcular-conveccion', data);
  return response.data;
};

export const calculateRadiacion = async (data) => {
  const response = await api.post('/calcular-radiacion', data);
  return response.data;
};