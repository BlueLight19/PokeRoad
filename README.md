# 🌟 PokeRoad

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)

**PokeRoad** est un jeu de rôle (RPG) Pokémon jouable entièrement sur navigateur. Développé en React et TypeScript, il propose une aventure solo dans la région de Kanto avec un moteur de combat fidèle aux mécaniques de la 9ème génération.

---

## 🎮 Aperçu du jeu

- **Région actuelle :** Kanto (Gen 1) avec 58 zones explorables (villes, routes, donjons).
- **Pokémon disponibles :** Les 151 Pokémon originaux.
- **Capacités :** 919 attaques en base de données, prêtes pour les futures générations.
- **Langue :** Entièrement en français.

Le jeu fonctionne avec un système de cache local (IndexedDB) : une fois les données chargées depuis Supabase, **le jeu peut fonctionner hors-ligne**.

---

## ✨ Fonctionnalités Principales

- 🗺️ **Exploration :** Débloquez les 58 zones progressivement grâce aux badges et événements.
- ⚔️ **Combats & Arènes :** Affrontez les dresseurs, les 8 champions d'arène de Kanto, et le Conseil des 4 (Ligue Pokémon).
- 🐾 **Capture & Équipe :** Rencontres sauvages variées (hautes herbes, eau, grottes), gestion de l'équipe de 6 et stockage PC (30 boîtes).
- 🎒 **Inventaire & Boutiques :** Objets tenus (Restes, Orbe Vie, etc.), boutiques évolutives, et Parc Safari.
- ✨ **Bonus :** Quête secrète pour Mew, Pokémon Chromatiques (Shiny - 1/4096), et vitesse de jeu réglable (1x, 2x, 4x).

---

## ⚙️ Moteur de Combat (Gen 9)

Le système de combat est conçu pour être compétitif et précis :
- **Formule de dégâts :** Basée sur la 9ème génération, incluant le STAB, l'efficacité des types, la météo, les coups critiques, etc.
- **Statuts & Effets :** Gestion complète des altérations d'état (Paralysie, Sommeil, Toxik...) et de plus de 20 effets volatils (Confusion, Clonage, Provoc...).
- **Terrain & Météo :** Pluie, Zénith, Grêle, Tempête de Sable, ainsi que les Entry Hazards (Piège de Roc, Picots, Toile Gluante...).
- **IA Intelligente :** Sélection des attaques basée sur les affinités de types et la prise en compte des effets comme Provoc ou Encore.

---

## 🛠️ Stack Technique & Architecture

| Couche | Technologie |
|--------|-------------|
| **Frontend** | React 19, TypeScript, Vite |
| **State Management** | Zustand (`gameStore` + `battleStore`) |
| **Backend / DB** | Supabase (PostgreSQL) |
| **Cache Local** | IndexedDB (via `idb`) |
| **Audio** | Web Audio API (Sons synthétisés) |

**Flux des données :** `Supabase` ➡️ `IndexedDB` ➡️ `Mémoire RAM (Map)` ➡️ `React (Zustand)`.

---

## 🚀 Installation & Développement

1. **Cloner et installer les dépendances :**
   ```bash
   npm install
