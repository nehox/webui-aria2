# Migration de node-sass vers sass

## Problème résolu

- Incompatibilité de node-sass avec Node.js v12.22.5
- Erreurs de compilation lors de npm install

## Solution appliquée

1. Remplacement de `node-sass ^4.9.3` par `sass ^1.77.0`
2. Mise à jour de `sass-loader` vers la version `^8.0.2`
3. Aucune modification nécessaire dans le code SCSS existant

## Instructions pour le serveur Linux

### Option 1 : Script automatique (recommandé)

```bash
cd /var/www/aria/webui-aria2
chmod +x migrate-to-sass.sh
./migrate-to-sass.sh
```

### Option 2 : Commandes manuelles

```bash
cd /var/www/aria/webui-aria2

# Sauvegarder
cp package.json package.json.backup

# Nettoyer
rm -rf node_modules
rm -f package-lock.json

# Copier le nouveau package.json depuis Windows ou modifier manuellement :
# Remplacer "node-sass": "^4.9.3" par "sass": "^1.77.0"
# Remplacer "sass-loader": "^7.1.0" par "sass-loader": "^8.0.2"

# Installer et compiler
npm install
npm run build
```

## Vérification

Après la migration, vérifiez que :

- `node_modules/sass` existe (au lieu de `node_modules/node-sass`)
- La compilation fonctionne : `npm run build`
- Les fichiers sont générés dans `docs/`
- Le style CSS est identique à avant

## Rollback en cas de problème

```bash
cp package.json.backup package.json
rm -rf node_modules
npm install
```
