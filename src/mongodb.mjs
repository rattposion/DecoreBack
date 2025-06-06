import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

let client;

export async function connectToDatabase() {
  if (!client) {
    try {
      client = await MongoClient.connect(uri, options);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }
  return client;
}

export async function getReportsCollection() {
  const client = await connectToDatabase();
  return client.db("decore_db").collection('reports');
}

export async function closeConnection() {
  if (client) {
    await client.close();
    client = null;
    console.log('MongoDB connection closed');
  }
} 