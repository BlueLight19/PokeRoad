import { useEffect } from 'react';
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

// Initialize game data on load
initializeData();

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
    </div>
  );
}

export default App;
