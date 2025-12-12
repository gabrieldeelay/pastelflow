
import React, { useState, useEffect } from 'react';
import { Plus, User, Lock, X, Trash2, AlertTriangle } from 'lucide-react';
import { Profile } from '../types';
import { supabase, isSupabaseConfigured } from '../supabaseClient';

interface Props {
  onSelectProfile: (profile: Profile) => void;
}

const AVATAR_SEEDS = ['Felix', 'Aneka', 'Willow', 'Bella', 'Jack', 'Oliver'];

const ProfileGate: React.FC<Props> = ({ onSelectProfile }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'select' | 'create' | 'pin' | 'delete_confirm'>('select');
  
  // Create State
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePin, setNewProfilePin] = useState('');
  const [newProfileAvatar, setNewProfileAvatar] = useState(AVATAR_SEEDS[0]);
  
  // Pin/Auth State
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pinAttempt, setPinAttempt] = useState('');
  
  // Delete State
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    if (!isSupabaseConfigured()) {
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
       // Initialize empty board for this user locally
       localStorage.setItem(`pastel_data_${mockProfile.id}`, JSON.stringify({ columns: [], tasks: [] }));
       
       setView('select');
       setNewProfileName('');
       setNewProfilePin('');
       return;
    }

    // Persist to Cloud FIRST
    const { data, error } = await supabase.from('profiles').insert([newProfile]).select().single();
    
    if (error) {
        console.error(error);
        alert("Erro ao criar perfil na nuvem.");
        return;
    }

    if (data) {
      setProfiles([...profiles, data]);
      setView('select');
      setNewProfileName('');
      setNewProfilePin('');
    }
  };

  const handleProfileClick = (profile: Profile) => {
    if (profile.pin) {
      setSelectedProfile(profile);
      setView('pin');
    } else {
      onSelectProfile(profile);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check Logic: 
    // 1. If profile has NO pin, logic passes automatically (pinAttempt doesn't matter).
    // 2. If profile HAS pin, pinAttempt must match.
    const isPinCorrect = !selectedProfile?.pin || (pinAttempt === selectedProfile.pin);

    if (isPinCorrect) {
        if (view === 'delete_confirm' && selectedProfile) {
            performDelete(selectedProfile);
        } else if (selectedProfile) {
            onSelectProfile(selectedProfile);
        }
        setPinAttempt('');
    } else {
      alert('PIN Incorreto');
      setPinAttempt('');
    }
  };

  const initiateDelete = (e: React.MouseEvent, profile: Profile) => {
      e.stopPropagation(); // Stop click from triggering profile login
      setProfileToDelete(profile);
      setSelectedProfile(profile); // Ensure avatar shows in modal
      setView('delete_confirm');
      setPinAttempt('');
  };

  const performDelete = async (profile: Profile) => {
      if (!isSupabaseConfigured()) {
          const updated = profiles.filter(p => p.id !== profile.id);
          setProfiles(updated);
          localStorage.setItem('mock_profiles', JSON.stringify(updated));
          localStorage.removeItem(`pastel_data_${profile.id}`); // Clear data
          setView('select');
          setProfileToDelete(null);
          setSelectedProfile(null);
          return;
      }

      await supabase.from('profiles').delete().eq('id', profile.id);
      
      setProfiles(profiles.filter(p => p.id !== profile.id));
      setView('select');
      setProfileToDelete(null);
      setSelectedProfile(null);
  };

  // --- VIEWS ---

  if (view === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-4 fade-in">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl relative border border-stone-100">
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

  if (view === 'pin' || view === 'delete_confirm') {
    const isDeleteMode = view === 'delete_confirm';
    // Only show input if it's NOT delete mode (aka Login), OR if it IS delete mode AND the profile has a pin.
    const showInput = !isDeleteMode || (isDeleteMode && selectedProfile?.pin);

    return (
      <div className="min-h-screen flex items-center justify-center bg-paper p-4 fade-in">
        <div className="max-w-xs w-full bg-white rounded-3xl p-8 shadow-xl text-center relative border border-stone-100">
          <button 
            onClick={() => {
                setView('select');
                setPinAttempt('');
                setProfileToDelete(null);
            }} 
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"
          >
            <X size={24} />
          </button>
          
          <img 
            src={selectedProfile?.avatar} 
            className="w-20 h-20 rounded-full mx-auto mb-4 bg-stone-100 shadow-inner" 
            alt="Avatar"
          />
          
          <p className="text-stone-500 mb-2">
              {isDeleteMode ? `Excluir perfil de ${selectedProfile?.name}?` : `Olá, ${selectedProfile?.name}`}
          </p>
          
          {isDeleteMode && (
              <div className="flex items-center justify-center gap-2 text-red-500 text-xs font-bold uppercase tracking-widest mb-4">
                  <AlertTriangle size={14} />
                  <span>Ação Irreversível</span>
              </div>
          )}

          <form onSubmit={handlePinSubmit}>
            {showInput && (
                <input
                    autoFocus
                    type="password"
                    maxLength={4}
                    placeholder="Digite o PIN"
                    value={pinAttempt}
                    onChange={(e) => setPinAttempt(e.target.value)}
                    className={`
                        w-full text-center text-2xl tracking-widest bg-stone-50 border-2 rounded-xl py-2 mb-4 outline-none
                        ${isDeleteMode ? 'border-red-100 focus:border-red-300' : 'border-stone-200 focus:border-stone-400'}
                    `}
                />
            )}
            
            <button className={`w-full py-2 rounded-xl font-bold text-white transition-colors ${isDeleteMode ? 'bg-red-500 hover:bg-red-600' : 'bg-stone-800 hover:bg-stone-700'}`}>
               {isDeleteMode ? 'Confirmar Exclusão' : 'Entrar'}
            </button>
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
          <div key={profile.id} className="group relative flex flex-col items-center gap-3">
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

            {/* Delete Button (Updated: z-50 for click priority) */}
            <button 
                onClick={(e) => initiateDelete(e, profile)}
                className="absolute -top-2 -right-2 z-50 bg-white text-stone-400 hover:text-red-500 hover:bg-red-50 border border-stone-200 p-2 rounded-full shadow-md transition-all scale-90 hover:scale-110"
                title="Excluir Perfil"
            >
                <Trash2 size={16} />
            </button>
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
