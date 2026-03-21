import { useEffect, useState } from 'react';
import { useGameStore } from './stores/gameStore';
import { createPCStorage } from './engine/pcStorage';
import { initGameData, forceFullSync } from './utils/db';
import { initializeData, getItemData, getAllItems } from './utils/dataLoader';
import { deleteSave } from './utils/saveManager';
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
import { soundManager } from './utils/SoundManager';
import { NotificationOverlay } from './components/ui/NotificationOverlay';

// --- LOADING SCREEN ---
function LoadingScreen({ progress, table }: { progress: number; table: string }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'transparent',
            fontFamily: "'Press Start 2P', monospace",
        }}>
            <h1 style={{
                color: '#e94560',
                fontSize: '24px',
                marginBottom: '40px',
                textShadow: '3px 3px 0 #0a0a15, 0 0 30px #e9456033',
                letterSpacing: '3px',
            }}>
                PokeRoad
            </h1>

            <div style={{
                width: '300px',
                maxWidth: '80vw',
                marginBottom: '16px',
            }}>
                <div style={{
                    width: '100%',
                    height: '12px',
                    background: '#1a1a2e',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    border: '1px solid #333',
                }}>
                    <div style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #e94560, #ff6b8a)',
                        borderRadius: '6px',
                        transition: 'width 0.3s ease',
                    }} />
                </div>
            </div>

            <p style={{
                color: '#666',
                fontSize: '8px',
                fontFamily: "'Press Start 2P', monospace",
            }}>
                {progress >= 100 ? 'Chargement...' : `Synchronisation : ${table}`}
            </p>
        </div>
    );
}

