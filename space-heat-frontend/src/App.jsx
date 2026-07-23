import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SimulatorSandbox } from './components/SimulatorSandbox';
import { TheoryModal } from './components/TheoryModal';
import styles from './styles/App.module.css';

function App() {
  const [showTheory, setShowTheory] = useState(false);
  const [activeMechanism, setActiveMechanism] = useState('conduccion');

  return (
    <div className={styles.appContainer}>
      <Header onOpenTheory={() => setShowTheory(true)} />

      <main className={styles.mainContent}>
        <SimulatorSandbox
          externalActiveMechanism={activeMechanism}
          onMechanismChange={setActiveMechanism}
        />
      </main>

      {showTheory && <TheoryModal activeMechanism={activeMechanism} onClose={() => setShowTheory(false)} />}
    </div>
  );
}

export default App;