import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { IUploadedFile } from '../models/uploaded-file.interface';
import { SILENCIAR_ERROR } from '../../core/interceptors/error.interceptor';

@Injectable({
    providedIn: 'root',
})
export class FileService {
    private _api: string;

    constructor(private http: HttpClient) {
        this._api = `${environment.apiUrl}/file`;
    }

    uploadFile(file: File, containerName: string): Observable<IUploadedFile> {
        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<IUploadedFile>(`${this._api}/${containerName}`, formData);
    }

    uploadFileUnique(file: File, containerName: string): Observable<IUploadedFile> {
        const uniqueName = `${new Date().getTime()}_${file.name}`;
        const renamedFile = new File([file], uniqueName, { type: file.type });

        const formData = new FormData();
        formData.append('file', renamedFile);

        return this.http.post<IUploadedFile>(`${this._api}/${containerName}`, formData);
    }

    resolveUrl(url: string): Observable<string> {
        if (!url || url.startsWith('/assets/') || url.startsWith('assets/'))
            return of(url);

        return this.http.get<{ url: string }>(`${this._api}/view`, {
            params: { url },
            context: new HttpContext().set(SILENCIAR_ERROR, true)
        }).pipe(map(response => response.url));
    }

    downloadFile(filename: string, data: string | Blob, type: string): void {
        const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}
