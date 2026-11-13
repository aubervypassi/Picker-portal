# Picker Portal v3 — Glovo Abidjan

Application PWA (React + TypeScript + Tailwind CSS + Lucide) de gestion opérationnelle des pickers des stores **ABN - Cocody** et **ABJ - Koumassi**.

## Base de données Supabase
- Identifiants : en haut de `src/lib/supabase.ts` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Le mapping des colonnes est dans ce même fichier.
- **Avant le premier lancement**, exécutez `supabase/schema.sql` dans *Supabase > SQL Editor* (non destructif : ajoute les colonnes manquantes, la fonction `verifier_pin`, les règles d'accès, le bucket photos et le temps réel).
- Au premier démarrage, si la table `pickers` est vide, l'application y injecte les 39 agents + le compte `admin` (mot de passe `Glovo2026`).
- Pour reprendre les données d'un ancien téléphone : ancienne version → Paramètres → Sauvegarder (JSON), puis nouvelle version → Paramètres → Restaurer.

## Déploiement Vercel
1. Poussez ce dossier sur GitHub (sans `node_modules`).
2. Vercel → *Add New Project* → importez le dépôt : Vite est détecté (`npm run build`, dossier `dist`, voir `vercel.json`).
3. Ouvrez l'URL https sur les téléphones → « Ajouter à l'écran d'accueil ».

## Développement
```bash
npm install
npm run dev     # serveur local
npm run build   # génère dist/index.html (fichier unique)
```

## Connexion
- **Super Admin (Niveau 4)** : identifiant `admin`, mot de passe `Glovo2026` (à changer dans Paramètres).
- **Store Manager (Niveau 3)** : comptes créés dans *Utilisateurs & Accès*, connexion par mot de passe (6 caractères min.).
- **Agents (Niveaux 1–2)** : ID Glovo + PIN 4 chiffres (*Utilisateurs & Accès* → Afficher / Fiches PDF).
- Une base v2 déjà utilisée est migrée automatiquement (pointages, rapports, PIN conservés ; l'ancien mot de passe admin devient celui du compte `admin`).

## Nouveautés v3
1. Badge **Glovo Express** dans le header (image configurable dans Paramètres, repli SVG).
2. Rattachement **Picker ↔ Picker Lead** (`leadId`), vue par Lead, équipes du planning déduites du Lead ; **modèle CSV** `Store;ID;Nom et Prenoms;Fonction;ID_Picker_Lead` sous le bouton d'import.
3. Planning : libellés `0800 - 1600`, `1600 - 0000`, `0000 - 0800`, `0800 - 1700`, `Repos`, `Congés`, `Absent` ; menu déroulant par cellule ; règle de nuit J = Repos / J+1 = 0000 - 0800 ; Hub Koumassi en 0800 - 1700 ; 2 repos/semaine à Koumassi ; brouillon / publication / export PDF-CSV ; vue mensuelle.
4. Formations : images et vidéos (fichier ou lien YouTube/MP4) par chapitre ; import .pptx/.docx avec extraction des images (ppt/media, word/media) et des vidéos ; cartes avec progression et certification.
5. Création de tout profil avec **niveaux d'habilitation 1 à 4**.

## Sécurité
L'application utilise la clé publique Supabase sans Supabase Auth : toute personne disposant de l'URL de l'application peut techniquement lire/écrire les tables via l'API (hors colonne `pin`, illisible). Pour un niveau de sécurité supérieur : Supabase Auth ou Edge Functions avec RLS par rôle.
