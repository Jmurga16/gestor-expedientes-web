import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ImportDoneEvent } from 'bpmn-js/lib/BaseViewer';

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
  @Input() estadoActual?: number;
  @Output() fileChange = new EventEmitter<File>()
  @Output() pasos = new EventEmitter<string[]>()

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

  listPasos(pasos: string[]) {
    this.pasos.emit(pasos);
  }
}
