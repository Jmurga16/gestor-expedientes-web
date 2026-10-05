import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { finalize, forkJoin } from 'rxjs';
import { DemandaService } from '../../common/services/demanda.service';
import { IDemanda, IPermisosDemanda } from '../../common/models/demanda.interface';
import { IHistorialDemandaList } from '../../common/models/historial-demanda-list.interface';
import { HistorialDemandaListModalComponent } from '../historial-demanda-list-modal/historial-demanda-list-modal.component';
import { IOpcion } from '../../../../shared/models/opcion.interface';
import { IPasoBpmn } from '../../../../shared/models/paso-bpmn.interface';
import { DataService } from '../../../../shared/services/data.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { ESTADO_FINALIZADO, ESTADOS_TERMINALES } from '../../../../shared/models/estado-expediente';
import { HistorialDemandaService } from '../../common/services/historial-demanda.service';

const PASO_INICIAL = 'Inicio';
const PASO_FINAL = 'Finalizado';
const SIN_PERMISOS: IPermisosDemanda = { mover: false, editar: false, eliminar: false, observar: false, reabrir: false };

interface IOpcionPaso extends IOpcion<string> {
  paso: string;
  idPaso: string | null;
}

interface IFormMovimiento {
  id: number;
  paso: string | null;
  estado: number;
  observaciones: string | null;
}

@Component({
  selector: 'app-demanda-workflow',
  templateUrl: './demanda-workflow.component.html',
  styleUrl: './demanda-workflow.component.scss'
})
export class DemandaWorkflowComponent implements OnInit {

  loading: boolean = false
  saving: boolean = false
  finalizada: boolean = false
  reabriendo = false;
  permisos: IPermisosDemanda = SIN_PERMISOS;
  pasoGuardado = '';
  idPasoGuardado: string | null = null;
  estadoGuardado = 1;
  version = 0;
  historial: IHistorialDemandaList[] = [];
  demandaForm: FormGroup;
  idDemanda?: number
  diagramUrl: string = ""
  pasosBpmn: IPasoBpmn[] = []
  listTask: IOpcionPaso[] = []
  estadosCatalogo: IOpcion[] = []
  listEstadosDemanda: IOpcion[] = []
  ref: DynamicDialogRef | undefined;

  constructor(
    private activatedRoute: ActivatedRoute,
    private demandaService: DemandaService,
    private router: Router,
    private formBuilder: FormBuilder,
    private dataService: DataService,
    private dialogService: DialogService,
    private loadingService: LoadingService,
    private notification: NotificationService,
    private historialService: HistorialDemandaService,
  ) {

    this.demandaForm = this.formBuilder.group({
      id: [null],
      paso: [null],
      estado: [1],
      observaciones: [null]
    });

  }

  get puedeMover(): boolean {
    return (this.permisos.mover && !this.finalizada) || this.reabriendo;
  }

  get puedeGuardar(): boolean {
    return this.puedeMover || this.permisos.observar;
  }

  get opcionGuardada(): string {
    if (this.idPasoGuardado)
      return this.idPasoGuardado;
    const porNombre = this.listTask.filter(opcion => opcion.paso === this.pasoGuardado);
    return porNombre.length === 1 ? porNombre[0].id : this.pasoGuardado;
  }

  ngOnInit(): void {
    this.demandaForm.disable();
    this.activatedRoute.params.subscribe(params => {
      this.idDemanda = params['id'];
      if (this.idDemanda) {
        this.getDemanda();
      }
    });

    this.getEstadosDemanda()
  }

