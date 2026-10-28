
import React, { useState } from 'react';
import { PegasusSimulation } from '../components/PegasusSimulation';
import { AccessTerminal } from '../components/AccessTerminal';
import { appConfig } from '@/config/appConfig';

const Index = () => {
  const [isAccessed, setIsAccessed] = useState(!appConfig.features.requireAccessGate);
  const [sessionKey, setSessionKey] = useState(0);
  const [accessLevel, setAccessLevel] = useState(0);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono overflow-hidden">
      {!isAccessed ? (
        <AccessTerminal onAccess={() => setIsAccessed(true)} />
      ) : (
        <PegasusSimulation
          key={sessionKey}
          onRestart={() => setSessionKey(previous => previous + 1)}
          accessLevel={accessLevel}
          onAccessLevelChange={setAccessLevel}
        />
      )}
    </div>
  );
};

export default Index;
