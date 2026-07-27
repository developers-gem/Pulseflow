import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import app from "./app.js";
import { startSimulation } from "./utils/simulation.js";
import { startMllpServer } from "./integrations/hl7v2/mllpServer.js";
import { registerAllSubscriptions } from "./integrations/fhir/fhirSubscription.js";

const PORT = process.env.PORT || 4000;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || "*" },
  });
  app.set("io", io);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
  });

  const stopSimulation = startSimulation(io, Number(process.env.SIMULATION_TICK_MS) || 4000);
  const stopMllp = startMllpServer(io, Number(process.env.HL7_MLLP_PORT) || 2575);

  server.listen(PORT, () => console.log(`PulseFlow backend listening on :${PORT}`));

  // Automatic FHIR ingestion: registers a Subscription with the FHIR server
  // so it calls our webhook the instant a Patient/Encounter/Observation
  // changes — no manual search-and-import needed. Requires a publicly
  // reachable webhook URL (e.g. via ngrok in dev), so it's opt-in.
  if (process.env.FHIR_AUTO_SUBSCRIBE === "true") {
    if (!process.env.FHIR_WEBHOOK_BASE_URL || !process.env.FHIR_WEBHOOK_SECRET) {
      console.warn("FHIR_AUTO_SUBSCRIBE is true but FHIR_WEBHOOK_BASE_URL or FHIR_WEBHOOK_SECRET is missing — skipping subscription registration.");
    } else {
      registerAllSubscriptions({
        webhookBaseUrl: process.env.FHIR_WEBHOOK_BASE_URL,
        secret: process.env.FHIR_WEBHOOK_SECRET,
      }).catch((err) => console.error("FHIR subscription registration failed:", err.message));
    }
  }

  process.on("SIGINT", () => {
    stopSimulation();
    stopMllp();
    server.close(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
