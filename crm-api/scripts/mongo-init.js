// MongoDB Initialization Script
// Cria bases de dados, utilizadores e índices iniciais

db = db.getSiblingDB('crm_api');

// Criar utilizador da aplicação
db.createUser({
  user: 'crm_app',
  pwd: 'crm_app_password_dev',
  roles: [
    { role: 'readWrite', db: 'crm_api' }
  ]
});

// Criar coleções (opcional - MongoDB cria automaticamente)
db.createCollection('leads');
db.createCollection('contacts');
db.createCollection('accounts');
db.createCollection('opportunities');
db.createCollection('stages');
db.createCollection('activities');
db.createCollection('notes');
db.createCollection('audit_logs');
db.createCollection('users');
db.createCollection('tenants');
db.createCollection('attachments');

print('MongoDB initialization completed!');
