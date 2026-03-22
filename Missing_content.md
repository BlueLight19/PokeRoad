## 1. 🧬 Les Talents (Abilities) manquants

Ton système de _hooks_ gère très bien les boosts de dégâts, les statuts et la météo. Voici ce qu'il manque au niveau des talents plus "exotiques" :

-   **Les Talents de Priorité :** _Farceur (Prankster)_ (donne +1 de priorité aux attaques de statut) ou _Ailes Bourrasque (Gale Wings)_. Ton calcul d'ordre de tour (`determineOrder`) lit directement la base de données de l'attaque, il ne vérifie pas encore si un talent modifie cette priorité.
    
-   **Les Talents de changement de Type :** _Protéen (Protean)_ ou _Libéro_. Il faudrait modifier le type du lanceur juste avant l'exécution de l'attaque pour appliquer le STAB.
    
-   **Les Talents "Miroir" et "Garde" :** _Miroir Magik (Magic Bounce)_ (qui renvoie les altérations d'état et Entry Hazards) et _Garde Magik (Magic Guard)_ (qui annule TOUS les dégâts indirects : recul, poison, tempête de sable, vampigraine).
    
-   **Les Talents de copie :** _Calque (Trace)_ qui copie le talent adverse au Switch-in, ou _Momie (Mummy)_ qui remplace le talent adverse au contact.
    
-   **Les Talents de blocage (Trapping) :** _Marque Ombre (Shadow Tag)_, _Piège Sable (Arena Trap)_ ou _Magnépiège (Magnet Pull)_. Actuellement ton code vérifie si le Pokémon est bloqué par _Regard Noir_ (`volatile.trapped`), mais pas par le talent de l'adversaire.
    
-   **Les Transformations :** _Illusion (Zoroark)_, _Fantômasque (Mimikyu)_, ou _Météo (Morphéo)_. Cela demande de manipuler l'affichage de l'UI et les stats dynamiquement.
    

## 2. ⚔️ Les Capacités (Moves) manquantes

Tu as déjà fait le plus dur (attaques à charge, à recul, multi-coups, OHKO, Dégâts fixes). Voici les trous dans la raquette :

-   **Le contrôle des Entry Hazards :** Tu as codé les Pièges de Roc et les Picots, mais il n'y a pas de moyen de les enlever ! Il manque la logique pour _Tour Rapide (Rapid Spin)_ et _Anti-Brume (Defog)_.
    
-   **Les attaques de "Pivot" :** _Demi-Tour (U-Turn)_, _Change Éclair (Volt Switch)_, _Eau Revoir (Flip Turn)_. C'est l'un des plus gros morceaux manquants : forcer l'ouverture du menu de switch de l'équipe alliée **après** avoir infligé les dégâts.
    
-   **Le Relais (Baton Pass) :** Permettre de switcher tout en transférant les changements de statistiques (`statStages`) et certains statuts volatils (Clonage, Vampigraine, Anneau Hydro) au Pokémon entrant.
    
-   **La manipulation d'objets :** * _Sabotage (Knock Off)_ : Retire définitivement l'objet de l'adversaire (+ bonus de dégâts).
    
    -   _Tour de Magie (Trick)_ / _Passe-Passe (Switcheroo)_ : Échange les objets tenus entre les deux Pokémon.
        
-   **La copie et transformation :** _Morphing (Transform)_ (copie les stats, le type et les attaques de l'adversaire) et _Gribouille (Sketch)_.
    
-   **Faux-Chage (False Swipe) :** Une attaque absolument cruciale pour ton jeu s'il y a de la capture ! Il faut forcer les dégâts pour que le défenseur reste à minimum 1 PV.
    
-   **Provoc (Taunt) et Encore :** Tu les as implémentées dans le blocage d'attaque, mais l'IA ne sait pas encore les gérer correctement si elle est bloquée sur une attaque qu'elle ne peut plus lancer.
    

## 3. 🎒 Les Objets (Items) tenus manquants

Je vois que tu as commencé à gérer l'Orbe Flamme, les Restes, le Casque Brut ou le Mouchoir Choix. Voici ce qui manque dans la logique des objets :

-   **Le verrouillage des Objets "Choix" :** Tu appliques le boost de stat du _Bandeau Choix / Lunettes Choix_, mais il manque la mécanique de restriction : le Pokémon doit être obligé de n'utiliser que la première attaque qu'il a cliquée tant qu'il ne switche pas. (Il faudra ajouter un champ `volatile.choiceLock` dans le state).
    
-   **La Veste de Combat (Assault Vest) :** Augmente la défense spéciale, mais bloque l'utilisation de toutes les capacités de catégorie 'status'.
    
-   **L'Évoluroc (Eviolite) :** Augmente de 50% la Def et Def Spé, mais il faut une logique pour vérifier si le Pokémon peut encore évoluer (vérifier ta base de données d'évolutions en temps réel).
    
-   **Les objets à consommation unique (Usage auto) :**
    
    -   _Herbe Pouvoir (Power Herb)_ : Saute le tour de charge de Lance-Soleil et se consomme.
        
    -   _Herbe Blanche (White Herb)_ : Restaure les stats si elles baissent en dessous de 0, et se consomme.
        
    -   _Baies de résistance (Occa, Passho, etc.)_ : Divisent par 2 les dégâts d'une attaque super efficace une seule fois, puis disparaissent.
        
    -   _Ballon (Air Balloon)_ : Rend immunisé aux attaques Sol. Si le Pokémon est touché par une attaque, le ballon "éclate" (disparaît).
        
-   **Ceinture Force (Focus Sash) :** Tu l'as partiellement codée dans `battleEngine.ts` ("survive with 1 HP"), mais n'oublie pas qu'elle doit être **détruite/consommée** après utilisation si ce n'est pas un combat d'arène/ligue.
