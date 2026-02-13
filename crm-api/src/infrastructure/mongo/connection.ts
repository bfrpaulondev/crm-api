import { MongoClient, MongoClientOptions, Db } from 'mongodb';
import { config } from '@/config/index.js';
import { logger } from '@/infrastructure/logging/index.js';

// Cliente MongoDB global
let client: MongoClient | null = null;
let db: Db | null = null;

// Opções de conexão
const mongoOptions: MongoClientOptions = {
  maxPoolSize: config.MONGODB_POOL_SIZE,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
  retryReads: true,
};

/**
 * Conectar ao MongoDB
 * Usa padrão Singleton para reutilizar conexão
 */
export async function connectToMongo(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(config.MONGODB_URI, mongoOptions);

    await client.connect();

    db = client.db(config.MONGODB_DB_NAME);

    // Log de sucesso
    logger.info('MongoDB connected successfully', {
      database: config.MONGODB_DB_NAME,
      poolSize: config.MONGODB_POOL_SIZE,
    });

    // Eventos de monitorização
    client.on('connectionPoolCreated', (event) => {
      logger.debug('MongoDB connection pool created', { event });
    });

    client.on('connectionCreated', (event) => {
      logger.debug('MongoDB connection created', { connectionId: event.connectionId });
    });

    client.on('connectionClosed', (event) => {
      logger.debug('MongoDB connection closed', { connectionId: event.connectionId });
    });

    return db;
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error: String(error) });
    throw error;
  }
}

/**
 * Obter instância da base de dados
 */
export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectToMongo() first.');
  }
  return db;
}

/**
 * Obter cliente MongoDB (para transações)
 */
export function getClient(): MongoClient {
  if (!client) {
    throw new Error('MongoDB not connected. Call connectToMongo() first.');
  }
  return client;
}

/**
 * Fechar conexão (para graceful shutdown)
 */
export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB connection closed');
  }
}

/**
 * Health check do MongoDB
 */
export async function mongoHealthCheck(): Promise<boolean> {
  try {
    if (!db) return false;

    const result = await db.command({ ping: 1 });
    return result.ok === 1;
  } catch {
    return false;
  }
}
