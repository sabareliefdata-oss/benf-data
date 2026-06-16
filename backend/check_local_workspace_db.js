const sqlite3 = require('d:/pro/Benapp/backend/node_modules/sqlite3').verbose();

const dbPath = 'd:\\pro\\Benapp\\backend\\database.sqlite';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  db.get('SELECT COUNT(*) as count FROM beneficiaries', (err, row) => {
    if (err) {
      console.error('Error counting beneficiaries:', err);
    } else {
      console.log(`BENEFICIARIES COUNT: ${row ? row.count : 0}`);
    }
    
    db.close();
  });
});
