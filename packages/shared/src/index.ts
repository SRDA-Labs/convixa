export type ServiceHealth = {
  service: string;
  status: "ok" | "degraded" | "down";
  timestamp: string;
};

export function createHealth(service: string, status: ServiceHealth["status"] = "ok"): ServiceHealth {
  return {
    service,
    status,
    timestamp: new Date().toISOString(),
  };
}

export function log(service: string, message: string): void {
  // Simple structured log for playground services
  console.log(JSON.stringify({ service, message, at: new Date().toISOString() }));
}
