import React, { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getCityShopItems, getShopItems, getItemData } from '../../utils/dataLoader';
import { Button } from '../ui/Button';
import { soundManager } from '../../utils/SoundManager';
import { theme } from '../../theme';

export function ShopMenu() {
  const { player, addItem, removeItem, spendMoney, addMoney, setView, inventory, selectedZone, sellItemAction } = useGameStore();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [view, setShopView] = useState<'buy' | 'sell'>('buy');

  const items = selectedZone ? getCityShopItems(selectedZone) : getShopItems();
  const sellableInventory = inventory.filter(invItem => {
    try {
      const itemData = getItemData(invItem.itemId);
      return itemData && itemData.price > 0;
    } catch { return false; }
  });

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 2000);
  };

  const handleBuy = (itemId: string, price: number) => {
    const qty = quantities[itemId] || 1;
    const total = price * qty;
    if (player.money < total) {
      showMessage('Pas assez d\'argent !', 'error');
      return;
    }
    if (spendMoney(total)) {
      addItem(itemId, qty);
      showMessage('Achat reussi !');
      useGameStore.getState().saveGameState();
    }
  };

  const handleSell = (itemId: string, price: number) => {
    if (price <= 0) {
      showMessage('Cet objet ne peut pas etre vendu !', 'error');
      return;
    }
    const qty = quantities[itemId] || 1;
    const sellPrice = Math.floor(price / 2);
    sellItemAction(itemId, qty);
    showMessage(`Vente reussie pour ${sellPrice * qty}P !`);
  };

  const setQty = (itemId: string, qty: number, max: number = 99) => {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(1, Math.min(max, qty)) }));
  };

  // Quantity stepper component
  const QtyStepper = ({ itemId, max = 99 }: { itemId: string; max?: number }) => {
    const qty = quantities[itemId] || 1;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2px',
        background: `${theme.colors.deepBg}`,
        borderRadius: `${theme.radius.sm}px`,
        border: theme.borders.thin(theme.colors.borderDark),
        padding: '2px',
      }}>
        <button
          onClick={() => { soundManager.playClick(); setQty(itemId, qty - 1, max); }}
          style={{
            width: '26px', height: '26px',
            background: 'none', border: 'none',
            color: qty <= 1 ? theme.colors.borderDark : theme.colors.textMuted,
            cursor: qty <= 1 ? 'default' : 'pointer',
            fontSize: '14px', fontFamily: theme.font.family,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: `${theme.radius.sm}px`,
          }}
        >
          -
        </button>
        <span style={{
          color: theme.colors.textPrimary,
          fontSize: theme.font.sm,
          fontFamily: theme.font.family,
          minWidth: '26px', textAlign: 'center',
        }}>
          {qty}
        </span>
        <button
          onClick={() => { soundManager.playClick(); setQty(itemId, qty + 1, max); }}
          style={{
            width: '26px', height: '26px',
            background: 'none', border: 'none',
            color: qty >= max ? theme.colors.borderDark : theme.colors.textMuted,
            cursor: qty >= max ? 'default' : 'pointer',
            fontSize: '14px', fontFamily: theme.font.family,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: `${theme.radius.sm}px`,
          }}
        >
          +
        </button>
      </div>
    );
  };

  return (
    <div style={{ padding: `${theme.spacing.xl}px`, maxWidth: '500px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: `${theme.spacing.lg}px` }}>
        <div style={{
          width: '48px', height: '48px',
          margin: '0 auto 10px',
          borderRadius: theme.radius.round,
          background: `linear-gradient(135deg, ${theme.colors.info}22, ${theme.colors.info}08)`,
          border: `2px solid ${theme.colors.info}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="8" width="16" height="13" rx="2" stroke={theme.colors.info} strokeWidth="1.5" fill={`${theme.colors.info}15`} />
            <path d="M4 10L6 5h12l2 5" stroke={theme.colors.info} strokeWidth="1.5" fill="none" />
            <circle cx="12" cy="15" r="2.5" stroke={theme.colors.info} strokeWidth="1.2" fill="none" />
          </svg>
        </div>
        <h2 style={{
          color: theme.colors.info,
          fontSize: theme.font.hero,
          fontFamily: theme.font.family,
          margin: 0,
        }}>
          Boutique
        </h2>
        <div style={{
          width: '40px', height: '2px',
          background: `linear-gradient(90deg, transparent, ${theme.colors.info}, transparent)`,
          margin: '8px auto 0',
        }} />
      </div>

      {/* Money display */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: `${theme.spacing.sm}px`,
        padding: '8px 16px',
        background: `${theme.colors.gold}0a`,
        border: theme.borders.thin(`${theme.colors.gold}33`),
        borderRadius: `${theme.radius.md}px`,
        marginBottom: `${theme.spacing.lg}px`,
      }}>
        <span style={{ color: theme.colors.gold, fontSize: theme.font.xl, fontFamily: theme.font.family }}>
          {player.money.toLocaleString()} P
        </span>
      </div>

      {/* Buy / Sell tabs */}
      <div style={{
        display: 'flex', gap: '4px',
        marginBottom: `${theme.spacing.lg}px`,
        background: theme.colors.deepBg,
        borderRadius: `${theme.radius.md}px`,
        padding: '3px',
        border: theme.borders.thin(theme.colors.borderDark),
      }}>
        {(['buy', 'sell'] as const).map(tab => {
          const isActive = view === tab;
          return (
            <button
              key={tab}
              onClick={() => { soundManager.playClick(); setShopView(tab); }}
              style={{
                flex: 1,
                padding: '8px 0',
                background: isActive
                  ? `linear-gradient(180deg, ${tab === 'buy' ? theme.colors.success : theme.colors.danger}, ${tab === 'buy' ? theme.colors.successDark : theme.colors.dangerDark})`
                  : 'transparent',
                border: 'none',
                borderRadius: `${theme.radius.sm}px`,
                color: isActive ? theme.colors.textPrimary : theme.colors.textDim,
                fontSize: theme.font.md,
                fontFamily: theme.font.family,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? theme.shadows.button3d(tab === 'buy' ? theme.colors.successDarker : theme.colors.dangerDarker) : 'none',
              }}
            >
              {tab === 'buy' ? 'Acheter' : 'Vendre'}
            </button>
          );
        })}
      </div>

      {/* Feedback message */}
      {message && (
        <div style={{
          color: messageType === 'success' ? theme.colors.success : theme.colors.danger,
          fontSize: theme.font.sm,
          fontFamily: theme.font.family,
          textAlign: 'center',
          padding: `${theme.spacing.sm}px`,
          marginBottom: `${theme.spacing.sm}px`,
          background: messageType === 'success' ? `${theme.colors.success}0c` : `${theme.colors.danger}0c`,
          border: theme.borders.thin(messageType === 'success' ? `${theme.colors.success}33` : `${theme.colors.danger}33`),
          borderRadius: `${theme.radius.sm}px`,
          animation: 'fadeIn 0.2s ease',
        }}>
          {message}
        </div>
      )}

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {view === 'buy' ? (
          items.length === 0 ? (
            <div style={{ color: theme.colors.textDimmer, fontSize: theme.font.sm, fontFamily: theme.font.family, textAlign: 'center', padding: '30px' }}>
              Boutique vide.
            </div>
          ) : (
            items.map(item => {
              const qty = quantities[item.id] || 1;
              const total = item.price * qty;
              const canAfford = player.money >= total;
              const owned = inventory.find(i => i.itemId === item.id)?.quantity || 0;

              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  background: `linear-gradient(135deg, ${theme.colors.navyBg}cc 0%, ${theme.colors.deepBg} 100%)`,
                  border: theme.borders.thin(theme.colors.borderDark),
                  borderLeft: `3px solid ${canAfford ? theme.colors.info : theme.colors.borderDark}`,
                  borderRadius: `${theme.radius.md}px`,
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.sm, fontFamily: theme.font.family }}>
                        {item.name}
                      </span>
                      {owned > 0 && (
                        <span style={{
                          color: theme.colors.textDimmer, fontSize: theme.font.micro, fontFamily: theme.font.family,
                          background: `${theme.colors.borderDark}44`, padding: '1px 5px',
                          borderRadius: '3px',
                        }}>
                          x{owned}
                        </span>
                      )}
                    </div>
                    <div style={{ color: theme.colors.textDim, fontSize: '6px', fontFamily: theme.font.family, marginTop: '3px', lineHeight: '1.4' }}>
                      {item.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ color: theme.colors.gold, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                        {item.price}P
                      </span>
                      {qty > 1 && (
                        <span style={{ color: theme.colors.textDimmer, fontSize: theme.font.micro, fontFamily: theme.font.family }}>
                          Total: {total}P
                        </span>
                      )}
                    </div>
                  </div>

                  <QtyStepper itemId={item.id} />

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleBuy(item.id, item.price)}
                    disabled={!canAfford}
                    style={{ flexShrink: 0 }}
                  >
                    Acheter
                  </Button>
                </div>
              );
            })
          )
        ) : (
          sellableInventory.length === 0 ? (
            <div style={{ color: theme.colors.textDimmer, fontSize: theme.font.sm, fontFamily: theme.font.family, textAlign: 'center', padding: '30px' }}>
              Rien a vendre.
            </div>
          ) : (
            sellableInventory.map(invItem => {
              const item = getItemData(invItem.itemId);
              if (!item) return null;
              const qty = quantities[invItem.itemId] || 1;
              const sellPrice = Math.floor(item.price / 2);

              return (
                <div key={invItem.itemId} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  background: `linear-gradient(135deg, ${theme.colors.navyBg}cc 0%, ${theme.colors.deepBg} 100%)`,
                  border: theme.borders.thin(theme.colors.borderDark),
                  borderLeft: `3px solid ${theme.colors.danger}44`,
                  borderRadius: `${theme.radius.md}px`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.sm, fontFamily: theme.font.family }}>
                        {item.name}
                      </span>
                      <span style={{
                        color: theme.colors.textDimmer, fontSize: theme.font.micro, fontFamily: theme.font.family,
                        background: `${theme.colors.borderDark}44`, padding: '1px 5px',
                        borderRadius: '3px',
                      }}>
                        x{invItem.quantity}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <span style={{ color: theme.colors.gold, fontSize: theme.font.xs, fontFamily: theme.font.family }}>
                        {sellPrice}P/u
                      </span>
                      {qty > 1 && (
                        <span style={{ color: theme.colors.textDimmer, fontSize: theme.font.micro, fontFamily: theme.font.family }}>
                          Total: {sellPrice * qty}P
                        </span>
                      )}
                    </div>
                  </div>

                  <QtyStepper itemId={invItem.itemId} max={invItem.quantity} />

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleSell(invItem.itemId, item.price)}
                    style={{ flexShrink: 0 }}
                  >
                    Vendre
                  </Button>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Back button */}
      <div style={{ marginTop: `${theme.spacing.xl}px`, textAlign: 'center' }}>
        <Button variant="ghost" onClick={() => setView('city_menu')}>
          Retour
        </Button>
      </div>
    </div>
  );
}