  getDemanda(observaciones: string | null = null) {
    forkJoin({
      demanda: this.demandaService.getById(this.idDemanda!),
      permisos: this.demandaService.getPermisos(this.idDemanda!)
    }).subscribe({
      next: ({ demanda, permisos }) => {
        this.cargar(demanda, permisos, observaciones);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private cargar(demanda: IDemanda, permisos: IPermisosDemanda, observaciones: string | null) {
    this.permisos = permisos;
    this.reabriendo = false;
    this.diagramUrl = demanda.urlBpmn;
    this.pasoGuardado = demanda.paso;
    this.idPasoGuardado = demanda.idPaso ?? null;
    this.estadoGuardado = demanda.estado;
    this.version = demanda.version ?? 0;
    this.finalizada = ESTADOS_TERMINALES.includes(demanda.estado);
    this.actualizarOpciones();
    this.demandaForm.reset({ id: demanda.id, paso: this.opcionGuardada, estado: demanda.estado, observaciones });
    this.actualizarControles();
    this.historialService.get(demanda.id).subscribe({
      next: historial => this.historial = historial,
      error: () => this.historial = []
    });
  }

  private actualizarControles() {
    const movimiento = ['paso', 'estado'];
    movimiento.forEach(control => this.puedeMover
      ? this.demandaForm.get(control)?.enable()
      : this.demandaForm.get(control)?.disable());
    this.puedeGuardar
      ? this.demandaForm.get('observaciones')?.enable()
      : this.demandaForm.get('observaciones')?.disable();
  }

  private actualizarOpciones() {
    this.listEstadosDemanda = this.estadosCatalogo.filter(estado =>
      this.reabriendo
        ? !ESTADOS_TERMINALES.includes(estado.id)
        : estado.id !== ESTADO_FINALIZADO || this.estadoGuardado === ESTADO_FINALIZADO);

    const repetidos = new Set(this.pasosBpmn
      .filter((paso, i) => this.pasosBpmn.findIndex(otro => otro.nombre === paso.nombre) !== i)
      .map(paso => paso.nombre));
    const tareas: IOpcionPaso[] = this.pasosBpmn.map(paso => ({
      id: paso.id,
      paso: paso.nombre,
      idPaso: paso.id,
      nombre: repetidos.has(paso.nombre) ? `${paso.nombre} · ${paso.carril ?? paso.id}` : paso.nombre
    }));
    const virtual = (paso: string): IOpcionPaso => ({ id: paso, paso, idPaso: null, nombre: paso });
    this.listTask = [virtual(PASO_INICIAL), ...tareas, ...(this.reabriendo ? [] : [virtual(PASO_FINAL)])];
  }

  private opcion(id: string | null): IOpcionPaso | undefined {
    return this.listTask.find(item => item.id === id);
  }

  getEstadosDemanda() {
    this.dataService.getEstadosStep().subscribe({
      next: (response: IOpcion[]) => {
        this.estadosCatalogo = response;
        this.actualizarOpciones();
      }
    });
  }

  reabrir() {
    this.reabriendo = true;
    this.actualizarOpciones();
    this.demandaForm.patchValue({
      paso: this.pasoGuardado === PASO_FINAL ? null : this.opcionGuardada,
      estado: 3
    });
    this.actualizarControles();
  }

  cancelarReapertura() {
    this.reabriendo = false;
    this.actualizarOpciones();
    this.demandaForm.patchValue({ paso: this.opcionGuardada, estado: this.estadoGuardado });
    this.actualizarControles();
  }

  goToBack() {
    this.router.navigate(['../../list'], {
      relativeTo: this.activatedRoute
    });
  }

  validateForm(request: IFormMovimiento): boolean {
    let message: string = "";
    const motivo = !!request.observaciones?.trim();
    const destino = this.opcion(request.paso);

    if (!request.paso) {
      message = "El campo Paso es requerido."
    } else if (request.estado == null) {
      message = "El campo Estado es requerido."
    } else if (!destino) {
      message = 'Seleccione un paso del circuito BPMN.';
    } else if (!this.listEstadosDemanda.some(item => item.id === request.estado)) {
      message = 'Seleccione un estado válido.';
    } else if (destino.paso === PASO_FINAL && !ESTADOS_TERMINALES.includes(request.estado)) {
      message = 'El paso Finalizado requiere un estado de cierre.';
    } else if (this.reabriendo && !motivo) {
      message = 'Indique en Observaciones el motivo de la reapertura.';
    } else if (ESTADOS_TERMINALES.includes(request.estado) && !motivo) {
      message = 'Indique en Observaciones el motivo del cierre.';
    } else if (request.paso !== this.opcionGuardada && !motivo) {
      message = 'Indique en Observaciones el motivo del cambio de paso.';
    }

    if (message != "") {
      this.notification.warning(message);
    }

    return message == ""
  }

  async onSubmit() {
    if (this.saving || !this.puedeGuardar) {
      return;
    }

    const request: IFormMovimiento = this.demandaForm.getRawValue();
    const cambiaMovimiento = this.puedeMover
      && (request.paso !== this.opcionGuardada || request.estado !== this.estadoGuardado);

    if (!cambiaMovimiento) {
      this.guardarObservacion(request.observaciones?.trim() ?? '');
      return;
    }

    if (!this.validateForm(request)) {
      return;
    }

    const destino = this.opcion(request.paso)!;
    this.saving = true;
    const cambiaPaso = request.paso !== this.opcionGuardada;
    const cierra = ESTADOS_TERMINALES.includes(request.estado);
    if (this.reabriendo || cambiaPaso || cierra) {
      const confirmado = await this.confirmarMovimiento(destino, cambiaPaso, cierra);
      if (!confirmado) { this.saving = false; return; }
    }
    this.loadingService.show();

    this.demandaService.mover(request.id, {
      paso: destino.paso,
      idPaso: destino.idPaso,
      estado: request.estado,
      observaciones: request.observaciones?.trim() || null,
      version: this.version
    })
      .pipe(finalize(() => {
        this.saving = false;
        this.loadingService.hide();
      }))
      .subscribe({
        next: (response) => {
          this.notification.success(response.message);
          this.goToBack();
        },
        error: (error: HttpErrorResponse) => this.recargarSiHayConflicto(error, request.observaciones)
      });
  }

  private yaVisitado(destino: IOpcionPaso): boolean {
    return this.historial.some(item => destino.idPaso && item.idPaso
      ? item.idPaso === destino.idPaso
      : item.paso === destino.paso);
  }

  private confirmarMovimiento(destino: IOpcionPaso, cambiaPaso: boolean, cierra: boolean): Promise<boolean> {
    if (this.reabriendo) {
      return this.notification.confirmWarning('Reabrir expediente',
        `El expediente volverá a «${destino.nombre}». La reapertura y su motivo quedarán registrados.`,
        'Reabrir expediente');
    }
    if (cierra) {
      return this.notification.confirmWarning('Cerrar expediente',
        `Se cerrará el expediente en «${destino.nombre}». Después solo un administrador podrá reabrirlo.`,
        'Cerrar expediente');
    }
    const regresa = cambiaPaso && this.yaVisitado(destino);
    return this.notification.confirmWarning(regresa ? 'Volver a un paso visitado' : 'Cambiar paso',
      `Pasará de «${this.pasoGuardado}» a «${destino.nombre}». ${regresa ? 'Este paso ya figura en el historial. ' : ''}El movimiento y su motivo quedarán registrados.`,
      'Confirmar movimiento');
  }

  private guardarObservacion(observaciones: string) {
    if (!this.permisos.observar) {
      this.notification.warning('No hay cambios de paso ni de estado para guardar.');
      return;
    }
    if (!observaciones) {
      this.notification.warning('Escriba una observación o elija otro paso o estado.');
      return;
    }

    this.saving = true;
    this.demandaService.observar(this.idDemanda!, observaciones)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: (response) => {
          this.notification.success(response.message);
          this.demandaForm.patchValue({ observaciones: null });
        }
      });
  }

  private recargarSiHayConflicto(error: HttpErrorResponse, observaciones: string | null | undefined) {
    if (error.status === 409) {
      this.getDemanda(observaciones ?? null);
    }
  }

  listPasos(pasos: IPasoBpmn[]) {
    const seleccion = this.demandaForm.get('paso')?.value;
    this.pasosBpmn = [...pasos];
    this.actualizarOpciones();
    if (!this.reabriendo && (seleccion == null || seleccion === this.pasoGuardado))
      this.demandaForm.patchValue({ paso: this.opcionGuardada });
  }

  openModalHistorial() {
    this.ref = this.dialogService.open(HistorialDemandaListModalComponent, {
      data: {
        idDemanda: this.idDemanda,
      },
      header: "Historial de Demanda",
      width: '55rem'
    });
  }
}
