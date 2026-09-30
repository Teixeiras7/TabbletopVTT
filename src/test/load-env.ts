import { config } from "dotenv";

// Testes de integração usam o banco real configurado em .env.local.
config({ path: ".env.local" });
