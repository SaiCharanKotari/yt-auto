import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { YouTubeAccount } from './src/models/YouTubeAccount';

dotenv.config();

async function checkDB() {
  const uri = process.env.MONGODB_URI || 'l';
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);

  const accounts = await YouTubeAccount.find({});
  console.log('Accounts in DB:', accounts);

  process.exit(0);
}

checkDB();
