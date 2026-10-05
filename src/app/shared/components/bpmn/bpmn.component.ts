import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ImportDoneEvent } from 'bpmn-js/lib/BaseViewer';
import { IPasoBpmn } from '../../models/paso-bpmn.interface';

@Component({
  selector: 'app-bpmn',
  templateUrl: './bpmn.component.html',
  styleUrl: './bpmn.component.scss'
})
export class BpmnComponent {

  @Input() urlBPMN!: string;
  @Input() idDemanda?: number;
  @Input() readonly: boolean = false;
  @Input() pasoActual?: string;
  @Input() idPasoActual?: string | null;
  @Input() estadoActual?: number;
  @Output() fileChange = new EventEmitter<File>()
  @Output() pasos = new EventEmitter<IPasoBpmn[]>()

  importError?: Error;

  handleImported(event: ImportDoneEvent) {
    if (event.error) {
      console.error('Failed to render diagram', event.error);
    }

    this.importError = event.error;
  }

  onChangeDiagram(file: File): void {
    this.fileChange.emit(file);
  }

  listPasos(pasos: IPasoBpmn[]) {
    this.pasos.emit(pasos);
  }
}
