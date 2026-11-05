import "server-only";
import type { Dataset } from "./types";
import { getSampleDataset } from "./sample-data";

// Capa de acceso a datos. Hoy devuelve el conjunto de EJEMPLO; cuando conectemos Supabase,
// esta función leerá las tablas reales y `isSample` será false.
export async function getDataset(): Promise<Dataset> {
  return getSampleDataset();
}
