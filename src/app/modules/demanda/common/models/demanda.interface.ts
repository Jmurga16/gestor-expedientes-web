import { IMessage } from '../../../../core/models/generic/message.interface';

export interface IDemanda {
  id: number;
  idUsuario: number;
  caratula: string;
  idTipoDemanda: number;
  idTipologia: number;
  idSubtipologia: number;
  domicilio: string;
  rutaImagen: string | null;
  informacionAdicional: string;
  paso: string;
  idPaso: string | null;
  urlBpmn: string;
  idsArea: number[];
  idAreaPaso: number | null;
  fechaCreacion: string;
  estado: number;
  version: number;
}

export interface IPermisosDemanda {
  mover: boolean;
  editar: boolean;
  eliminar: boolean;
  observar: boolean;
  reabrir: boolean;
}

export interface IMovimiento {
  paso: string;
  idPaso: string | null;
  estado: number;
  observaciones: string | null;
  version: number;
}

export interface IDemandaCreada extends IMessage {
  id: number;
}

export interface IDemandaList {
  id: number;
  caratula: string;
  demandante: string;
  dni: string;
  descripcion: string;
  informacionAdicional: string;
  paso: string;
  tipoDemanda: string;
  tipologia: string;
  subtipologia: string;
  estado: number;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}
