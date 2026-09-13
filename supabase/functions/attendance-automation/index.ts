import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  handleAttendanceAutomationRequest,
  AttendanceAutomationDependencies
} from '../../../src/lib/attendanceAutomationHandler.ts';

export { handleAttendanceAutomationRequest };
export type { AttendanceAutomationDependencies };

export const defaultDeps: AttendanceAutomationDependencies = {
  getEnv: (key: string) => Deno.env.get(key),
  createClient: (url: string, key: string) => createClient(url, key) as any
};

export async function handleRequest(
  req: Request,
  customDeps?: Partial<AttendanceAutomationDependencies>
): Promise<Response> {
  const deps: AttendanceAutomationDependencies = {
    getEnv: customDeps?.getEnv || defaultDeps.getEnv,
    createClient: customDeps?.createClient || defaultDeps.createClient
  };
  return handleAttendanceAutomationRequest(req, deps);
}

if ((import.meta as any).main) {
  serve((req) => handleRequest(req));
}
