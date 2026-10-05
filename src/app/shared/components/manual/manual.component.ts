import { Component } from '@angular/core';

@Component({
  selector: 'app-manual',
  standalone: true,
  templateUrl: './manual.component.html',
  styleUrl: './manual.component.scss'
})
export class ManualComponent {
  irA(evento: Event, seccion: string): void {
    evento.preventDefault();
    document.getElementById(seccion)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
