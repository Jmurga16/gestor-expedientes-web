import { FormBuilder } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { DemandaWorkflowComponent } from './demanda-workflow.component';
import { IPermisosDemanda } from '../../common/models/demanda.interface';

const PERMISOS: IPermisosDemanda = { mover: true, editar: true, eliminar: true, observar: true, reabrir: false };

describe('DemandaWorkflowComponent: movimientos', () => {
  let component: DemandaWorkflowComponent;
  let api: any;
  let notification: any;

  function cargar(estado: number, permisos: Partial<IPermisosDemanda> = {}) {
    api.getById.and.returnValue(of({ id: 9, paso: 'Revisión', estado, urlBpmn: 'qa.bpmn', version: 2 }));
    api.getPermisos.and.returnValue(of({ ...PERMISOS, ...permisos }));
    component.idDemanda = 9;
    component.getDemanda();
  }

  beforeEach(() => {
    api = {
      mover: jasmine.createSpy().and.returnValue(of({ message: 'Guardado' })),
      observar: jasmine.createSpy().and.returnValue(of({ message: 'Observación registrada' })),
      getById: jasmine.createSpy(),
      getPermisos: jasmine.createSpy()
    };
    notification = { warning: jasmine.createSpy(), success: jasmine.createSpy(), confirmWarning: jasmine.createSpy().and.resolveTo(true) };
    component = new DemandaWorkflowComponent(
      { params: of({}) } as any, api, { navigate: jasmine.createSpy() } as any, new FormBuilder(),
      { getEstadosStep: () => of([1, 2, 3, 4, 5, 6, 7].map(id => ({ id, nombre: String(id) }))) } as any,
      {} as any, { show: () => { }, hide: () => { } } as any, notification,
      { get: () => of([]) } as any
    );
    component.ngOnInit();
    component.listPasos(['Revisión', 'Inspección']);
    cargar(3);
  });

  it('no guarda al cancelar el regreso a un paso visitado', async () => {
    component.pasosVisitados = ['Inicio', 'Inspección', 'Revisión'];
    component.demandaForm.patchValue({ paso: 'Inspección', observaciones: 'Subsanar revisión' });
    notification.confirmWarning.and.resolveTo(false);
    await component.onSubmit();
    expect(notification.confirmWarning.calls.mostRecent().args[0]).toBe('Volver a un paso visitado');
    expect(api.mover).not.toHaveBeenCalled();
    expect(component.saving).toBeFalse();
  });

  it('exige motivo para cambiar de paso y para cerrar', async () => {
    component.demandaForm.patchValue({ paso: 'Inspección' });
    await component.onSubmit();
    component.demandaForm.patchValue({ paso: 'Revisión', estado: 4 });
    await component.onSubmit();
    expect(notification.warning).toHaveBeenCalledTimes(2);
    expect(api.mover).not.toHaveBeenCalled();
  });

  it('envía el movimiento con la versión leída', async () => {
    component.demandaForm.patchValue({ estado: 4, observaciones: 'Obra terminada' });
    await component.onSubmit();
    expect(notification.confirmWarning.calls.mostRecent().args[0]).toBe('Cerrar expediente');
    expect(api.mover).toHaveBeenCalledWith(9, { paso: 'Revisión', estado: 4, observaciones: 'Obra terminada', version: 2 });
  });

  it('sin cambios de paso ni estado guarda la observación sin mover', async () => {
    component.demandaForm.patchValue({ observaciones: '  Se llamó al vecino ' });
    await component.onSubmit();
    expect(api.observar).toHaveBeenCalledWith(9, 'Se llamó al vecino');
    expect(api.mover).not.toHaveBeenCalled();
  });

  it('impide envíos duplicados mientras se confirma', async () => {
    let confirmar!: (value: boolean) => void;
    notification.confirmWarning.and.returnValue(new Promise<boolean>(resolve => confirmar = resolve));
    component.demandaForm.patchValue({ estado: 4, observaciones: 'Cierre' });
    const first = component.onSubmit();
    await component.onSubmit();
    expect(notification.confirmWarning).toHaveBeenCalledTimes(1);
    confirmar(true);
    await first;
    expect(api.mover).toHaveBeenCalledTimes(1);
  });

  it('el colaborador solo agrega observaciones', async () => {
    cargar(3, { mover: false, editar: false, eliminar: false });
    expect(component.demandaForm.get('paso')?.disabled).toBeTrue();
    expect(component.demandaForm.get('observaciones')?.enabled).toBeTrue();
    component.demandaForm.patchValue({ observaciones: 'Adjunto fotos al legajo' });
    await component.onSubmit();
    expect(api.observar).toHaveBeenCalled();
    expect(api.mover).not.toHaveBeenCalled();
  });

  it('bloquea los estados terminales y ofrece reabrir solo con permiso', () => {
    for (const estado of [4, 5, 7]) {
      cargar(estado, { mover: false, reabrir: estado !== 7 });
      expect(component.finalizada).toBeTrue();
      expect(component.demandaForm.get('paso')?.disabled).toBeTrue();
    }
  });

  it('la reapertura ofrece solo estados abiertos y exige motivo', async () => {
    cargar(4, { mover: false, reabrir: true });
    component.reabrir();
    expect(component.listEstadosDemanda.map(e => e.id)).toEqual([1, 2, 3, 6]);
    expect(component.listTask.map(p => p.id)).not.toContain('Finalizado');
    await component.onSubmit();
    expect(notification.warning).toHaveBeenCalledWith('Indique en Observaciones el motivo de la reapertura.');
    component.demandaForm.patchValue({ observaciones: 'Se cerró por error' });
    await component.onSubmit();
    expect(notification.confirmWarning.calls.mostRecent().args[0]).toBe('Reabrir expediente');
    expect(api.mover).toHaveBeenCalledWith(9, jasmine.objectContaining({ estado: 3, observaciones: 'Se cerró por error' }));
  });

  it('ante un conflicto recarga el expediente y conserva lo escrito', async () => {
    api.mover.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.demandaForm.patchValue({ paso: 'Inspección', observaciones: 'Motivo' });
    api.getById.calls.reset();
    await component.onSubmit();
    expect(api.getById).toHaveBeenCalled();
    expect(component.demandaForm.get('observaciones')?.value).toBe('Motivo');
  });

  it('no ofrece Finalizado como estado para cerrar', () => {
    expect(component.listEstadosDemanda.map(e => e.id)).not.toContain(7);
  });

  it('incluye Inicio sin alterar el array del visor', () => {
    const pasos = ['Revisión'];
    component.listPasos(pasos);
    expect(pasos).toEqual(['Revisión']);
    expect(component.listTask.map(item => item.id)).toEqual(['Inicio', 'Revisión', 'Finalizado']);
  });
});
