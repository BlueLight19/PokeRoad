import { useEffect, useState } from 'react';
import { useGameStore } from './stores/gameStore';
import { initializeData } from './utils/dataLoader';
import { TitleScreen } from './components/TitleScreen';
import { WorldMap } from './components/navigation/WorldMap';
import { RouteMenu } from './components/navigation/RouteMenu';
import { CityMenu } from './components/navigation/CityMenu';
import { BattleScreen } from './components/battle/BattleScreen';
import { TeamView } from './components/team/TeamView';
import { PCStorage } from './components/team/PCStorage';
import { ShopMenu } from './components/shop/ShopMenu';
import { InventoryScreen } from './components/ui/InventoryScreen';
import { PokedexScreen } from './components/ui/PokedexScreen';
import { LeagueMenu } from './components/ui/LeagueMenu';
import { EvolutionModal, MoveLearnModal } from './components/EvolutionModal';
import { HallOfFame } from './components/scenes/HallOfFame';

// Initialize game data on load
initializeData();

// --- COMPOSANT DEV TOOLS ---
function DevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Variables d'état pour les champs de texte
    const [itemId, setItemId] = useState('master-ball');
    const [itemQty, setItemQty] = useState(10);
    const [pokeId, setPokeId] = useState(150);
    const [pokeLevel, setPokeLevel] = useState(70);
    const [moneyAmount, setMoneyAmount] = useState(50000);

    const addItem = useGameStore(s => s.addItem);
    const givePlayerPokemon = useGameStore(s => s.givePlayerPokemon);
    const addMoney = useGameStore(s => s.addMoney);
    const currentView = useGameStore(s => s.currentView);

    // Cache le bouton sur l'écran titre
    if (currentView === 'title') return null;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    position: 'fixed', bottom: '10px', left: '10px', zIndex: 9999,
                    background: '#e94560', color: '#fff', border: '2px solid #fff',
                    padding: '6px 10px', fontFamily: "'Press Start 2P', monospace", fontSize: '8px',
                    cursor: 'pointer', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
            >
                DEV
            </button>
        );
    }

    const inputStyle = {
        background: '#0f172a', color: '#fff', border: '1px solid #333',
        padding: '4px', fontSize: '8px', fontFamily: "'Press Start 2P', monospace",
        width: '100%', marginBottom: '6px', boxSizing: 'border-box' as const, borderRadius: '2px'
    };

    const btnStyle = {
        background: '#16213e', color: '#fff', border: '1px solid #e94560',
        padding: '6px', fontFamily: "'Press Start 2P', monospace", fontSize: '7px',
        cursor: 'pointer', borderRadius: '2px', width: '100%'
    };

    const handleLogin = () => {
        // Vérification simple et directe : on enlève les espaces et on met en minuscules
        if (passwordInput.trim() === 'tomer') {
            setIsAuthenticated(true);
            setErrorMsg('');
        } else {
            setErrorMsg('Mot de passe incorrect, neuille');
            setPasswordInput('');
        }
    };

    // --- ECRAN DE CONNEXION ---
    if (!isAuthenticated) {
        return (
            <div style={{
                position: 'fixed', bottom: '10px', left: '10px', zIndex: 9999,
                background: '#0f172a', border: '2px solid #e94560', borderRadius: '8px',
                padding: '10px', display: 'flex', flexDirection: 'column', width: '200px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ color: '#FFD600', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>Accès Restreint</span>
                    <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>✖</button>
                </div>

                <input
                    type="password"
                    placeholder="Mot de passe"
                    style={inputStyle}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button style={btnStyle} onClick={handleLogin}>Déverrouiller</button>

                {errorMsg && <span style={{ color: '#ff4444', fontSize: '7px', marginTop: '6px', textAlign: 'center' }}>{errorMsg}</span>}
            </div>
        );
    }

    // --- MENU DEVTOOLS (Une fois connecté) ---
    const sectionStyle = {
        marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #333'
    };

    return (
        <div style={{
            position: 'fixed', bottom: '10px', left: '10px', zIndex: 9999,
            background: '#0f172a', border: '2px solid #e94560', borderRadius: '8px',
            padding: '10px', display: 'flex', flexDirection: 'column',
            boxShadow: '0 4px 10px rgba(0,0,0,0.5)', width: '240px', maxHeight: '80vh', overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                <span style={{ color: '#FFD600', fontSize: '9px', fontFamily: "'Press Start 2P', monospace" }}>Outils Dev</span>
                <button onClick={() => { setIsOpen(false); setIsAuthenticated(false); setPasswordInput(''); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>✖</button>
            </div>

            <div style={sectionStyle}>
                <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Générer un Objet</span>
                <input style={inputStyle} type="text" placeholder="ID de l'objet (ex: potion)" value={itemId} onChange={e => setItemId(e.target.value)} />
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input style={{...inputStyle, width: '60px', marginBottom: 0}} type="number" min="1" value={itemQty} onChange={e => setItemQty(parseInt(e.target.value) || 1)} />
                    <button style={{...btnStyle, flex: 1}} onClick={() => addItem(itemId, itemQty)}>Donner</button>
                </div>
            </div>

            <div style={sectionStyle}>
                <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Générer un Pokémon</span>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                    <input style={{...inputStyle, flex: 1, marginBottom: 0}} type="number" placeholder="Num. Pokédex" value={pokeId} onChange={e => setPokeId(parseInt(e.target.value) || 1)} />
                    <input style={{...inputStyle, flex: 1, marginBottom: 0}} type="number" placeholder="Niveau" value={pokeLevel} onChange={e => setPokeLevel(parseInt(e.target.value) || 1)} />
                </div>
                <button style={btnStyle} onClick={() => givePlayerPokemon(pokeId, pokeLevel)}>Donner Pokémon</button>
            </div>

            <div>
                <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Ajouter des Pokédollars</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input style={{...inputStyle, flex: 1, marginBottom: 0}} type="number" value={moneyAmount} onChange={e => setMoneyAmount(parseInt(e.target.value) || 0)} />
                    <button style={{...btnStyle, width: 'auto'}} onClick={() => addMoney(moneyAmount)}>+ P</button>
                </div>
            </div>
        </div>
    );
}
// ---------------------------

function App() {
    const currentView = useGameStore(s => s.currentView);
    const pendingEvolution = useGameStore(s => s.pendingEvolution);
    const pendingMoveLearn = useGameStore(s => s.pendingMoveLearn);

    const renderView = () => {
        switch (currentView) {
            case 'title':
                return <TitleScreen />;
            case 'world_map':
                return <WorldMap />;
            case 'route_menu':
                return <RouteMenu />;
            case 'city_menu':
                return <CityMenu />;
            case 'battle':
                return <BattleScreen />;
            case 'team':
                return <TeamView />;
            case 'pc':
                return <PCStorage />;
            case 'shop':
                return <ShopMenu />;
            case 'inventory':
                return <InventoryScreen />;
            case 'pokedex':
                return <PokedexScreen />;
            case 'league':
                return <LeagueMenu />;
            case 'hall_of_fame':
                return <HallOfFame onComplete={() => useGameStore.getState().handleGameCleared()} />;
            default:
                return <TitleScreen />;
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#0f0f23',
                color: '#fff',
                fontFamily: "'Press Start 2P', system-ui, sans-serif",
            }}
        >
            {renderView()}
            {pendingEvolution && <EvolutionModal />}
            {pendingMoveLearn && <MoveLearnModal />}

            {/* Bouton de triche pour les développeurs */}
            <DevTools />
        </div>
    );
}

export default App;