// Minimal HL7v2 pipe-delimited parser — enough for ADT and ORU messages.
// No external dependency; HL7v2's wire format is simple enough to hand-roll
// safely for the segments we care about.

export function parseHl7Message(raw) {
  const segments = raw.split(/\r\n|\r|\n/).filter(Boolean);
  const parsed = segments.map((line) => {
    const fields = line.split("|");
    return { id: fields[0], fields };
  });

  const msh = parsed.find((s) => s.id === "MSH");
  const messageType = msh?.fields[8] || ""; // e.g. "ADT^A01" or "ORU^R01"
  const controlId = msh?.fields[9] || "";

  return {
    messageType,
    controlId,
    segments: parsed,
    get(segId, index) {
      const seg = parsed.find((s) => s.id === segId);
      return seg?.fields[index];
    },
    getAll(segId) {
      return parsed.filter((s) => s.id === segId);
    },
  };
}

export function buildAck(parsedMsg, ackCode = "AA", errorText = "") {
  const now = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const controlId = `ACK${Date.now()}`;
  const msh = `MSH|^~\\&|PULSEFLOW|ED|SENDER|HOSPITAL|${now}||ACK^${parsedMsg.messageType.split("^")[1] || ""}|${controlId}|P|2.5.1`;
  const msa = `MSA|${ackCode}|${parsedMsg.controlId}${errorText ? `|${errorText}` : ""}`;
  return `${msh}\r${msa}\r`;
}
