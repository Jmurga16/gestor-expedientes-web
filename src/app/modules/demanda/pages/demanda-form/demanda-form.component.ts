import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, forkJoin } from 'rxjs';
import { DemandaService } from '../../common/services/demanda.service';
import { IDemandaForm } from '../../common/models/demanda-form.interface';
import { ITipologia } from '../../../tipologia/common/models/tipologia.interface';
import { ISubtipologia } from '../../../tipologia/common/models/subtipologia.interface';
import { TipologiaService } from '../../../tipologia/common/services/tipologia.service';
import { SubtipologiaService } from '../../../tipologia/common/services/subtipologia.service';
import { WorkflowService } from '../../../workflow/common/services/workflow.service';
import { UsuarioService } from '../../../user/common/services/usuario.service';
import { IUsuario } from '../../../user/common/models/usuario.interface';
import { ITipoDemanda } from '../../../../shared/models/tipo-demanda.interface';
import { IOpcion } from '../../../../shared/models/opcion.interface';
import { DataService } from '../../../../shared/services/data.service';
import { FileService } from '../../../../shared/services/file.service';
import { LoadingService } from '../../../../shared/services/loading.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { TokenService } from '../../../../auth/services/token.service';

const WORKFLOW_NOT_CONFIGURED = 'WORKFLOW_NOT_CONFIGURED';

@Component({
  selector: 'app-demanda-form',
  templateUrl: './demanda-form.component.html',
  styleUrl: './demanda-form.component.scss'
})
export class DemandaFormComponent implements OnInit {

  headerTitle: string = "Gestión de Demandas"
  readonly: boolean = false;
  isEdit: boolean = false;
  loading: boolean = false;
  saving: boolean = false;

  listEstadosDemanda: IOpcion[] = []
  listTipoDemanda: ITipoDemanda[] = []
  listTipologia: ITipologia[] = []
  listSubtipologia: ISubtipologia[] = []

  demandaForm: FormGroup;
  userForm: FormGroup;

  idDemanda?: number
  imagenPreview: string | null = null;

