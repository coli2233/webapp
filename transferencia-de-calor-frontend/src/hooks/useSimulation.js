import { useState, useEffect } from 'react';
import { getMaterials, calculateConduccion } from '../services/api';

const DEFAULT_MATERIALS = [
  { id: 'tecnopor', name: 'Tecnopor (Poliestireno)', k_value: 0.03, density: 20, specific_heat: 1300, description: 'Aislante térmico', image_url: '' },
  { id: 'aluminio', name: 'Panel de Aluminio', k_value: 205, density: 2700, specific_heat: 900, description: 'Conductor térmico', image_url: '' },
  { id: 'carton', name: 'Cartón Corrugado', k_value: 0.05, density: 100, specific_heat: 1300, description: 'Aislante económico', image_url: '' },
];

export const useSimulation = () => {
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  const [simulationParams, setSimulationParams] = useState({
    material_id: 'tecnopor',
    temp_in: 22,
    temp_out: -5,
    thickness: 0.15,
    area: 10.0
  });

  const [results, setResults] = useState(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    const fetchMaterials = async () => {
      setLoadingMaterials(true);
      try {
        const data = await getMaterials();
        if (data && data.length > 0) {
          setMaterials(data);
        }
      } catch (error) {
        console.warn('Backend no disponible, usando materiales por defecto', error);
      } finally {
        setLoadingMaterials(false);
      }
    };

    const timer = setTimeout(() => {
      setLoadingMaterials(false);
    }, 5000);

    fetchMaterials();

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (materials.length === 0) return;
    setCalculating(true);
    const timer = setTimeout(async () => {
      try {
        const data = await calculateConduccion(simulationParams);
        setResults(data);
      } catch (error) {
        setResults(null);
      } finally {
        setCalculating(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [simulationParams, materials]);

  const updateParam = (key, value) => {
    setSimulationParams(prev => ({ ...prev, [key]: value }));
  };

  return {
    materials,
    loadingMaterials,
    simulationParams,
    updateParam,
    results,
    calculating
  };
};