import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getCityShopItems, getShopItems, getItemData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { soundManager } from '../../utils/SoundManager';

export function ShopMenu() {
  const { player, addItem, removeItem, spendMoney, addMoney, setView, inventory, selectedZone, sellItemAction } = useGameStore();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [view, setShopView] = useState<'buy' | 'sell'>('buy');

  const items = selectedZone ? getCityShopItems(selectedZone) : getShopItems();
  const sellableInventory = inventory.filter(invItem => {
    try {
      const itemData = getItemData(invItem.itemId);
      return itemData && itemData.price > 0;
    } catch {
      return false;
    }
  });

  // Debug: log shop state
  console.log('[ShopMenu]', { selectedZone, itemCount: items.length, inventorySize: inventory.length });

  const handleBuy = (itemId: string, price: number) => {
    const qty = quantities[itemId] || 1;
    const total = price * qty;

    if (player.money < total) {
      setMessage('Pas assez d\'argent !');
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    if (spendMoney(total)) {
      addItem(itemId, qty);
      setMessage(`Achat réussi !`);
      setTimeout(() => setMessage(null), 2000);
      useGameStore.getState().saveGameState();
    }
  };

  const handleSell = (itemId: string, price: number) => {
    if (price <= 0) {
      setMessage('Cet objet ne peut pas être vendu !');
      setTimeout(() => setMessage(null), 2000);
      return;
    }
    const qty = quantities[itemId] || 1;
    const sellPrice = Math.floor(price / 2);
    
    sellItemAction(itemId, qty);
    setMessage(`Vente réussie pour ${sellPrice * qty}P !`);
    setTimeout(() => setMessage(null), 2000);
  };

  const setQty = (itemId: string, qty: number, max: number = 99) => {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(1, Math.min(max, qty)) }));
  };

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#2196F3', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px', textAlign: 'center' }}>
        Boutique
      </h2>

      <div style={{ color: '#FFD600', fontSize: '11px', fontFamily: "'Press Start 2P', monospace", textAlign: 'center', marginBottom: '16px' }}>
        {player.money}P
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
        <Button 
            variant={view === 'buy' ? 'primary' : 'ghost'} 
            size="sm" 
            onClick={() => setShopView('buy')}
        >
            Acheter
        </Button>
        <Button 
            variant={view === 'sell' ? 'primary' : 'ghost'} 
            size="sm" 
            onClick={() => setShopView('sell')}
        >
            Vendre
        </Button>
      </div>

      {message && (
        <div style={{
          color: '#4CAF50',
          fontSize: '10px',
          fontFamily: "'Press Start 2P', monospace",
          textAlign: 'center',
          padding: '8px',
          marginBottom: '8px',
          background: '#1a2e1a',
          borderRadius: '6px',
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {view === 'buy' ? (
          items.map(item => {
            const qty = quantities[item.id] || 1;
            const owned = inventory.find(i => i.itemId === item.id)?.quantity || 0;

            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: '#16213e',
                  border: '1px solid #333',
                  borderRadius: '8px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
                    {item.name}
                  </div>
                  <div style={{ color: '#888', fontSize: '7px', fontFamily: "'Press Start 2P', monospace", marginTop: '2px' }}>
                    {item.description}
                  </div>
                  <div style={{ color: '#FFD600', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                    {item.price}P {owned > 0 && <span style={{ color: '#aaa' }}>(x{owned})</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setQty(item.id, qty - 1);
                    }}
                    style={{
                      width: '24px', height: '24px', background: '#333', border: '1px solid #555',
                      borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    -
                  </button>
                  <span style={{ color: '#fff', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", minWidth: '24px', textAlign: 'center' }}>
                    {qty}
                  </span>
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setQty(item.id, qty + 1);
                    }}
                    style={{
                      width: '24px', height: '24px', background: '#333', border: '1px solid #555',
                      borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleBuy(item.id, item.price)}
                  disabled={player.money < item.price * qty}
                >
                  Acheter
                </Button>
              </div>
            );
          })
        ) : (
          sellableInventory.length === 0 ? (
            <div style={{ color: '#666', fontSize: '9px', fontFamily: "'Press Start 2P', monospace", textAlign: 'center', padding: '30px' }}>
                Rien à vendre.
            </div>
          ) : (
            sellableInventory.map(invItem => {
                const item = getItemData(invItem.itemId);
                if (!item) return null;
                const qty = quantities[invItem.itemId] || 1;
                const sellPrice = Math.floor(item.price / 2);

                return (
                <div
                    key={invItem.itemId}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        background: '#16213e',
                        border: '1px solid #333',
                        borderRadius: '8px',
                    }}
                >
                    <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontSize: '10px', fontFamily: "'Press Start 2P', monospace" }}>
                        {item.name}
                    </div>
                    <div style={{ color: '#888', fontSize: '7px', fontFamily: "'Press Start 2P', monospace", marginTop: '2px' }}>
                        x{invItem.quantity} possédés
                    </div>
                    <div style={{ color: '#FFD600', fontSize: '8px', fontFamily: "'Press Start 2P', monospace", marginTop: '4px' }}>
                        Prix de vente: {sellPrice}P
                    </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                        onClick={() => {
                          soundManager.playClick();
                          setQty(invItem.itemId, qty - 1, invItem.quantity);
                        }}
                        style={{
                        width: '24px', height: '24px', background: '#333', border: '1px solid #555',
                        borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        -
                    </button>
                    <span style={{ color: '#fff', fontSize: '10px', fontFamily: "'Press Start 2P', monospace", minWidth: '24px', textAlign: 'center' }}>
                        {qty}
                    </span>
                    <button
                        onClick={() => {
                          soundManager.playClick();
                          setQty(invItem.itemId, qty + 1, invItem.quantity);
                        }}
                        style={{
                        width: '24px', height: '24px', background: '#333', border: '1px solid #555',
                        borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '14px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        +
                    </button>
                    </div>

                    <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleSell(invItem.itemId, item.price)}
                    >
                    Vendre
                    </Button>
                </div>
                );
            })
          )
        )}
      </div>

      <div style={{ marginTop: '16px' }}>
        <Button variant="ghost" onClick={() => setView('city_menu')}>
          Retour
        </Button>
      </div>
    </div>
  );
}