// --- COMPOSANT DEV TOOLS ---
function DevTools() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const [itemId, setItemId] = useState('rare-candy');
    const [itemQty, setItemQty] = useState(1);
    const [pokeId, setPokeId] = useState(150);
    const [pokeLevel, setPokeLevel] = useState(100);
    const [moneyAmount, setMoneyAmount] = useState(10000);

    const addItem = useGameStore(s => s.addItem);
    const givePlayerPokemon = useGameStore(s => s.givePlayerPokemon);
    const addMoney = useGameStore(s => s.addMoney);
    const currentView = useGameStore(s => s.currentView);
    const setGameSpeed = useGameStore(s => s.setGameSpeed);
    const gameSpeed = useGameStore(s => s.settings.gameSpeed);

    if (currentView === 'title') return null;

    if (!isOpen) {
        return (
            <button
                onClick={() => {
                    soundManager.playClick();
                    setIsOpen(true);
                }}
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
        if (passwordInput.trim() === 'tomer') {
            setIsAuthenticated(true);
            setErrorMsg('');
        } else {
            setErrorMsg('Mot de passe incorrect, neuille');
            setPasswordInput('');
        }
    };

    const handleReset = async () => {
        if (window.confirm("Voulez-vous vraiment effacer complètement votre partie ? Cette action est irréversible !")) {
            await deleteSave();
            window.location.reload();
        }
    };

    const handleGiveAllPokemon = async () => {
        if (window.confirm("Attention, cela va vider votre équipe et votre PC. L'opération va être très rapide. Continuer ?")) {
            setIsGenerating(true);
            setIsOpen(false);

            try {
                useGameStore.setState({ team: [], pc: createPCStorage() });

                for (let i = 1; i <= 151; i++) {
                    try {
                        const result = givePlayerPokemon(i, 100) as any;
                        if (result instanceof Promise) await result;
                    } catch (e) {
                        console.error(`Impossible de générer le Pokémon #${i}. Il sera ignoré.`, e);
                    }

                    await new Promise(r => setTimeout(r, 10));
                }

                console.log("Génération terminée !");
            } catch (error) {
                console.error("Une erreur majeure est survenue pendant la génération :", error);
            } finally {
                setIsGenerating(false);
            }
        }
    };

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
                    <button onClick={() => { soundManager.playClick(); setIsOpen(false); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>✖</button>
                </div>

                <input
                    type="password"
                    placeholder="Mot de passe"
                    style={inputStyle}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button style={btnStyle} onClick={() => { soundManager.playClick(); handleLogin(); }}>Déverrouiller</button>

                {errorMsg && <span style={{ color: '#ff4444', fontSize: '7px', marginTop: '6px', textAlign: 'center' }}>{errorMsg}</span>}
            </div>
        );
    }

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
                <button onClick={() => { soundManager.playClick(); setIsOpen(false); setIsAuthenticated(false); setPasswordInput(''); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>✖</button>
            </div>

            <div style={sectionStyle}>
                <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Générer un Objet</span>
                <input style={inputStyle} type="text" placeholder="ID de l'objet (ex: potion)" value={itemId} onChange={e => setItemId(e.target.value)} />
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input style={{...inputStyle, width: '60px', marginBottom: 0}} type="number" min="1" value={itemQty} onChange={e => setItemQty(parseInt(e.target.value) || 1)} />
                    <button style={{...btnStyle, flex: 1}} onClick={() => { soundManager.playClick(); addItem(itemId, itemQty); }}>Donner</button>
                </div>
            </div>

            <div style={sectionStyle}>
                <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Générer un Pokémon</span>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                    <input style={{...inputStyle, flex: 1, marginBottom: 0}} type="number" placeholder="Num. Pokédex" value={pokeId} onChange={e => setPokeId(parseInt(e.target.value) || 1)} />
                    <input style={{...inputStyle, flex: 1, marginBottom: 0}} type="number" placeholder="Niveau" value={pokeLevel} onChange={e => setPokeLevel(parseInt(e.target.value) || 1)} />
                </div>
                <button style={btnStyle} onClick={() => { soundManager.playClick(); givePlayerPokemon(pokeId, pokeLevel); }}>Donner Pokémon</button>
            </div>

        <div style={sectionStyle}>
            <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Générer le Pokédex</span>
            <button style={{...btnStyle, opacity: isGenerating ? 0.5 : 1}} onClick={() => { soundManager.playClick(); handleGiveAllPokemon(); }} disabled={isGenerating}>
                {isGenerating ? "Génération en cours..." : "Give tout les pokémon"}
            </button>
        </div>

            <div style={sectionStyle}>
                <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Ajouter des Pokédollars</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input style={{...inputStyle, flex: 1, marginBottom: 0}} type="number" value={moneyAmount} onChange={e => setMoneyAmount(parseInt(e.target.value) || 0)} />
                    <button style={{...btnStyle, width: 'auto'}} onClick={() => { soundManager.playClick(); addMoney(moneyAmount); }}>+ P</button>
                </div>
            </div>

            <div style={sectionStyle}>
                <span style={{ color: '#aaa', fontSize: '7px', display: 'block', marginBottom: '4px' }}>Vitesse du Jeu (Combat & Dialogues)</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={{...btnStyle, flex: 1, background: gameSpeed === 1 ? '#e94560' : '#16213e'}} onClick={() => { soundManager.playClick(); setGameSpeed(1); }}>1x</button>
                    <button style={{...btnStyle, flex: 1, background: gameSpeed === 2 ? '#e94560' : '#16213e'}} onClick={() => { soundManager.playClick(); setGameSpeed(2); }}>2x</button>
                    <button style={{...btnStyle, flex: 1, background: gameSpeed === 4 ? '#e94560' : '#16213e'}} onClick={() => { soundManager.playClick(); setGameSpeed(4); }}>4x</button>
                </div>
            </div>

            <div>
                <span style={{ color: '#ff4444', fontSize: '7px', display: 'block', marginBottom: '4px' }}></span>
                <button
                    style={{...btnStyle, background: '#8b0000', borderColor: '#ff0000', marginBottom: '8px'}}
                    onClick={() => { soundManager.playClick(); handleReset(); }}
                >
                    Réinitialiser la Sauvegarde
                </button>
                <button
                    style={{...btnStyle, background: '#1b5e20', borderColor: '#4caf50', marginBottom: '8px'}}
                    onClick={() => { 
                        try {
                            const items = getAllItems();
                            if (items.length === 0) {
                                alert("Registre VIDE");
                            } else {
                                alert(`Total: ${items.length}\nIDs: ${items.slice(0, 10).map(i => i.id).join(', ')}`);
                            }
                        } catch (e) {
                            alert(`ERROR: ${e instanceof Error ? e.message : 'Unknown'}`);
                        }
                    }}
                >
                    Lister Ids Recus
                </button>
                <button
                    style={{...btnStyle, background: '#1b5e20', borderColor: '#4caf50', marginBottom: '8px'}}
                    onClick={() => { 
                        try {
                            const ball = getItemData('poke-ball');
                            const pot = getItemData('potion');
                            alert(`OK: Registry has ${ball.name} and ${pot.name}`);
                        } catch (e) {
                            alert(`ERROR: ${e instanceof Error ? e.message : 'Unknown'}`);
                        }
                    }}
                >
                    Tester Registre Items
                </button>
                <button
                    style={{...btnStyle, background: '#4a148c', borderColor: '#7c43bd'}}
                    onClick={async () => { 
                        if (window.confirm("Cela va vider TOUTE la base de données locale (incluant les données de jeu) et forcer un rechargement depuis Supabase. Continuer ?")) {
                            await forceFullSync();
                            window.location.reload();
                        }
                    }}
                >
                    Forcer Sync Supabase
                </button>
            </div>
        </div>
    );
}
// ---------------------------

function App() {
    const currentView = useGameStore(s => s.currentView);
    const pendingEvolution = useGameStore(s => s.pendingEvolution);
    const pendingMoveLearn = useGameStore(s => s.pendingMoveLearn);

    const [isLoading, setIsLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState(0);
    const [loadTable, setLoadTable] = useState('');
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                // 1. Sync game data from Supabase → IndexedDB (or use cache)
                await initGameData((table, pct) => {
                    if (mounted) {
                        setLoadProgress(pct);
                        setLoadTable(table);
                    }
                });

                // 2. Load data from IndexedDB → in-memory registries
                await initializeData();

                if (mounted) {
                    setLoadProgress(100);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Failed to initialize game data:', error);
                if (mounted) {
                    setLoadError(
                        error instanceof Error ? error.message : 'Erreur de chargement'
                    );
                }
            }
        }

        init();

        return () => { mounted = false; };
    }, []);

    if (loadError) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                fontFamily: "'Press Start 2P', monospace",
                padding: '20px',
                textAlign: 'center',
            }}>
                <h2 style={{ color: '#e94560', fontSize: '14px', marginBottom: '20px' }}>
                    Erreur de chargement
                </h2>
                <p style={{ color: '#888', fontSize: '8px', marginBottom: '20px', maxWidth: '400px', lineHeight: '1.8' }}>
                    {loadError}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        background: '#e94560',
                        color: '#fff',
                        border: 'none',
                        padding: '12px 24px',
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: '10px',
                        cursor: 'pointer',
                        borderRadius: '8px',
                    }}
                >
                    Réessayer
                </button>
            </div>
        );
    }

    if (isLoading) {
        return <LoadingScreen progress={loadProgress} table={loadTable} />;
    }

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
                background: 'transparent',
                color: '#fff',
                fontFamily: "'Press Start 2P', system-ui, sans-serif",
                maxWidth: '900px',
                margin: '0 auto',
                padding: '0 8px',
            }}
        >
            {renderView()}
            {pendingEvolution && <EvolutionModal />}
            {pendingMoveLearn && <MoveLearnModal />}
            <NotificationOverlay />

            <DevTools />
        </div>
    );
}

export default App;