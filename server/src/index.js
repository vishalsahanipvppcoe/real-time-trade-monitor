import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check endpoint for scaffolding verification
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Arham Mock BSE Trade Engine',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});