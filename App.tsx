import React, { useState, useEffect } from 'react';
import Board from './components/Board';
import AccessGate from './components/AccessGate';
import ProfileGate from './components/ProfileGate';
import WelcomeToast from './components/WelcomeToast';
import { Profile } from './types';

const ACCESS_KEY = 'minimalboard_access_timestamp';
const IP_KEY = 'minimalboard_access_ip';
const PROFILE_KEY = 'minimalboard_active_profile';
const PROFILE_TIME_KEY = 'minimalboard_profile_timestamp';
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function App() {
  const [hasAccess, setHasAccess] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Verificação de sessão ao carregar o App
  useEffect(() => {
    const validateSession = async () => {
      const savedTime = localStorage.getItem(ACCESS_KEY);
      const savedIP = localStorage.getItem(IP_KEY);
      
      if (!savedTime) {
        setIsInitializing(false);
        return;
      }

      const elapsed = Date.now() - parseInt(savedTime);
      if (elapsed > TWENTY_FOUR_HOURS) {
        clearAuth();
        setIsInitializing(false);
        return;
      }

      // Tenta validar o IP (requisito "por IP")
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        
        if (savedIP && data.ip !== savedIP) {
          clearAuth();
        } else {
          setHasAccess(true);
          // Restaurar perfil se houver um ativo e válido
          const savedProfile = localStorage.getItem(PROFILE_KEY);
          const savedProfileTime = localStorage.getItem(PROFILE_TIME_KEY);
          if (savedProfile && savedProfileTime) {
            const profileElapsed = Date.now() - parseInt(savedProfileTime);
            if (profileElapsed <= TWENTY_FOUR_HOURS) {
              setCurrentProfile(JSON.parse(savedProfile));
            }
          }
        }
      } catch (e) {
        // Se falhar o fetch (ex: offline), confiamos no tempo para manter funcionalidade offline
        setHasAccess(true);
        const savedProfile = localStorage.getItem(PROFILE_KEY);
        if (savedProfile) setCurrentProfile(JSON.parse(savedProfile));
      } finally {
        setIsInitializing(false);
      }
    };

    validateSession();
  }, []);

  const clearAuth = () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(IP_KEY);
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PROFILE_TIME_KEY);
    setHasAccess(false);
    setCurrentProfile(null);
  };

  const handleAccessSuccess = async () => {
    let currentIP = '';
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      currentIP = data.ip;
    } catch (e) {}

    localStorage.setItem(ACCESS_KEY, Date.now().toString());
    if (currentIP) localStorage.setItem(IP_KEY, currentIP);
    setHasAccess(true);
  };

  const handleProfileSelect = (profile: Profile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(PROFILE_TIME_KEY, Date.now().toString());
    setCurrentProfile(profile);
  };

  const handleLogout = () => {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(PROFILE_TIME_KEY);
    setCurrentProfile(null);
  };

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-paper">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessGate onSuccess={handleAccessSuccess} />;
  }

  if (!currentProfile) {
    return (
      <ProfileGate 
        onSelectProfile={handleProfileSelect} 
      />
    );
  }

  return (
    <div className="bg-paper min-h-screen text-pastel-text">
       <WelcomeToast userName={currentProfile.name} />
       <Board 
         currentProfile={currentProfile} 
         onSwitchProfile={handleLogout}
         onLock={clearAuth}
       />
    </div>
  );
}

export default App;