import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../styles/App.module.css';

const THEORY_CONTENT = {
  conduccion: {
    title: 'Conducción - Ley de Fourier',
    sections: [
      {
        subtitle: 'Ley de Fourier',
        text: 'La conducción es la transferencia de calor a través de un material sólido. La rapidez con la que ocurre se rige por la Ley de Fourier:',
        formula: 'Q = (k · A · ΔT) / L',
        list: [
          { symbol: 'Q', desc: 'Rapidez de transferencia de calor (Watts, J/s)' },
          { symbol: 'k', desc: 'Conductividad térmica del material (W/m·K)' },
          { symbol: 'A', desc: 'Área de la superficie (m²)' },
          { symbol: 'ΔT', desc: 'Diferencia de temperatura (T₁ − T₂) en K' },
          { symbol: 'L', desc: 'Espesor del material (m)' },
        ],
      },
      {
        subtitle: '¿Qué es la conductividad térmica?',
        text: 'La conductividad térmica (k) indica qué tan fácilmente un material permite que el calor lo atraviese. Un material con k bajo es un buen aislante (como el tecnopor), mientras que uno con k alto conduce muy bien el calor (como el aluminio).',
      },
    ],
  },
  conveccion: {
    title: 'Convección - Ley de Newton',
    sections: [
      {
        subtitle: 'Ley de Newton del Enfriamiento',
        text: 'La convección es la transferencia de calor entre una superficie y un fluido en movimiento. Se describe mediante:',
        formula: 'Q = h · A · (T_s − T_f)',
        list: [
          { symbol: 'Q', desc: 'Rapidez de transferencia de calor (Watts)' },
          { symbol: 'h', desc: 'Coeficiente de convección (W/m²·K)' },
          { symbol: 'A', desc: 'Área de la superficie (m²)' },
          { symbol: 'T_s', desc: 'Temperatura de la superficie (K)' },
          { symbol: 'T_f', desc: 'Temperatura del fluido (K)' },
        ],
      },
      {
        subtitle: 'Tipos de convección',
        text: 'Convección forzada: el fluido es mueve por un ventilador o bomba. Convección natural: el movimiento se debe a las diferencias de densidad causada por la temperatura.',
      },
    ],
  },
  radiacion: {
    title: 'Radiación - Ley de Stefan-Boltzmann',
    sections: [
      {
        subtitle: 'Ley de Stefan-Boltzmann',
        text: 'La radiación térmica es la transferencia de calor mediante ondas electromagnéticas. Se describe mediante:',
        formula: 'Q = ε · σ · A · (T₁⁴ − T₂⁴)',
        list: [
          { symbol: 'Q', desc: 'Rapidez de transferencia de calor (Watts)' },
          { symbol: 'ε', desc: 'Emisividad de la superficie (0 a 1)' },
          { symbol: 'σ', desc: 'Constante de Stefan-Boltzmann (5.67×10⁻⁸ W/m²·K⁴)' },
          { symbol: 'A', desc: 'Área de la superficie (m²)' },
          { symbol: 'T', desc: 'Temperatura absoluta (K)' },
        ],
      },
      {
        subtitle: 'Emisividad',
        text: 'La emisividad (ε) indica qué tan eficientemente una superficie emite radiación. Un cuerpo negro tiene ε=1. Los metales pulidos tienen emisividad muy baja (~0.05).',
      },
    ],
  },
};

export const TheoryModal = ({ activeMechanism = 'conduccion', onClose }) => {
  const content = THEORY_CONTENT[activeMechanism] || THEORY_CONTENT.conduccion;

  return (
    <motion.div
      className={styles.modalOverlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.modalContent}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.modalTitle}>{content.title}</h2>

        {content.sections.map((section, idx) => (
          <div key={idx} className={styles.modalSection}>
            <h3 className={styles.modalSectionTitle}>{section.subtitle}</h3>
            <p className={styles.modalText}>{section.text}</p>
            {section.formula && (
              <div className={styles.formulaBox}>{section.formula}</div>
            )}
            {section.list && (
              <ul className={styles.modalList}>
                {section.list.map((item, i) => (
                  <li key={i}><strong>{item.symbol}:</strong> {item.desc}</li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <button className={styles.closeBtn} onClick={onClose}>
          Salir
        </button>
      </motion.div>
    </motion.div>
  );
};