  esAdmin: boolean = false;
  workflowFaltante: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private demandaService: DemandaService,
    private tipologiaService: TipologiaService,
    private subtipologiaService: SubtipologiaService,
    private dataService: DataService,
    private fileService: FileService,
    private usuarioService: UsuarioService,
    private loadingService: LoadingService,
    private tokenService: TokenService,
    private workflowService: WorkflowService,
    private notification: NotificationService,
  ) {

    this.userForm = this.formBuilder.group({
      id: [null],
      name: [null],
      lastname: [null],
      dni: [null],
      address: [null],
      email: [null],
    });

    this.demandaForm = this.formBuilder.group({
      id: [null],
      caratula: [null],
      idUsuario: [null],

      idTipoDemanda: [null],
      idTipologia: [null],
      idSubtipologia: [null],
      descripcion: [null],

      domicilio: [null],
      rutaImagen: [null],

      informacionAdicional: [null],
      paso: ['Inicio'],
      urlBpmn: ['/assets/demo/base.bpmn'],

      estado: [1],
      version: [null]
    });

  }

  ngOnInit(): void {

    this.getUser();
    this.getEstadosDemanda()
    this.getTipologia();
    this.getTipoDemanda();

    this.activatedRoute.params.subscribe(params => {
      this.idDemanda = params['id'];
      if (this.idDemanda) {
        this.getDemanda();
      }
    });

    this.esAdmin = this.tokenService.isAdmin();
    this.watchWorkflowDisponible();

  }

  private watchWorkflowDisponible() {
    ['idTipoDemanda', 'idTipologia', 'idSubtipologia'].forEach(control => {
      this.demandaForm.controls[control].valueChanges.subscribe(() => this.checkWorkflowDisponible());
    });
  }

  private checkWorkflowDisponible() {
    this.workflowFaltante = false;

    if (this.idDemanda)
      return;

    const idTipoDemanda = this.demandaForm.controls['idTipoDemanda'].value;
    const idTipologia = this.demandaForm.controls['idTipologia'].value;
    const idSubtipologia = this.demandaForm.controls['idSubtipologia'].value;

    if (!idTipoDemanda || !idTipologia || !idSubtipologia)
      return;

    this.workflowService.exists(idTipoDemanda, idTipologia, idSubtipologia).subscribe({
      next: (existe: boolean) => this.workflowFaltante = !existe,
      error: () => this.workflowFaltante = false
    });
  }

  goToCrearWorkflow() {
    this.router.navigate(['/admin/workflow/create'], {
      queryParams: {
        idTipoDemanda: this.demandaForm.controls['idTipoDemanda'].value,
        idTipologia: this.demandaForm.controls['idTipologia'].value,
        idSubtipologia: this.demandaForm.controls['idSubtipologia'].value
      }
    });
  }

  getUser() {
    this.usuarioService.getMe().subscribe({
      next: (response: IUsuario) => {
        this.userForm.patchValue(response);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getDemanda() {
    forkJoin({
      demanda: this.demandaService.getById(this.idDemanda!),
      permisos: this.demandaService.getPermisos(this.idDemanda!)
    }).subscribe({
      next: ({ demanda: response, permisos }) => {
        this.demandaForm.patchValue(response);
        ['idTipoDemanda', 'idTipologia', 'idSubtipologia'].forEach(campo => this.demandaForm.get(campo)?.disable());
        this.readonly = !permisos.editar;
        if (this.readonly)
          this.demandaForm.disable();
        this.loadImagenPreview(response.rutaImagen);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
      complete: () => {
        this.getSubtipologia(this.demandaForm.controls["idTipologia"].value)
      }
    });
  }

  getTipoDemanda() {
    this.dataService.getTipoDemanda().subscribe({
      next: (response: ITipoDemanda[]) => {
        this.listTipoDemanda = response;
      }
    });
  }

  getTipologia() {
    this.tipologiaService.getActives().subscribe({
      next: (response: ITipologia[]) => {
        this.listTipologia = response;
        this.setDescripcion(this.demandaForm.controls["idTipologia"].value);
      }
    });
  }

  getSubtipologia(idTipologia: number) {
    this.setDescripcion(idTipologia)

    this.subtipologiaService.getByIdTipologia(idTipologia).subscribe({
      next: (response: ISubtipologia[]) => {
        this.listSubtipologia = response;
      }
    });
  }

  setDescripcion(idTipologia: number) {
    const tipologia = this.listTipologia.find(item => item.id == idTipologia);
    if (tipologia) {
      this.demandaForm.controls["descripcion"].setValue(tipologia.descripcion)
    }
  }

  getEstadosDemanda() {
    this.dataService.getEstadosStep().subscribe({
      next: (response: IOpcion[]) => {
        this.listEstadosDemanda = response;
      }
    });
  }

  goToBack() {
    this.router.navigate([this.idDemanda ? '../../list' : '../list'], {
      relativeTo: this.activatedRoute
    });
  }

  onSubmit() {
    if (this.saving || this.readonly) {
      return;
    }

    const request: IDemandaForm = this.demandaForm.getRawValue();

    if (!this.validateForm(request)) {
      return;
    }

    if (this.demandaForm.invalid) {
      this.notification.warning('Revise los datos del formulario.');
      return;
    }

    this.saving = true;
    this.loadingService.show();

    const peticion = this.idDemanda ? this.demandaService.update(request) : this.demandaService.create(request);

    peticion.pipe(finalize(() => this.onSaveFinished())).subscribe({
      next: (response) => {
        this.notification.success(response.message);
        this.goToBack();
      },
      error: (error: HttpErrorResponse) => this.handleSaveError(error)
    });
  }

  private handleSaveError(error: HttpErrorResponse) {
    if (error.error?.code === WORKFLOW_NOT_CONFIGURED) {
      this.showWorkflowNotConfigured(error.error.message);
    } else if (error.status === 409) {
      this.notification.confirmWarning(
        'El expediente cambió',
        'Otro usuario lo modificó mientras usted lo editaba. Puede recargar los datos actuales o quedarse en esta pantalla para copiar sus cambios.',
        'Recargar datos'
      ).then(confirmado => {
        if (confirmado) {
          this.getDemanda();
        }
      });
    }
  }

  private showWorkflowNotConfigured(message: string) {
    if (!this.esAdmin) {
      this.notification.warning(`${message} Comuníquese con el administrador del sistema para que lo cree.`);
      return;
    }

    this.notification.confirmWarning(
      'Falta el flujo de trabajo',
      `${message} Puede crearlo ahora y volver a registrar la demanda.`,
      'Crear flujo de trabajo'
    ).then(confirmado => {
      if (confirmado) {
        this.goToCrearWorkflow();
      }
    });
  }

  private onSaveFinished() {
    this.saving = false;
    this.loadingService.hide();
  }

  validateForm(request: IDemandaForm): boolean {
    let message: string = "";

    if (!request.idTipoDemanda) {
      message = "El campo Tipo de Demanda es requerido."
    } else if (!request.idTipologia) {
      message = "El campo Tipologia es requerido."
    } else if (!request.idSubtipologia) {
      message = "El campo Subtipologia es requerido."
    } else if (!request.domicilio) {
      message = "El campo Domicilio es requerido."
    }

    if (message != "") {
      this.notification.warning(message);
    }

    return message == ""
  }

  private loadImagenPreview(rutaImagen: string | null) {
    this.imagenPreview = null;
    if (!rutaImagen)
      return;

    this.fileService.resolveUrl(rutaImagen).subscribe({
      next: (url: string) => this.imagenPreview = url,
      error: () => this.imagenPreview = null
    });
  }

  onUploadImage(event: { files: File[] }) {
    const file = event.files[0];
    if (!file)
      return;

    this.fileService.uploadFileUnique(file, 'demanda-imagen').subscribe({
      next: (response) => {
        this.demandaForm.patchValue({ rutaImagen: response.fileUrl });
        this.imagenPreview = response.viewUrl ?? response.fileUrl;
      }
    });
  }
}
