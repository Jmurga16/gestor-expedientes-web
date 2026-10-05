export interface IHistorialDemandaList {
  id: number;
  usuario: string;
  paso: string;
  idPaso: string | null;
  estado: number;
  observaciones: string | null;
  fecha: string;
}
