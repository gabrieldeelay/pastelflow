import React, { useState } from 'react';
import Board from './components/Board';
import AccessGate from './components/AccessGate';
import ProfileGate from './components/ProfileGate';
import WelcomeToast from './components/WelcomeToast';
import { Profile } from './types';

function App() {
  const [hasAccess, setHasAccess] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  if (!hasAccess) {
    return <AccessGate onSuccess={() => setHasAccess(true)} />;
  }

  if (!currentProfile) {
    return (
      <ProfileGate 
        onSelectProfile={(profile) => setCurrentProfile(profile)} 
      />
    );
  }

  return (
    <div className="bg-paper min-h-screen text-pastel-text">
       <WelcomeToast userName={currentProfile.name} />
       <Board currentProfile={currentProfile} />
    </div>
  );
}

export default App;