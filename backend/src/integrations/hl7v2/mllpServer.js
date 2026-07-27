import net from "net";
import { parseHl7Message, buildAck } from "./hl7Parser.js";
import { handleAdtMessage, handleOruMessage, logHl7Audit } from "./hl7Handlers.js";

const VT = 0x0b; // <VT> start block
const FS = 0x1c; // <FS> end block
const CR = 0x0d; // <CR>

export function startMllpServer(io, port = 2575) {
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);

    socket.on("data", async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      const startIdx = buffer.indexOf(VT);
      const endIdx = buffer.indexOf(Buffer.from([FS, CR]));
      if (startIdx === -1 || endIdx === -1) return;

      const raw = buffer.slice(startIdx + 1, endIdx).toString("utf-8");
      buffer = buffer.slice(endIdx + 2);

      let ack;
      try {
        const msg = parseHl7Message(raw);
        const [group] = msg.messageType.split("^");

        let result;
        if (group === "ADT") result = await handleAdtMessage(msg, io);
        else if (group === "ORU") result = await handleOruMessage(msg, io);
        else result = { ok: false, reason: `unsupported message type ${msg.messageType}` };

        await logHl7Audit(`hl7.${msg.messageType}`, result, result.ok !== false);
        ack = buildAck(msg, result.ok === false ? "AE" : "AA", result.ok === false ? result.reason : "");
      } catch (err) {
        await logHl7Audit("hl7.parse_error", { raw: raw.slice(0, 200) }, false, err.message);
        ack = `MSH|^~\\&|PULSEFLOW|ED|||||ACK|${Date.now()}|P|2.5.1\rMSA|AE||${err.message}\r`;
      }

      socket.write(Buffer.concat([Buffer.from([VT]), Buffer.from(ack, "utf-8"), Buffer.from([FS, CR])]));
    });

    socket.on("error", () => socket.destroy());
  });

  server.listen(port, () => console.log(`HL7v2 MLLP listener on :${port}`));
  return () => server.close();
}
