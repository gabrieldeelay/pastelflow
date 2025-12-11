import React, { useState, useEffect } from 'react';
import { Plus, User, Lock, X } from 'lucide-react';
import { Profile } from '../types';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

interface Props {
  onSelectProfile: (profile: Profile) => void;
}

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Willow', 'Bella', 'Jack', 'Oliver'];

const ProfileGate: React.FC<Props> = ({ onSelectProfile }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'select' | 'create' | 'pin'>('select');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePin, setNewProfilePin] = useState('');
  const [newProfileAvatar, setNewProfileAvatar] = useState(AVATAR_SEEDS[0]);
  const [selectedProfileForPin, setSelectedProfileForPin] = useState<Profile | null>(null);
  const [pinAttempt, setPinAttempt] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    if (!isSupabaseConfigured()) {
       // Mock for demo if no backend
       const saved = localStorage.getItem('mock_profiles');
       if(saved) setProfiles(JSON.parse(saved));
       return;
    }

    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*');
    if (!error && data) {
      setProfiles(data);
    }
    setLoading(false);
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const newProfile = {
      name: newProfileName,
      pin: newProfilePin || null,
      avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${newProfileAvatar}&backgroundColor=ffd1dc,c1e1c1,fdfbf7`,
    };

    if (!isSupabaseConfigured()) {
       const mockProfile = { ...newProfile, id: Math.random().toString() };
       const updated = [...profiles, mockProfile];
       setProfiles(updated);
       localStorage.setItem('mock_profiles', JSON.stringify(updated));
       setView('select');
       return;
    }

    const { data, error } = await supabase.from('profiles').insert([newProfile]).select();
    if (!error && data) {
      setProfiles([...profiles, data[0]]);
      setView('select');
      setNewProfileName('');
      setNewProfilePin('');
    }
  };

  const handleProfileClick = (profile: Profile) => {
    if (profile.pin) {
      setSelectedProfileForPin(profile);
      setView('pin');
    } else {
      onSelectProfile(profile);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProfileForPin && pinAttempt === selectedProfileForPin.pin) {
      onSelectProfile(selectedProfileForPin);
    } else {
      alert('PIN Incorreto');
      setPinAttempt('');
    }
  };

  if (view === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-4 fade-in">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl relative">
          <button onClick={() => setView('select')} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600">
            <X size={24} />
          </button>
          <h2 className="text-2xl font-bold text-stone-700 mb-6 text-center">Novo Perfil</h2>
          <form onSubmit={handleCreateProfile} className="flex flex-col gap-4">
            
            {/* Avatar Selector */}
            <div className="flex justify-center gap-2 mb-4 flex-wrap">
               {AVATAR_SEEDS.map(seed => (
                   <button 
                     key={seed} 
                     type="button"
                     onClick={() => setNewProfileAvatar(seed)}
                     className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${newProfileAvatar === seed ? 'border-stone-800 scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}
                   >
                       <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=ffd1dc,c1e1c1,fdfbf7`} alt={seed} />
                   </button>
               ))}
            </div>

            <input
              required
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Nome do perfil"
              className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-stone-400"
            />
            <input
              type="password"
              value={newProfilePin}
              onChange={(e) => setNewProfilePin(e.target.value)}
              placeholder="PIN de 4 dígitos (Opcional)"
              maxLength={4}
              className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none focus:border-stone-400"
            />
            <button className="bg-stone-800 text-white py-3 rounded-xl font-bold hover:bg-stone-700 transition-colors">
              Criar Perfil
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'pin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-4 fade-in">
        <div className="max-w-xs w-full bg-white rounded-3xl p-8 shadow-xl text-center relative">
          <button onClick={() => setView('select')} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600">
            <X size={24} />
          </button>
          <img 
            src={selectedProfileForPin?.avatar} 
            className="w-20 h-20 rounded-full mx-auto mb-4 bg-stone-100" 
            alt="Avatar"
          />
          <p className="text-stone-500 mb-4">Olá, {selectedProfileForPin?.name}</p>
          <form onSubmit={handlePinSubmit}>
            <input
              autoFocus
              type="password"
              maxLength={4}
              placeholder="PIN"
              value={pinAttempt}
              onChange={(e) => setPinAttempt(e.target.value)}
              className="w-full text-center text-2xl tracking-widest bg-stone-50 border-2 border-stone-200 rounded-xl py-2 mb-4 focus:border-stone-400 outline-none"
            />
            <button className="w-full bg-stone-800 text-white py-2 rounded-xl font-bold">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-paper p-4 fade-in">
      <h1 className="text-4xl md:text-5xl font-bold text-stone-700 mb-12 tracking-tight text-center">
        Quem está organizando?
      </h1>
      
      <div className="flex flex-wrap justify-center gap-8 max-w-4xl">
        {loading ? <p className="text-stone-400">Carregando...</p> : profiles.map((profile) => (
          <div key={profile.id} className="group flex flex-col items-center gap-3">
            <button
              onClick={() => handleProfileClick(profile)}
              className="w-32 h-32 md:w-40 md:h-40 rounded-3xl overflow-hidden border-4 border-transparent group-hover:border-stone-200 transition-all shadow-sm hover:shadow-xl bg-white relative"
            >
              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
              {profile.pin && (
                <div className="absolute bottom-2 right-2 bg-stone-800 text-white p-1 rounded-full w-6 h-6 flex items-center justify-center">
                   <Lock size={12} />
                </div>
              )}
            </button>
            <span className="text-xl text-stone-500 group-hover:text-stone-800 font-medium transition-colors">
              {profile.name}
            </span>
          </div>
        ))}

        <div className="group flex flex-col items-center gap-3">
          <button
            onClick={() => setView('create')}
            className="w-32 h-32 md:w-40 md:h-40 rounded-3xl border-4 border-stone-200 border-dashed flex items-center justify-center text-stone-300 hover:text-stone-500 hover:border-stone-300 hover:bg-white/50 transition-all"
          >
            <Plus size={48} />
          </button>
          <span className="text-xl text-stone-400 group-hover:text-stone-600 font-medium transition-colors">
            Adicionar
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfileGate;