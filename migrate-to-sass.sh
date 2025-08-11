#!/bin/bash

echo "🔄 Migration de node-sass vers sass..."

# Sauvegarder le package.json actuel
cp package.json package.json.backup
echo "✅ Sauvegarde du package.json créée"

# Supprimer node_modules et package-lock.json
echo "🗑️  Suppression de node_modules et package-lock.json..."
rm -rf node_modules
rm -f package-lock.json

# Modifier le package.json pour utiliser sass au lieu de node-sass
echo "📝 Modification du package.json..."
sed -i 's/"node-sass": "[^"]*"/"sass": "^1.77.0"/' package.json
sed -i 's/"sass-loader": "[^"]*"/"sass-loader": "^8.0.2"/' package.json

echo "📦 Installation des nouvelles dépendances..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Installation réussie !"
    echo "🏗️  Compilation du projet..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "🎉 Migration terminée avec succès !"
        echo "✅ Le projet a été compilé dans le dossier docs/"
    else
        echo "❌ Erreur lors de la compilation"
        exit 1
    fi
else
    echo "❌ Erreur lors de l'installation des dépendances"
    echo "🔄 Restauration du package.json original..."
    cp package.json.backup package.json
    exit 1
fi
