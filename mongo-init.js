db = db.getSiblingDB('dzo_pay');

// Create indexes for common queries
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ apiKey: 1 }, { unique: true, sparse: true });
db.users.createIndex({ phoneNumber: 1 }, { unique: true, sparse: true });

db.wallets.createIndex({ userId: 1 });
db.wallets.createIndex({ virtualAccountNumber: 1 }, { unique: true });
db.wallets.createIndex({ walletReference: 1 }, { unique: true });

db.transactions.createIndex({ walletId: 1, createdAt: -1 });
db.transactions.createIndex({ reference: 1 }, { unique: true });
db.transactions.createIndex({ status: 1 });
db.transactions.createIndex({ type: 1 });

db.auditlogs.createIndex({ userId: 1, createdAt: -1 });
db.auditlogs.createIndex({ action: 1 });

db.webhooklogs.createIndex({ webhookId: 1, createdAt: -1 });
db.webhooklogs.createIndex({ status: 1 });

db.otps.createIndex({ userId: 1, createdAt: -1 });
db.otps.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.subscriptions.createIndex({ userId: 1 });
db.subscriptions.createIndex({ status: 1 });

db.notifications.createIndex({ userId: 1, read: 1, createdAt: -1 });

db.apikeys.createIndex({ key: 1 }, { unique: true });
db.apikeys.createIndex({ userId: 1 });

print('Database initialized with indexes');
