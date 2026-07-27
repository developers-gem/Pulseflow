import AuditLog from "../models/AuditLog.js";

// Wraps a route handler and writes an audit entry regardless of outcome.
export function withAudit(action, resourceType, handler) {
  return async (req, res, next) => {
    let statusCapture = 200;
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      statusCapture = res.statusCode;
      return originalJson(body);
    };

    try {
      await handler(req, res, next);
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email,
        action,
        resourceType,
        resourceId: req.params?.id || req.params?.fhirId || req.body?.patientId,
        sourceSystem: req.body?.sourceSystem || undefined,
        ip: req.ip,
        success: statusCapture < 400,
      });
    } catch (err) {
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email,
        action,
        resourceType,
        resourceId: req.params?.id || req.params?.fhirId,
        ip: req.ip,
        success: false,
        error: err.message,
      });
      next(err);
    }
  };
}
