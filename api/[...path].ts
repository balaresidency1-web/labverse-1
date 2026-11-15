import { app } from '../server';

// Route every /api/* request through the existing Express application.
// Vercel provides the request/response objects; Express handles parsing and routing.
export default app;
