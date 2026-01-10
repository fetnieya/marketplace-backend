# Instructions pour corriger l'erreur "max_allowed_packet"

## Problème
L'erreur `Got a packet bigger than 'max_allowed_packet' bytes` se produit quand la photo est trop grande pour MySQL.

## Solution : Augmenter max_allowed_packet dans MySQL/XAMPP

### Méthode 1 : Via SQL (temporaire)
1. Ouvrez phpMyAdmin ou MySQL Workbench
2. Connectez-vous à votre base de données
3. Exécutez cette commande :
```sql
SET GLOBAL max_allowed_packet = 67108864; -- 64 MB
```

**Note :** Cette modification est temporaire et sera perdue au redémarrage de MySQL.

### Méthode 2 : Via le fichier de configuration (permanent) - RECOMMANDÉ

#### Pour XAMPP :
1. Ouvrez le fichier : `C:\xampp\mysql\bin\my.ini`
2. Recherchez la section `[mysqld]`
3. Ajoutez ou modifiez cette ligne :
```ini
[mysqld]
max_allowed_packet = 64M
```
4. Sauvegardez le fichier
5. Redémarrez MySQL dans XAMPP (arrêtez puis démarrez le service MySQL)

#### Pour MySQL standalone :
1. Ouvrez le fichier `my.ini` (Windows) ou `my.cnf` (Linux/Mac)
   - Windows : `C:\ProgramData\MySQL\MySQL Server X.X\my.ini`
   - Linux : `/etc/mysql/my.cnf` ou `/etc/my.cnf`
   - Mac : `/usr/local/mysql/my.cnf`
2. Dans la section `[mysqld]`, ajoutez :
```ini
max_allowed_packet = 64M
```
3. Redémarrez MySQL

### Vérifier la modification
Après redémarrage, exécutez :
```sql
SHOW VARIABLES LIKE 'max_allowed_packet';
```

Vous devriez voir une valeur d'au moins 67108864 (64 MB).

## Compression automatique des images

Le frontend compresse automatiquement les images :
- Redimensionnement à 800x800 pixels maximum
- Compression avec qualité 0.7
- Limite de 2 MB après compression
- Compression progressive si nécessaire

## Notes importantes

- **Sécurité** : N'augmentez pas trop la valeur (64 MB est suffisant)
- **Performance** : Des photos plus grandes peuvent ralentir les requêtes
- **Compression** : Le frontend compresse déjà les images avant l'envoi
