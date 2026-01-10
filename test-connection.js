// Script de test de connexion MySQL
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    console.log('Tentative de connexion à MySQL...');
    console.log('Host: localhost');
    console.log('Port: 3306');
    console.log('User: root');
    console.log('Password: (vide)');
    console.log('Database: marketplacedb');
    console.log('---');
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'marketplacedb'
    });
    
    console.log('✅ Connexion réussie !');
    const [rows] = await connection.execute('SELECT DATABASE() as db');
    console.log('Base de données connectée:', rows[0].db);
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur de connexion:');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Solution: Vérifiez que MySQL est démarré dans XAMPP');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Solution: Vérifiez le nom d\'utilisateur et le mot de passe');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 Solution: La base de données n\'existe pas. Créez-la dans phpMyAdmin');
    }
    
    process.exit(1);
  }
}

testConnection();
