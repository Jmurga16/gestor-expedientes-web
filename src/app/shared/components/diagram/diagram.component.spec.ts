import { EventEmitter, SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { firstValueFrom } from 'rxjs';
import type { ImportDoneEvent } from 'bpmn-js/lib/BaseViewer';
import { DiagramComponent } from './diagram.component';
import { FormWorkflowService } from '../../../modules/workflow/common/services/form-workflow.service';

const URL_BPMN = '/assets/demo/base.bpmn';

const BASE_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Participant_1" name="newWorkflow" processRef="Process_1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_0qe5roj" name="Demandante">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Inicio" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Participant_1_di" bpmnElement="Participant_1" isHorizontal="true">
        <dc:Bounds x="156" y="62" width="600" height="125" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_0qe5roj_di" bpmnElement="Lane_0qe5roj" isHorizontal="true">
        <dc:Bounds x="186" y="62" width="570" height="125" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="262" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

function altoDe(xml: string, idElemento: string): number {
  const shape = new RegExp(`bpmnElement="${idElemento}"[^>]*>\\s*<dc:Bounds[^>]*height="(\\d+)"`).exec(xml);
  return Number(shape![1]);
}

describe('DiagramComponent', () => {

  let fixture: ComponentFixture<DiagramComponent>;
  let component: DiagramComponent;
  let httpMock: HttpTestingController;
  let formWorkflowService: FormWorkflowService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DiagramComponent],
      imports: [HttpClientTestingModule, ReactiveFormsModule, ButtonModule, DropdownModule]
    });

    httpMock = TestBed.inject(HttpTestingController);
    formWorkflowService = TestBed.inject(FormWorkflowService);

    fixture = TestBed.createComponent(DiagramComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    httpMock.expectOne(request => request.url.endsWith('/area/activos')).flush([]);
  });

  afterEach(() => {
    formWorkflowService.setNombre('');
    fixture.destroy();
    httpMock.verify();
  });

  async function importarDiagrama(xml = BASE_BPMN): Promise<void> {
    const importDone = component as unknown as { importDone: EventEmitter<ImportDoneEvent> };
    const terminado = firstValueFrom(importDone.importDone);

    component.url = URL_BPMN;
    component.ngOnChanges({ url: new SimpleChange(undefined, URL_BPMN, true) });

    httpMock.expectOne(URL_BPMN).flush(xml);

    await terminado;
  }

  async function xmlDelDiagrama(accion: () => void): Promise<string> {
    const archivo = firstValueFrom(component.fileBPMN);
    accion();
    return (await archivo).text();
  }

  it('agrega el area como un lane con el id que lee el backend', async () => {
    await importarDiagrama();

    component.listArea = [{ id: 5, nombre: 'Obras Publicas', estado: 1 }];
    component.idArea.setValue(5);

    const xml = await xmlDelDiagrama(() => component.addAreaToWorkflow());

    expect(xml).toContain('id="Lane_5"');
    expect(xml).toContain('name="Obras Publicas"');
    expect(xml).toContain('name="Demandante"');
    expect(component.listArea).toEqual([]);
    expect(component.idArea.value).toBeNull();
  });

  it('respeta el alto del pool al agregar varias areas', async () => {
    await importarDiagrama();

    component.listArea = [
      { id: 4, nombre: 'Servicios Publicos', estado: 1 },
      { id: 5, nombre: 'Obras Publicas', estado: 1 }
    ];

    component.idArea.setValue(4);
    component.addAreaToWorkflow();

    component.idArea.setValue(5);
    const xml = await xmlDelDiagrama(() => component.addAreaToWorkflow());

    expect(xml).toContain('id="Lane_4"');
    expect(xml).toContain('id="Lane_5"');

    const altoDeLosLanes = ['Lane_0qe5roj', 'Lane_4', 'Lane_5']
      .map(id => altoDe(xml, id))
      .reduce((total, alto) => total + alto, 0);

    expect(altoDe(xml, 'Participant_1')).toBe(altoDeLosLanes);
  });

  it('no agrega dos veces la misma area', async () => {
    await importarDiagrama();

    component.listArea = [{ id: 5, nombre: 'Obras Publicas', estado: 1 }];
    component.idArea.setValue(5);
    component.addAreaToWorkflow();

    component.listArea = [{ id: 5, nombre: 'Obras Publicas', estado: 1 }];
    component.idArea.setValue(5);
    const xml = await xmlDelDiagrama(() => component.updateWorkflowName('Reclamo'));

    expect(xml.match(/id="Lane_5"/g)?.length).toBe(1);
    expect(component.listArea.length).toBe(1);
  });

  it('renombra el pool con el nombre del formulario', async () => {
    formWorkflowService.setNombre('Reclamo de vecino');

    await importarDiagrama();

    const xml = await xmlDelDiagrama(() => formWorkflowService.setNombre('Reclamo de vecino v2'));

    expect(xml).toContain('name="Reclamo de vecino v2"');
    expect(xml).not.toContain('name="newWorkflow"');
  });

  it('usa un visor sin modeling y pinta el paso guardado sin modificar el XML', async () => {
    component.readonly = true;
    component.idDemanda = 9;
    component.pasoActual = 'Inicio';
    component.estadoActual = 4;
    const archivoEmitido = spyOn(component.fileBPMN, 'emit');
    await importarDiagrama();
    fixture.detectChanges();

    const viewer = (component as any).bpmnJS;
    expect(viewer.get('modeling', false)).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.djs-palette')).toBeNull();
    const svg = (await viewer.saveSVG()).svg;
    expect(svg).toContain('rgb(220, 252, 231)');
    expect((await viewer.saveXML()).xml).not.toContain('rgb(220, 252, 231)');
    component.updateWorkflowName('No debe cambiar');
    expect((await viewer.saveXML()).xml).toContain('name="newWorkflow"');
    expect(archivoEmitido).not.toHaveBeenCalled();
  });

  it('incluye tareas de usuario y de servicio en los pasos', async () => {
    component.idDemanda = 9;
    const pasosEmitidos = spyOn(component.pasos, 'emit');
    const xml = BASE_BPMN.replace('</bpmn:process>',
      '<bpmn:userTask id="Task_User" name="Revisión"/><bpmn:serviceTask id="Task_Service" name="Consulta"/></bpmn:process>')
      .replace('</bpmndi:BPMNPlane>',
        '<bpmndi:BPMNShape id="User_di" bpmnElement="Task_User"><dc:Bounds x="330" y="90" width="100" height="80"/></bpmndi:BPMNShape>' +
        '<bpmndi:BPMNShape id="Service_di" bpmnElement="Task_Service"><dc:Bounds x="460" y="90" width="100" height="80"/></bpmndi:BPMNShape></bpmndi:BPMNPlane>');
    await importarDiagrama(xml);
    expect(pasosEmitidos).toHaveBeenCalledWith([
      { id: 'Task_User', nombre: 'Revisión', carril: null },
      { id: 'Task_Service', nombre: 'Consulta', carril: null }
    ]);
  });

  it('pinta por ID la tarea guardada aunque haya nombres repetidos', async () => {
    component.readonly = true;
    component.idDemanda = 9;
    component.pasoActual = 'Revisión';
    component.idPasoActual = 'Task_B';
    component.estadoActual = 3;
    const xml = BASE_BPMN.replace('</bpmn:process>',
      '<bpmn:task id="Task_A" name="Revisión"/><bpmn:task id="Task_B" name="Revisión"/></bpmn:process>')
      .replace('</bpmndi:BPMNPlane>',
        '<bpmndi:BPMNShape id="A_di" bpmnElement="Task_A"><dc:Bounds x="330" y="90" width="100" height="80"/></bpmndi:BPMNShape>' +
        '<bpmndi:BPMNShape id="B_di" bpmnElement="Task_B"><dc:Bounds x="460" y="90" width="100" height="80"/></bpmndi:BPMNShape></bpmndi:BPMNPlane>');
    await importarDiagrama(xml);

    expect(component.avisoPaso).toBe('');
    const registro = (component as any).bpmnJS.get('elementRegistry');
    const figura = (id: string) => registro.getGraphics(id).querySelector('.djs-visual > :first-child') as SVGElement;
    expect(figura('Task_B').style.stroke).toBe('rgb(67, 56, 202)');
    expect(figura('Task_A').style.stroke).not.toBe('rgb(67, 56, 202)');
  });
});
