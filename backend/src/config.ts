export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'interdimensional-commerce-secret-key-2024',
  jwtExpiresIn: '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  tickInterval: 3000,
  caravanSpeed: 0.5,
  baseInterestRate: 0.05,
  marketEventProbability: 0.05,
  attackBaseProbability: 0.1,
  spyBaseSuccessRate: 0.5,
};
