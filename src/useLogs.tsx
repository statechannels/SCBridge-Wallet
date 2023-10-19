import { useState, useEffect } from "react";
import { UI_UPDATE_PERIOD } from "./constants";
import { type IntermediaryCoordinator } from "../clients/IntermediaryClient";

export function useLogs(coordinator: IntermediaryCoordinator): [string[]] {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = coordinator.getLogsTail();
      const newLogs = [];
      for (let i = 0; i < updated.length; i++) {
        newLogs.push(updated[i]);
      }
      setLogs(newLogs);
    }, UI_UPDATE_PERIOD);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return [logs];
}
