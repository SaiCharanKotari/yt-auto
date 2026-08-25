import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// import mongoose from 'mongoose'; // MongoDB disabled

// MongoDB Connection (disabled)
// const MONGODB_URI = process.env.MONGODB_URI || '...';
// mongoose.connect(MONGODB_URI)
//   .then(() => console.log(`[DB] Successfully connected to MongoDB.`))
//   .catch((err) => console.error(`[DB] MongoDB connection error:`, err));
import { createServer } from 'http';
import { SocketService } from './services/socket.service';
import videoRoutes from './routes/video.routes';
// import authRoutes from './routes/auth.routes';     // disabled — requires MongoDB
// import accountRoutes from './routes/accounts.routes'; // disabled — requires MongoDB
// import settingsRoutes from './routes/settings.routes'; // disabled — requires MongoDB

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// MongoDB Connection (disabled — uncomment to re-enable)
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://...';
// console.log(`[DB] Attempting to connect to MongoDB...`);
// mongoose.connect(MONGODB_URI)
//   .then(() => console.log(`[DB] Successfully connected to MongoDB.`))
//   .catch((err) => console.error(`[DB] MongoDB connection error:`, err));

const httpServer = createServer(app);
SocketService.initialize(httpServer);

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

app.use('/api/video', videoRoutes);
// app.use('/api/auth', authRoutes);       // disabled — requires MongoDB
// app.use('/api/accounts', accountRoutes); // disabled — requires MongoDB
// app.use('/api/settings', settingsRoutes); // disabled — requires MongoDB

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

httpServer.listen(port, () => {
  console.log(`[Server] Server is running on port ${port}`);
});
