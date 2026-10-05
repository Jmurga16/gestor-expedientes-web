import { AfterContentInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { from, Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, map, switchMap, tap } from 'rxjs/operators';
import type Canvas from 'diagram-js/lib/core/Canvas';
import type ElementRegistry from 'diagram-js/lib/core/ElementRegistry';
import type EventBus from 'diagram-js/lib/core/EventBus';
import type { ImportDoneEvent, ImportXMLError, ImportXMLResult } from 'bpmn-js/lib/BaseViewer';
import type Modeling from 'bpmn-js/lib/features/modeling/Modeling';
import type { Shape } from 'bpmn-js/lib/model/Types';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import BpmnJS from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import { FileService } from '../../services/file.service';
import { NotificationService } from '../../services/notification.service';
import { IArea } from '../../../modules/area/common/models/area.interface';
import { AreaService } from '../../../modules/area/common/services/area.service';
import { FormWorkflowService } from '../../../modules/workflow/common/services/form-workflow.service';
import { COLORES_ESTADO } from '../../models/estado-expediente';
import { IPasoBpmn } from '../../models/paso-bpmn.interface';

const PAUSA_ENTRE_CAMBIOS = 200;
const ESCALA_IMAGEN = 2;
const ERROR_IMAGEN = 'No se pudo generar la imagen del diagrama.';

@Component({
  selector: 'app-diagram',
  templateUrl: './diagram.component.html',
  styleUrl: './diagram.component.scss'
})
export class DiagramComponent implements AfterContentInit, OnChanges, OnDestroy, OnInit {

  @ViewChild('ref', { static: true }) private el: ElementRef | undefined;
  @Input() url?: string;
  @Input() idDemanda?: number;
  @Input() readonly: boolean = false;
  @Input() pasoActual?: string;
  @Input() idPasoActual?: string | null;
  @Input() estadoActual?: number;
  @Output() private importDone: EventEmitter<ImportDoneEvent> = new EventEmitter();
  @Output() fileBPMN = new EventEmitter<File>();
  @Output() pasos = new EventEmitter<IPasoBpmn[]>();

  listArea: IArea[] = [];

  idArea = new FormControl<number | null>(null)

  private bpmnJS: BpmnJS | NavigatedViewer = new BpmnJS();
  private viewerMode = false;
  private coloresOriginales = new Map<SVGElement, { fill: string; stroke: string; width: string }>();
  avisoPaso = '';

  get colorEstado() { return COLORES_ESTADO[this.estadoActual ?? 0]; }
  private loadSubscription?: Subscription;
  private nombreSubscription?: Subscription;
  private cambiosSubscription?: Subscription;
  private readonly cambios = new Subject<void>();
  private readonly onCommandStackChanged = () => this.cambios.next();

  constructor(
    private http: HttpClient,
    private fileService: FileService,
    private areaService: AreaService,
    private formWorkflowService: FormWorkflowService,
    private notification: NotificationService,
  ) {
    this.bpmnJS.on<ImportDoneEvent>('import.done', ({ error }) => {
      if (!error) {
        this.bpmnJS.get<Canvas>('canvas').zoom('fit-viewport');
      }
    });

    this.bpmnJS.get<EventBus>('eventBus').on('commandStack.changed', this.onCommandStackChanged);
  }

  ngAfterContentInit(): void {
    if (this.el) {
      this.bpmnJS.attachTo(this.el.nativeElement);
    }
  }

  ngOnInit(): void {
    if (!this.readonly && !this.idDemanda) this.getAreas();

    this.cambiosSubscription = this.cambios.pipe(debounceTime(PAUSA_ENTRE_CAMBIOS))
      .subscribe(() => this.updateDiagramFile());

    this.nombreSubscription = this.formWorkflowService.nombre$.subscribe(value => {
      this.updateWorkflowName(value)
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['url'] && this.url) {
      this.loadUrl(this.url);
    }
    if (changes['pasoActual'] || changes['idPasoActual'] || changes['estadoActual']) this.pintarPasoActual();
  }

  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
    this.nombreSubscription?.unsubscribe();
    this.cambiosSubscription?.unsubscribe();

    this.bpmnJS.get<EventBus>('eventBus').off('commandStack.changed', this.onCommandStackChanged);

    this.bpmnJS.destroy();
  }

  loadUrl(url: string): void {
    if ((this.readonly || this.idDemanda) && !this.viewerMode) {
      this.bpmnJS.destroy();
      this.bpmnJS = new NavigatedViewer();
      this.viewerMode = true;
      if (this.el) this.bpmnJS.attachTo(this.el.nativeElement);
      this.bpmnJS.on<ImportDoneEvent>('import.done', ({ error }) => {
        if (!error) this.bpmnJS.get<Canvas>('canvas').zoom('fit-viewport');
      });
    }
    this.loadSubscription?.unsubscribe();
    this.loadSubscription = this.fileService.resolveUrl(url).pipe(
      switchMap((signedUrl: string) => this.http.get(signedUrl, { responseType: 'text' })),
      switchMap((xml: string) => this.importDiagram(xml)),
      map(result => result.warnings),
    ).subscribe({
      next: (warnings) => this.importDone.emit({ warnings }),
      error: (err: ImportXMLError) => this.importDone.emit({ warnings: err.warnings ?? [], error: err })
    });
  }

  private importDiagram(xml: string): Observable<ImportXMLResult> {
    return from(this.bpmnJS.importXML(xml)).pipe(
      tap(() => {
        this.coloresOriginales.clear();
        this.updateWorkflowName(this.formWorkflowService.nombreActual);

        if (this.idDemanda) {
          this.pasos.emit(this.getPasos());
        }
        this.pintarPasoActual();
      })
    );
  }

  exportDiagram(): void {
    this.bpmnJS.saveXML({ format: true }).then(
      (result) => {
        const xml = result?.xml;
        if (xml) {
          this.fileService.downloadFile('diagram.bpmn', xml, 'application/xml');
        } else {
          this.notification.error('No se pudo generar el XML del diagrama.');
        }
      },
      () => {
        this.notification.error('No se pudo descargar el diagrama.');
      }
    );
  }

  exportImagen(): void {
    this.bpmnJS.saveSVG().then(
      (result) => this.descargarPng(result.svg),
      () => this.notification.error(ERROR_IMAGEN)
    );
  }

  private descargarPng(svg: string): void {
    const imagen = new Image();

    imagen.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imagen.naturalWidth * ESCALA_IMAGEN;
      canvas.height = imagen.naturalHeight * ESCALA_IMAGEN;

      const contexto = canvas.getContext('2d');
      if (!contexto) {
        this.notification.error(ERROR_IMAGEN);
        return;
      }

      contexto.fillStyle = '#ffffff';
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (!blob) {
          this.notification.error(ERROR_IMAGEN);
          return;
        }
        this.fileService.downloadFile('diagrama.png', blob, 'image/png');
      }, 'image/png');
    };

    imagen.onerror = () => this.notification.error(ERROR_IMAGEN);
    imagen.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  updateDiagramFile() {
    if (this.readonly || this.idDemanda) return;
    this.bpmnJS.saveXML({ format: true }).then(
      (result) => {
        const xml = result?.xml;
        if (xml) {
          const file = new File([xml], 'diagram.bpmn', { type: 'application/xml' });
          this.fileBPMN.emit(file);
        }
      }
    );
  }

  getAreas() {
    this.areaService.getActives().subscribe({
      next: (response: IArea[]) => {
        this.listArea = response;
      }
    });
  }

  updateWorkflowName(newName: string): void {
    if (!newName || this.readonly || this.idDemanda) {
      return;
    }

    const participant = this.getShapes('bpmn:Participant')[0];

    if (!participant || participant.businessObject.name === newName) {
      return;
    }

    this.getModeling().updateProperties(participant, { name: newName });
  }

  addAreaToWorkflow() {
    if (this.readonly || this.idDemanda) return;
    const idArea = this.idArea.value;
    if (idArea == null) {
      this.notification.warning('Debe seleccionar un área.');
      return;
    }

    const area = this.listArea.find(item => item.id === idArea);
    if (!area)
      return;

    if (!this.addLaneToWorkflow(`Lane_${area.id}`, area.nombre))
      return;

    this.listArea = this.listArea.filter(item => item.id !== idArea);

    this.idArea.setValue(null);
  }

  private addLaneToWorkflow(laneId: string, laneName: string): boolean {
    const target = this.getLastLane() ?? this.getShapes('bpmn:Participant')[0];

    if (!target) {
      this.notification.error('El diagrama todavía no está cargado.');
      return false;
    }

    if (this.getElementRegistry().get(laneId)) {
      this.notification.warning(`El área "${laneName}" ya está en el diagrama.`);
      return false;
    }

    const modeling = this.getModeling();
    const lane = modeling.addLane(target, 'bottom');
    modeling.updateProperties(lane, { id: laneId, name: laneName });

    return true;
  }

  private getLastLane(): Shape | undefined {
    return this.getShapes('bpmn:Lane')
      .sort((a, b) => a.y - b.y)
      .pop();
  }

  private getShapes(type: string): Shape[] {
    return this.getElementRegistry().filter(element => is(element, type)) as Shape[];
  }

  private getElementRegistry(): ElementRegistry {
    return this.bpmnJS.get<ElementRegistry>('elementRegistry');
  }

  private getModeling(): Modeling {
    return this.bpmnJS.get<Modeling>('modeling');
  }

  private getPasos(): IPasoBpmn[] {
    const tareas = this.getShapes('bpmn:Task').filter(shape => shape.type !== 'label');
    if (tareas.length === 0) {
      this.notification.warning('El diagrama no tiene pasos definidos.');
    }
    const carriles = new Map<string, string>();
    this.getShapes('bpmn:Lane').forEach(lane => (lane.businessObject.flowNodeRef ?? [])
      .forEach((nodo: { id: string }) => carriles.set(nodo.id, lane.businessObject.name ?? '')));
    return tareas
      .filter(task => !!(task.businessObject.name as string)?.trim())
      .map(task => ({ id: task.businessObject.id, nombre: task.businessObject.name, carril: carriles.get(task.businessObject.id) || null }));
  }

  private pintarPasoActual(): void {
    this.coloresOriginales.forEach((original, node) => {
      node.style.fill = original.fill;
      node.style.stroke = original.stroke;
      node.style.strokeWidth = original.width;
    });
    this.coloresOriginales.clear();
    this.avisoPaso = '';
    if (!this.idDemanda || !this.pasoActual || !this.colorEstado || !this.bpmnJS.getDefinitions()) return;
    const tipo = this.pasoActual === 'Inicio' ? 'bpmn:StartEvent'
      : this.pasoActual === 'Finalizado' ? 'bpmn:EndEvent' : 'bpmn:Task';
    const porId = this.idPasoActual ? this.getElementRegistry().get(this.idPasoActual) as Shape | undefined : undefined;
    const candidatos = porId ? [porId] : this.getShapes(tipo).filter(shape => shape.type !== 'label'
      && (tipo !== 'bpmn:Task' || shape.businessObject.name === this.pasoActual));
    if (candidatos.length !== 1) {
      this.avisoPaso = 'No se puede identificar un único elemento para el paso guardado en este diagrama.';
      return;
    }
    const gfx = this.getElementRegistry().getGraphics(candidatos[0]);
    const figura = gfx.querySelector<SVGElement>('.djs-visual > :first-child');
    if (!figura) return;
    this.coloresOriginales.set(figura, { fill: figura.style.fill, stroke: figura.style.stroke, width: figura.style.strokeWidth });
    figura.style.fill = this.colorEstado.fondo;
    figura.style.stroke = this.colorEstado.borde;
    figura.style.strokeWidth = '3px';
  }
}
