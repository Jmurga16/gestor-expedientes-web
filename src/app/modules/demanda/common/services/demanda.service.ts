import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs/internal/Observable';
import { environment } from '../../../../../environments/environment';
import { IPaginatedList } from '../../../../core/models/generic/paginated-list.interface';
import { IPaginatedFilter } from '../../../../core/models/generic/paginated-filter.interface';
import { IMessage } from '../../../../core/models/generic/message.interface';
import { IDemanda, IDemandaCreada, IDemandaList, IMovimiento, IPermisosDemanda } from '../models/demanda.interface';
import { IDemandaForm } from '../models/demanda-form.interface';

@Injectable({
  providedIn: 'root',
})
export class DemandaService {
  private _api: string;

  constructor(private http: HttpClient) {
    this._api = `${environment.apiUrl}/demanda`;
  }

  get(request: IPaginatedFilter): Observable<IPaginatedList<IDemandaList>> {
    const params = new HttpParams()
      .set('search', request.search)
      .set('pageIndex', request.pageIndex)
      .set('pageSize', request.pageSize);

    return this.http.get<IPaginatedList<IDemandaList>>(`${this._api}`, { params });
  }

  export(search: string): Observable<Blob> {
    const params = new HttpParams().set('search', search);

    return this.http.get(`${this._api}/export`, { params, responseType: 'blob' });
  }

  getResumen(): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(`${this._api}/resumen`);
  }

  getById(id: number): Observable<IDemanda> {
    return this.http.get<IDemanda>(`${this._api}/${id}`);
  }

  create(request: IDemandaForm): Observable<IDemandaCreada> {
    return this.http.post<IDemandaCreada>(`${this._api}`, request);
  }

  update(request: IDemandaForm): Observable<IMessage> {
    return this.http.put<IMessage>(`${this._api}/${request.id}`, request);
  }

  getPermisos(id: number): Observable<IPermisosDemanda> {
    return this.http.get<IPermisosDemanda>(`${this._api}/${id}/permisos`);
  }

  mover(id: number, movimiento: IMovimiento): Observable<IMessage> {
    return this.http.post<IMessage>(`${this._api}/${id}/movimiento`, movimiento);
  }

  observar(id: number, observaciones: string): Observable<IMessage> {
    return this.http.post<IMessage>(`${this._api}/${id}/observacion`, { observaciones });
  }

  delete(id: number): Observable<IMessage> {
    return this.http.delete<IMessage>(`${this._api}/${id}`);
  }
}
