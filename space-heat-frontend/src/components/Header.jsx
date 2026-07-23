import React from 'react';
import styles from '../styles/App.module.css';
import { Flame, Info } from 'lucide-react';

export const Header = ({ onOpenTheory }) => {
  return (
    <header className={styles.header}>
      <div className={styles.titleGroup}>
        <div className={styles.iconWrapper}>
          <div className={styles.iconPulse} />
          <Flame size={20} color="#f87171" />
        </div>
        <span className={styles.title}>Simulador de Transferencia de Calor</span>
      </div>

      <button className={styles.theoryBtn} onClick={onOpenTheory}>
        <Info size={16} />
        Teoría y Fórmulas
      </button>
    </header>
  );
};