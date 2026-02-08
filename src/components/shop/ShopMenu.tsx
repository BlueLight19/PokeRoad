import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getShopItems } from '../../utils/dataLoader';
import { Button } from '../ui/Button';

export function ShopMenu() {
  const { player, addItem, spendMoney, setView, inventory } = useGameStore();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);

  const items = getShopItems();

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
      setMessage(`Achat reussi !`);
      setTimeout(() => setMessage(null), 2000);
      useGameStore.getState().saveGameState();
    }
  };

  const setQty = (itemId: string, qty: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(1, Math.min(99, qty)) }));
  };

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ color: '#2196F3', fontSize: '14px', fontFamily: "'Press Start 2P', monospace", marginBottom: '8px', textAlign: 'center' }}>
        Boutique
      </h2>

      <div style={{ color: '#FFD600', fontSize: '11px', fontFamily: "'Press Start 2P', monospace", textAlign: 'center', marginBottom: '16px' }}>
        {player.money}P
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
        {items.map(item => {
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
                  onClick={() => setQty(item.id, qty - 1)}
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
                  onClick={() => setQty(item.id, qty + 1)}
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
        })}
      </div>

      <div style={{ marginTop: '16px' }}>
        <Button variant="ghost" onClick={() => setView('city_menu')}>
          Retour
        </Button>
      </div>
    </div>
  );
}
