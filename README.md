🌐 LE BUG // SYNC_BREACH
Un runner 3D minimaliste et procédural. Incarnez un nœud de données naviguant à travers des secteurs corrompus, gérez votre niveau d'infection et survivez à l'instabilité du système.

🕹️ Commandes
Le jeu est optimisé pour Desktop et Mobile.

Ligne : Flèches Gauche/Droite (PC) ou Glisser (Mobile).

Gravité (Flip) : Touche Espace (PC) ou Double Tap (Mobile).

Audio : Touche M pour couper/activer le son.

🛠️ Mécaniques
Secteurs : Collectez 50 bits pour sauter au secteur suivant. La vitesse et les couleurs s'adaptent.

Le Fork : L'entité Magenta dédouble votre processus. Le second nœud peut collecter des données mais disparaît s'il touche un obstacle.

Portes Logiques : * NOT (Magenta) : Inverse votre position.

AND (Verte) : Requiert 5 bits pour passer, sinon crash du système.

🏗️ Structure
js/main.js : Moteur principal et collisions.

js/audioEngine.js : Synthèse sonore procédurale.

js/Game.js : État global et secteurs.

js/ui.js & js/boot.js : Interface et séquence de boot.

🚀 Lancement
Le jeu utilise des modules ES6 et nécessite un serveur local :

Bash
python -m http.server 8000
Ouvrez http://localhost:8000 dans votre navigateur.

Système instable. Bonne chance.