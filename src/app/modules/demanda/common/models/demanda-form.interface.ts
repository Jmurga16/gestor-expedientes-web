export interface IDemandaForm {
  id: number | null;
  caratula: string | null;
  idUsuario: number | null;
  idTipoDemanda: number | null;
  idTipologia: number | null;
  idSubtipologia: number | null;
  descripcion: string | null;
  domicilio: string | null;
  rutaImagen: string | null;
  informacionAdicional: string | null;
  paso: string;
  urlBpmn: string;
  observaciones?: string | null;
  estado: number;
  version?: number | null;
}
